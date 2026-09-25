/**
 * `OpenISDProject.filters` (`@openisd/design`) — the WHOLE-array `SimpleField` the signal-chain
 * filter list lives on. There is no per-filter mutator on the domain object; a caller that wants
 * to add, patch or remove one filter reads the current array, builds the new one, and writes it
 * back with `set()`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDProject} from '@openisd/design';
import type {Filter} from '@openisd/design/engine';
import {Engine} from '@openisd/design/engine';

const hp = (id: string, fc: number): Filter => ({ id, type: 'highpass', enabled: true, fc, Q: 0.7071 });

function sealedProject() {
  const engine = new Engine();
  // This test is about box/vent/filter fields, not about any driver's contents, so the driver
  // states nothing — the domain's own blank rather than a record assembled here.
  const driver = OpenISDDriver.empty(engine);
  return OpenISDProject.builder(driver, engine).sealed().volume_m3(0.02).build();
}

describe('OpenISDProject.filters — whole-array read/write', () => {
  it('appending to the chain does not disturb existing filters', () => {
    const p = sealedProject();
    p.filters.set([...p.filters.value, hp('a', 80)]);
    p.filters.set([...p.filters.value, hp('b', 200)]);
    assert.deepEqual(p.filters.value.map(f => f.id), ['a', 'b']);
    assert.equal(p.filters.value[0].fc, 80);
    assert.equal(p.filters.value[1].fc, 200);
  });

  it('patching one field of one filter leaves its other fields and every other filter alone', () => {
    const p = sealedProject();
    p.filters.set([hp('a', 80), hp('b', 200)]);
    p.filters.set(p.filters.value.map(f => f.id === 'a' ? { ...f, fc: 120 } : f));
    assert.equal(p.filters.value.find(f => f.id === 'a')!.fc, 120, 'the patched field must land');
    assert.equal(p.filters.value.find(f => f.id === 'a')!.Q, 0.7071, 'an unpatched field must survive');
    assert.equal(p.filters.value.find(f => f.id === 'b')!.fc, 200, 'another filter must be untouched');
  });

  it('removing one filter drops exactly the named filter', () => {
    const p = sealedProject();
    p.filters.set([hp('a', 80), hp('b', 200), hp('c', 300)]);
    p.filters.set(p.filters.value.filter(f => f.id !== 'b'));
    assert.deepEqual(p.filters.value.map(f => f.id), ['a', 'c']);
  });

  it('every filters.set() notifies', () => {
    const p = sealedProject();
    let notified = 0;
    p.subscribe(() => notified++);
    p.filters.set([hp('a', 80)]);
    p.filters.set(p.filters.value.map(f => ({ ...f, fc: 90 })));
    p.filters.set([]);
    assert.equal(notified, 3, 'each filters.set() must notify once');
  });
});
