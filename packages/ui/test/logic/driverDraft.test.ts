/**
 * `driverDraft.ts` — the driver editor's editing session, held in `logic/` rather than in the
 * `.vue` file (John, 2026-09-09: "the dep can be moved to the logic like I've instructed").
 *
 * The component holds no `OpenISDDriver`: it asks this module to open a draft, reads fields
 * through the handle it gets back, and asks it to commit. Constructing and detaching drivers is
 * this layer's job.
 */
import {describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver} from '@openisd/design';
import {Engine} from '@openisd/design/engine';
import {openDriverDraft} from '../../src/logic/driverDraft.js';
import {presentationState} from '../../src/logic/presentationState.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'manual', readings: { manual: { read_value } } });

/** Each test builds its own driver — no shared fixture, so a failure is diagnosable from the
 *  one block it sits in. */
function aDriver(brand: string, model: string): OpenISDDriver {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped(brand), brand: scraped(brand), model: scraped(model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: {} },
    authoritative: { value: 'manual' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: { woofer: { Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02) } },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('openDriverDraft — a My Driver subject', () => {
  it('detaches the seed, so editing the draft leaves the seed alone', () => {
    const seed = aDriver('SB Acoustics', 'SB23');

    const draft = openDriverDraft({ kind: 'myDriver', openedAs: 'uuid-1', seed });
    draft.driver.model.set('Edited');

    assert.equal(draft.driver.model.value, 'Edited');
    assert.equal(seed.model.value, 'SB23', 'the seed is the caller\'s, never written through');
  });

  it('builds a blank driver when the subject is a new My Driver with no seed', () => {
    const draft = openDriverDraft({ kind: 'myDriver', openedAs: '', seed: null });

    assert.equal(draft.driver.brand.value, '');
    assert.equal(draft.driver.model.value, '');
  });

  it('stamps the blank driver\'s providedBy from the app\'s own Username setting', () => {
    const previous = presentationState.ui.username;
    presentationState.ui.username = 'johnl';
    try {
      const draft = openDriverDraft({ kind: 'myDriver', openedAs: '', seed: null });
      assert.equal(draft.driver.providedBy.value, 'johnl');
    } finally {
      presentationState.ui.username = previous;
    }
  });

  it('reset() throws the edits away and starts again from the same seed', () => {
    const seed = aDriver('Dayton', 'RS225');
    const draft = openDriverDraft({ kind: 'myDriver', openedAs: 'uuid-1', seed });
    draft.driver.model.set('Edited');

    draft.reset();

    assert.equal(draft.driver.model.value, 'RS225');
  });

  it('replace() adopts a driver read from a file as the new draft', () => {
    const draft = openDriverDraft({ kind: 'myDriver', openedAs: '', seed: null });

    draft.replace(aDriver('Peerless', 'SLS-830667'));

    assert.equal(draft.driver.model.value, 'SLS-830667');
  });
});

describe('openDriverDraft — wiring, expressed without naming the domain', () => {
  it('setWiring takes the UI word, so no component names the domain enum', () => {
    const draft = openDriverDraft({ kind: 'myDriver', openedAs: '', seed: aDriver('A', 'B') });

    draft.setWiring('series');
    const series = draft.driver.specs.VCCon.value;
    draft.setWiring('parallel');
    const parallel = draft.driver.specs.VCCon.value;

    expect(series).not.toBe(parallel);
  });
});
