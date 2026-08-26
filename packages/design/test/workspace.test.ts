/**
 * The prototype app (`app/workspace.ts`) driven through the published surface only.
 *
 * These are the tests that could not be written before there was an app: autosave firing from a
 * project's own notification, an UNFOCUSED project saving exactly like a focused one, focus
 * surviving a close, and closing leaving the store alone. Each is a behaviour the real app has to
 * have, and each was a QO92 question that a diagram could not settle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { composeInMemoryApp } from '../app/composition.js';
import { driverFromConformingRecord, type OpenISDDriver } from '@openisd/design';
import { Workspace } from '../app/workspace.js';

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
  });
  if (Array.isArray(driver)) throw new Error(`fixture is not conforming: ${driver.join('; ')}`);
  return driver;
}

/** A clock whose every reading is later than the last, so orderings are assertable. */
function tickingClock(): () => string {
  let n = 0;
  return () => `2026-01-01T00:00:${String(n++).padStart(2, '0')}.000Z`;
}

let ws: Workspace;
beforeEach(() => { ws = new Workspace(composeInMemoryApp(tickingClock())); });

describe('autosave fires from the project itself', () => {
  it('a new project is not stored until it is touched', () => {
    ws.create(aDriver('Dayton', 'RS225'), 0.03);
    expect(ws.stored()).toHaveLength(0);
  });

  it('an edit stores it, with no explicit save call anywhere', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.box.sealed.volume_m3.set(0.045);
    expect(ws.stored()).toHaveLength(1);
  });

  it('an UNFOCUSED project autosaves exactly like a focused one', () => {
    // The defect that sank the previous autosave: everything ran through one focused-project
    // signal, so an open-but-unfocused project's edits reached nothing (QO92).
    const first = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    first.name.set('First');
    ws.create(aDriver('SEAS', 'A26'), 0.05);          // focus moves to the second

    expect(ws.focused()?.uuid()).not.toBe(first.uuid());
    first.box.sealed.volume_m3.set(0.099);            // edit the UNFOCUSED one

    const stored = ws.stored().find(e => e.name === 'First');
    expect(stored, 'the unfocused project must have been stored').toBeDefined();
  });
});

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

describe('closing is not deleting', () => {
  it('a closed project stays in the store', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Kept');
    ws.close(p.uuid());
    expect(ws.stored().map(e => e.name)).toEqual(['Kept']);
  });

  it('a closed project stops autosaving — its edits no longer reach the store', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Closed');
    ws.close(p.uuid());

    const before = ws.stored()[0].modified;
    p.box.sealed.volume_m3.set(0.123);      // still reachable in the test; must not be written
    expect(ws.stored()[0].modified).toBe(before);
  });
});

describe('reopening a stored project', () => {
  it('comes back with its design, as a project in its own right', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Ported 8in v3');
    p.box.sealed.volume_m3.set(0.045);
    ws.close(p.uuid());

    const reopened = ws.open(ws.stored()[0].id);
    if (Array.isArray(reopened)) throw new Error(reopened.join('; '));
    expect(reopened.name.get()).toBe('Ported 8in v3');
    expect(reopened.box.sealed.volume_m3.get()).toBe(0.045);
  });

  it('editing it writes back to its own entry rather than duplicating the design', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Original');
    ws.close(p.uuid());

    const reopened = ws.open(ws.stored()[0].id);
    if (Array.isArray(reopened)) throw new Error(reopened.join('; '));
    reopened.box.sealed.volume_m3.set(0.05);
    expect(ws.stored()).toHaveLength(1);
  });

  it('opening one that is ALREADY open focuses it instead of loading a second copy', () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Only one of me');
    ws.create(aDriver('SEAS', 'A26'), 0.05);          // focus moves away

    const again = ws.open(p.uuid());
    expect(again).toBe(p);
    expect(ws.projects()).toHaveLength(2);
    expect(ws.focused()?.uuid()).toBe(p.uuid());
  });
});

describe('deleting a stored project', () => {
  it('is challenged, and leaves open projects alone', async () => {
    const p = ws.create(aDriver('Dayton', 'RS225'), 0.03);
    p.name.set('Doomed');
    const id = ws.stored()[0].id;

    expect(await ws.deleteStored(id, async () => false)).toBe('declined');
    expect(ws.stored()).toHaveLength(1);

    expect(await ws.deleteStored(id, async () => true)).toBe('deleted');
    expect(ws.stored()).toHaveLength(0);
    expect(ws.projects()).toHaveLength(1);   // still open, still editable
  });
});
