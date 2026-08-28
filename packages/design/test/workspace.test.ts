/**
 * The prototype app (`app/workspace.ts`) driven through the published surface only.
 *
 * These are the tests that could not be written before there was an app: focus surviving a close,
 * and closing leaving the store alone.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { assemble } from '../app/composition.js';
import { memoryStore } from '@openisd/design/browser';
import { driverFromConformingRecord, type OpenISDDriver } from '@openisd/design';
import { Workspace } from '../app/workspace.js';
import { Engine } from '@openisd/design/engine';

/** A conforming driver record, built inline so each test's data is readable where it is used. */
function aDriver(brand: string, model: string): OpenISDDriver {
  const scraped = (value: string) => ({ value, origin: 'test' });
  const num = (value: number) => ({ value, origin: 'test' });
  const driver = driverFromConformingRecord({
    brand: scraped(brand), model: scraped(model), manufacturer: scraped(brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    woofer: {
      Fs_hz: num(30), Sd_m2: num(0.02), Cms_m_per_N: num(0.0005),
      Mmd_kg: num(0.05), Rms_Ns_per_m: num(2), Xmax_m: num(0.008),
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
