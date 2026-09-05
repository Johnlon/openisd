/**
 * The prototype app (`app/workspace.ts`) driven through the published surface only.
 *
 * These are the tests that could not be written before there was an app: focus surviving a close,
 * and closing leaving the store alone.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { assemble } from '../app/composition.js';
import { memoryStore } from '@openisd/design/browser';
import { conformingRecordToDriver, type OpenISDDriver } from '@openisd/design';
import { Workspace } from '../app/workspace.js';
import { Engine } from '@openisd/design/engine';

/** A conforming driver record, built inline so each test's data is readable where it is used. */
function aDriver(brand: string, model: string): OpenISDDriver {
  const scraped = <T,>(value: T) => ({ value });
  // A spec entry states no value of its own — the number lives on the reading `origin` names,
  // exactly as the corpus writes it.
  const num = (read_value: number) => ({ origin: 'test', readings: { test: { read_value } } });
  const driver = conformingRecordToDriver({
    brand: scraped(brand), model: scraped(model), manufacturer: scraped(brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    // The scrape provenance every openisd.yml record carries (`model_openisd.py:55-73`). A
    // fixture without them is not a record, and the conformance guard says so.
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    // `sku` is a DERIVED field: no origin, but `grounds` carrying the evidence it was
    // derived from, at least one entry.
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs: num(30), Sd: num(0.02), Cms: num(0.0005),
        Mms: num(0.05), Rms: num(2), Xmax: num(0.008),
      },
    },
  }, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not conforming: ${driver.join('; ')}`);
  return driver;
}

/** A clock whose every reading is later than the last, so orderings are assertable. */
function tickingClock(): () => string {
  let n = 0;
  return () => `2026-01-01T00:00:${String(n++).padStart(2, '0')}.000Z`;
}

let ws: Workspace;
beforeEach(() => { ws = assemble(memoryStore, tickingClock()).workspace; });

describe('focus is by uuid, not by position', () => {
  it('closing another project does not change which project is focused', () => {
    const a = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    const b = ws.create(aDriver('SEAS', 'A26'), 0.05);
    ws.focus(b.uuid());

    ws.close(a.uuid());     // an index-based focus would now point at the wrong project
    expect(ws.focused()?.uuid()).toBe(b.uuid());
  });

  it('closing the focused project falls back to another open one', () => {
    const a = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    const b = ws.create(aDriver('SEAS', 'A26'), 0.05);
    ws.close(b.uuid());
    expect(ws.focused()?.uuid()).toBe(a.uuid());
  });

  it('closing the last project leaves nothing focused — the empty state the UI must render', () => {
    const a = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    ws.close(a.uuid());
    expect(ws.focused()).toBeNull();
    expect(ws.projects()).toHaveLength(0);
  });
});

describe('the workspace cannot put anything in the store', () => {
  // NOT an oversight, and the tests that used to live here have been DELETED rather than
  // repaired: they asserted that a project reached the store on its own, which was autosave, and
  // autosave is gone (John 2026-08-27: "remove the autosave capability entirely"). `Workspace`
  // now has no save path at all, so nothing it does writes anything.
  //
  // What replaces them belongs with the persistence design (QO92): every project is to hold its
  // own stores and write ITSELF, at which point closing, reopening and deleting become testable
  // through the workspace again.
  it('stores nothing, however much a project is edited', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Never stored');
    p.box.sealed.volume_m3.set(0.099);
    expect(ws.stored()).toHaveLength(0);
  });

  it('closing a project drops it from memory', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    ws.close(p.uuid());
    expect(ws.projects()).toHaveLength(0);
  });
});
