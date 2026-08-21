/**
 * `ManagedOpenISDProject`'s per-filter mutators — `addFilter`/`removeFilter`/`setFilter(id,
 * patch)` — the API `OgFilters.vue` binds directly to (no live mirror array, no deep watch).
 *
 * `setFilters(whole array)` already existed for a caller that legitimately replaces the WHOLE
 * chain (a project restore). A component editing one field of one filter needs a narrower
 * write: patching by id, so a keystroke never has to read-modify-write an array copy that a
 * concurrent pull (a project reset, a what-if cancel) could replace out from under it mid-edit
 * — exactly the failure a live mirror + deep watch has (`bugs/BUG_20260821_*`-adjacent finding,
 * reviewer finding on OgFilters.vue).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ManagedOpenISDProject } from '../../src/logic/managedProject.js';
import type { Filter } from '@openisd/engine';

const hp = (id: string, fc: number): Filter => ({ id, type: 'highpass', enabled: true, fc, Q: 0.7071 });

describe('ManagedOpenISDProject — per-filter mutators', () => {
  it('addFilter appends to the chain without disturbing existing filters', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.addFilter(hp('a', 80));
    mp.addFilter(hp('b', 200));
    assert.deepEqual(mp.filters().map(f => f.id), ['a', 'b']);
    assert.equal(mp.filters()[0].fc, 80);
    assert.equal(mp.filters()[1].fc, 200);
  });

  it('setFilter patches one field of the named filter, leaving its other fields and every other filter alone', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.addFilter(hp('a', 80));
    mp.addFilter(hp('b', 200));
    mp.setFilter('a', { fc: 120 });
    assert.equal(mp.filters().find(f => f.id === 'a')!.fc, 120, 'the patched field must land');
    assert.equal(mp.filters().find(f => f.id === 'a')!.Q, 0.7071, 'an unpatched field must survive');
    assert.equal(mp.filters().find(f => f.id === 'b')!.fc, 200, 'another filter must be untouched');
  });

  it('setFilter on an unknown id is a no-op, not a crash or a fabricated filter', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.addFilter(hp('a', 80));
    mp.setFilter('does-not-exist', { fc: 999 });
    assert.deepEqual(mp.filters().map(f => f.id), ['a']);
    assert.equal(mp.filters()[0].fc, 80);
  });

  it('removeFilter drops exactly the named filter', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    mp.addFilter(hp('a', 80));
    mp.addFilter(hp('b', 200));
    mp.addFilter(hp('c', 300));
    mp.removeFilter('b');
    assert.deepEqual(mp.filters().map(f => f.id), ['a', 'c']);
  });

  it('every per-filter mutator notifies', () => {
    const mp = ManagedOpenISDProject.createEmpty();
    let notified = 0;
    mp.subscribe(() => notified++);
    mp.addFilter(hp('a', 80));
    mp.setFilter('a', { fc: 90 });
    mp.removeFilter('a');
    assert.equal(notified, 3, 'addFilter, setFilter and removeFilter must each notify once');
  });
});
