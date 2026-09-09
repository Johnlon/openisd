/**
 * `driverDisplay.ts` — display/search logic for one driver: what it is called, and what
 * classification chips it gets. Domain fact (a T/S parameter, a stated `driver_type`) lives on
 * the driver itself; this file's job is turning those facts into UI-facing strings, which is
 * not domain logic.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDDriver, OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { displayNameOf, chipsOf, passiveRadiatorRows } from '../../src/logic/driverDisplay.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

function driverOf(p: {
  brand: string; model: string; driverType?: string;
  Fs?: number; Sd?: number;
}) {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(p.driverType ?? ''),
    data_sources: { value: {} },
    authoritative: { value: 'manual' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        ...(p.Fs != null ? { Fs: spec(p.Fs) } : {}),
        ...(p.Sd != null ? { Sd: spec(p.Sd) } : {}),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('displayNameOf — what a driver is called on screen', () => {
  it('joins brand and model with a space', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225' });
    assert.equal(displayNameOf(driver), 'Dayton RS225');
  });

  it('falls back to "Driver" when both brand and model are empty', () => {
    const driver = driverOf({ brand: '', model: '' });
    assert.equal(displayNameOf(driver), 'Driver');
  });

  it('uses whichever of brand/model is present, alone, when the other is empty', () => {
    const driver = driverOf({ brand: 'Dayton', model: '' });
    assert.equal(displayNameOf(driver), 'Dayton');
  });
});

describe('chipsOf — classification chips for one driver', () => {
  it('a canonical stated driver_type wins outright', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225-8', driverType: 'woofer' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Woofer');
  });

  it('falls back to the name when driver_type is not a canonical value', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'DT-25 Tweeter' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Tweeter');
  });

  it('falls back to T/S parameters when neither driver_type nor the name resolves it', () => {
    const driver = driverOf({ brand: 'Acme', model: 'X1', Fs: 30, Sd: 0.001 });
    const { canonical } = chipsOf(driver);
    // Sd in cm² < 12 resolves to Tweeter by the T/S fallback (Sd = 0.001 m² = 10 cm²).
    assert.equal(canonical, 'Tweeter');
  });
});

describe('passiveRadiatorRows — the PR browser row view model', () => {
  const prRecord = (p: { brand: string; model: string; Sd?: number; Mms?: number; Cms?: number }) => ({
    uuid: { value: '00000000-0000-4000-8000-00000000000a' },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped('passive-radiator'),
    data_sources: { value: {} },
    authoritative: { value: 'manual' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      'passive-radiator': {
        ...(p.Sd != null ? { Sd: spec(p.Sd) } : {}),
        ...(p.Mms != null ? { Mms: spec(p.Mms) } : {}),
        ...(p.Cms != null ? { Cms: spec(p.Cms) } : {}),
      },
    },
  });

  const radiatorOf = (p: { brand: string; model: string; Sd?: number; Mms?: number; Cms?: number }) => {
    const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prRecord(p), new Engine());
    if (Array.isArray(pr)) throw new Error(`fixture is not a valid radiator: ${pr.join(', ')}`);
    return pr;
  };

  it('names each row by its id, so a component can emit the id and never the radiator', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB Acoustics', model: 'SB23PACS' }) },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'aaaa-1');
    assert.equal(rows[0].name, 'SB Acoustics SB23PACS');
  });

  it('formats the three summary numbers the row tooltip quotes', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR', Sd: 0.025, Mms: 0.06, Cms: 0.0011 }) },
    ]);

    assert.equal(rows[0].sd, '250cm²');
    assert.equal(rows[0].mms, '60.0g');
    assert.equal(rows[0].cms, '1.10mm/N');
  });

  it('shows an em dash for a number the radiator does not state', () => {
    // A datasheet routinely publishes Sd/Cms and leaves Mms blank.
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR', Sd: 0.025 }) },
    ]);

    assert.equal(rows[0].sd, '250cm²');
    assert.equal(rows[0].mms, '—');
  });

  it('carries no domain object on the row, so the row can cross a component boundary', () => {
    const rows = passiveRadiatorRows([
      { id: 'aaaa-1', radiator: radiatorOf({ brand: 'SB', model: 'PR' }) },
    ]);

    for (const value of Object.values(rows[0])) {
      assert.equal(typeof value, 'string', 'every field of a row is a string');
    }
  });
});
