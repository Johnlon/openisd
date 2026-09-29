/**
 * A project stamps its own Modified date: the write that takes it from saved to having unsaved
 * changes sets `modified` from the app context's clock; later writes leave it until the next save. Domain behaviour, so every skin gets it
 * (BUG_20260929_modified-date-only-stamped-by-original-shell).
 */
import {describe, expect, it} from 'vitest';
import {type AppContext, OpenISDProject} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

function clock(isoDate: string): AppContext {
  return {newId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date(isoDate), platformUser: () => null};
}

describe('OpenISDProject stamps modified on edit', () => {
  it('the first edit stamps modified with the context clock', () => {
    const p = OpenISDProject.empty(createEngine(), clock('2026-03-04T12:00:00.000Z'));
    p.modified.set('20200101');
    p.save();
    p.name.set('Edited');
    expect(p.modified.value).toBe('20260304');
  });

  it('a nested driver edit stamps too', () => {
    const p = OpenISDProject.empty(createEngine(), clock('2026-03-04T12:00:00.000Z'));
    p.modified.set('20200101');
    p.save();
    p.driver.model.set('RS225');
    expect(p.modified.value).toBe('20260304');
  });

  it('later edits before a save leave the stamp alone', () => {
    const p = OpenISDProject.empty(createEngine(), clock('2026-03-04T12:00:00.000Z'));
    p.save();
    p.name.set('Edited');
    p.modified.set('20200101');
    p.description.set('Again');
    expect(p.modified.value).toBe('20200101');
  });

  it('setting modified itself is kept as set', () => {
    const p = OpenISDProject.empty(createEngine(), clock('2026-03-04T12:00:00.000Z'));
    p.save();
    p.modified.set('');
    expect(p.modified.value).toBe('');
  });

  it('a chart view change is not an edit, so it does not stamp', () => {
    const p = OpenISDProject.empty(createEngine(), clock('2026-03-04T12:00:00.000Z'));
    p.modified.set('20200101');
    p.save();
    p.openCharts.showOnly('SPL');
    expect(p.isModified()).toBe(false);
    expect(p.modified.value).toBe('20200101');
  });
});
