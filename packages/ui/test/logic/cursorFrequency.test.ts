/**
 * `cursorFrequency.ts` — the chart cursor's frequency arithmetic, extracted from
 * `OriginalShell.vue`'s inline `spinHz`/`commitHzInput` so it can be tested without mounting
 * a component. Pure: given a current frequency and the sweep's bounds, it answers what the
 * next frequency is. It never touches `presentationState`; the caller does that.
 *
 * Expected values are computed independently of the implementation — a multiplicative step is
 * one multiplication, so each case states the product rather than re-invoking the function.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { steppedFrequency, clampedFrequency } from '../../src/logic/cursorFrequency.js';

describe('steppedFrequency — one nudge of the chart cursor', () => {
  it('steps up by multiplying by the factor', () => {
    const next = steppedFrequency({ current: 1000, dir: 1, factor: 1.02, fmin: 1, fmax: 20000 });
    assert.equal(next, 1020);
  });

  it('steps down by dividing by the factor', () => {
    const next = steppedFrequency({ current: 1020, dir: -1, factor: 1.02, fmin: 1, fmax: 20000 });
    assert.ok(Math.abs(next - 1000) < 1e-9, `got ${next}`);
  });

  it('clamps an upward step to fmax', () => {
    const next = steppedFrequency({ current: 19900, dir: 1, factor: 1.02, fmin: 1, fmax: 20000 });
    assert.equal(next, 20000);
  });

  it('clamps a downward step to fmin', () => {
    // 10.2 / 1.05 = 9.714…, below the floor, so the floor is what comes back.
    const next = steppedFrequency({ current: 10.2, dir: -1, factor: 1.05, fmin: 10, fmax: 20000 });
    assert.equal(next, 10);
  });

  it('starts from the geometric mean of the bounds when there is no current frequency', () => {
    // No cursor pinned yet: the first nudge has to start somewhere, and the midpoint of a
    // log-frequency axis is the geometric mean, not the arithmetic one.
    const next = steppedFrequency({ current: null, dir: 1, factor: 1.02, fmin: 10, fmax: 40 });
    assert.ok(Math.abs(next - 20 * 1.02) < 1e-9, `got ${next}`);
  });

  it('honours a larger factor for a shift-modified nudge', () => {
    const next = steppedFrequency({ current: 1000, dir: 1, factor: 1.05, fmin: 1, fmax: 20000 });
    assert.ok(Math.abs(next - 1050) < 1e-9, `got ${next}`);
  });
});

describe('clampedFrequency — a typed-in frequency, committed', () => {
  it('accepts a value inside the bounds unchanged', () => {
    assert.equal(clampedFrequency(1234, 1, 20000), 1234);
  });

  it('clamps a value above fmax down to fmax', () => {
    assert.equal(clampedFrequency(999999, 1, 20000), 20000);
  });

  it('clamps a value below fmin up to fmin', () => {
    assert.equal(clampedFrequency(0.5, 1, 20000), 1);
  });

  it('rejects a non-numeric entry as null', () => {
    assert.equal(clampedFrequency(Number.NaN, 1, 20000), null);
  });

  it('rejects zero as null, because a log frequency axis has no zero', () => {
    assert.equal(clampedFrequency(0, 1, 20000), null);
  });

  it('rejects a negative entry as null', () => {
    assert.equal(clampedFrequency(-100, 1, 20000), null);
  });

  it('rejects infinity as null', () => {
    assert.equal(clampedFrequency(Number.POSITIVE_INFINITY, 1, 20000), null);
  });
});
