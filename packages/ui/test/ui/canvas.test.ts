import { describe, it, expect } from 'vitest';
import { crosshairIndex, linearTicks } from '../../src/ui/canvas.js';

describe('crosshairIndex', () => {
  it('finds the nearest sample when the cursor is within the data range', () => {
    const xs = [10, 20, 50, 100, 200];
    expect(crosshairIndex(xs, 48)).toBe(2);
  });

  it('returns null when the cursor is left of the first sample', () => {
    // The chart axis (presentationState.sweepRange) can lead the throttled sweep data during a
    // fast drag — QO: "Max power chart, missing below 10Hz but cursor still shows a value".
    const xs = [10, 20, 50, 100, 200];
    expect(crosshairIndex(xs, 9.5)).toBeNull();
  });

  it('returns null when the cursor is right of the last sample', () => {
    const xs = [10, 20, 50, 100, 200];
    expect(crosshairIndex(xs, 250)).toBeNull();
  });

  it('returns null for an empty series', () => {
    expect(crosshairIndex([], 50)).toBeNull();
  });

  it('accepts the exact endpoints', () => {
    const xs = [10, 20, 50, 100, 200];
    expect(crosshairIndex(xs, 10)).toBe(0);
    expect(crosshairIndex(xs, 200)).toBe(4);
  });
});

// BUG_20261001_chart-tick-loop-hangs-and-crashes-on-tiny-y-range: the VA chart under a steep
// cutoff spans 0 … 1.5e-20; an absolute 1e-9 end margin stepped ~1e11 ticks and crashed the app.
describe('linearTicks', () => {
  it('a normal range gets round ticks covering it', () => {
    expect(linearTicks(-50, 5, 300).ticks).toEqual([-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5]);
  });

  it('a tiny range gets a handful of ticks, not billions', () => {
    const { ticks } = linearTicks(0, 1.48e-20, 300);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThan(20);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(1.48e-20 * (1 + 1e-9));
  });

  it('a vanishingly tiny range terminates too', () => {
    expect(linearTicks(0, 1.5e-260, 300).ticks.length).toBeLessThan(20);
  });

  it('huge values with a narrow span terminate', () => {
    expect(linearTicks(1e18, 1e18 + 256, 300).ticks.length).toBeLessThan(20);
  });

  it('a zero, reversed or non-finite range has no ticks', () => {
    for (const [lo, hi] of [[5, 5], [5, 0], [NaN, 5], [0, Infinity], [-Infinity, 0]])
      expect(linearTicks(lo, hi, 300).ticks, `${lo} … ${hi}`).toEqual([]);
  });
});
