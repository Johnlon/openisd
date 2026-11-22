/**
 * `OpenISDProject.filters` (`@openisd/design`) — the WHOLE-array `SimpleField` the signal-chain
 * filter list lives on. There is no per-filter mutator on the domain object; a caller that wants
 * to add, patch or remove one filter reads the current array, builds the new one, and writes it
 * back with `set()`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import type {Filter} from '@openisd/design/engine';
import {createEngine} from '@openisd/design/engine';

const hp = (id: string, fc: number): Filter => ({ id, type: 'highpass', family: 'sos', order: 2, enabled: true, fc, Q: 0.7071 });

/** Every filter this test builds is a highpass from `hp()` above; narrows the whole-array read
 *  back to that one variant so `.fc` is a known field, not a Filter-union guess. */
function fcOf(f: Filter): number {
  if (f.type !== 'highpass') throw new Error('expected a highpass filter');
  return f.fc;
}

function sealedProject() {
  const engine = createEngine();
  // This test is about box/vent/filter fields, not about any driver's contents, so the driver
  // states nothing — the domain's own blank rather than a record assembled here.
  const driver = OpenISDDriver.empty(engine);
  return new ProjectBuilder(driver, engine).sealed().volume_m3(0.02).build();
}

describe('OpenISDProject.filters — whole-array read/write', () => {
  it('appending to the chain does not disturb existing filters', () => {
    const p = sealedProject();
    p.filters.set([...p.filters.value, hp('a', 80)]);
    p.filters.set([...p.filters.value, hp('b', 200)]);
    assert.deepEqual(p.filters.value.map(f => f.id), ['a', 'b']);
    assert.equal(fcOf(p.filters.value[0]), 80);
    assert.equal(fcOf(p.filters.value[1]), 200);
  });

  it('patching one field of one filter leaves its other fields and every other filter alone', () => {
    const p = sealedProject();
    p.filters.set([hp('a', 80), hp('b', 200)]);
    p.filters.set(p.filters.value.map(f => (f.id === 'a' && f.type === 'highpass') ? { ...f, fc: 120 } : f));
    const a = p.filters.value.find(f => f.id === 'a');
    const b = p.filters.value.find(f => f.id === 'b');
    assert.ok(a && a.type === 'highpass');
    assert.ok(b && b.type === 'highpass');
    assert.equal(a.fc, 120, 'the patched field must land');
    assert.equal(a.Q, 0.7071, 'an unpatched field must survive');
    assert.equal(b.fc, 200, 'another filter must be untouched');
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
