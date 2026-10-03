import {describe, it, expect} from 'vitest';
import {linearTicks, logTicks} from '../../chart/ticks.js';

// BUG_20261001_chart-tick-loop-hangs-and-crashes-on-tiny-y-range: the VA chart under a steep
// cutoff spans 0 … 1.5e-20; an absolute 1e-9 end margin stepped ~1e11 ticks and crashed the app.
describe('linearTicks', () => {
  it('a normal range gets round ticks covering it', () => {
    expect(linearTicks(-50, 5, 300).ticks).toEqual([-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5]);
  });

  it('reports the step and its decade', () => {
    expect(linearTicks(0, 100, 300)).toEqual({ ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], step: 10, mag: 10 });
    expect(linearTicks(0.2, 0.9, 200)).toEqual({ ticks: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], step: 0.1, mag: 0.1 });
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

describe('logTicks', () => {
  it('1, 2, 5 per decade inside the range', () => {
    expect(logTicks(10, 1000)).toEqual([10, 20, 50, 100, 200, 500, 1000]);
    expect(logTicks(0.5, 30)).toEqual([0.5, 1, 2, 5, 10, 20]);
    expect(logTicks(3, 7)).toEqual([5]);
    expect(logTicks(1e-3, 1)).toEqual([0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]);
  });
});
