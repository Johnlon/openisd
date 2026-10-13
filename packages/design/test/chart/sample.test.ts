import {describe, it, expect} from 'vitest';
import {crossingFrequency, interpolatedY, snapFrequency} from '../../chart/sample.js';

describe('snapFrequency — nearest peak or trough on one side of the cursor', () => {
  const xs = [10, 20, 50, 100, 200, 500];
  const ys = [0, 5, 2, 8, 1, 3]; // peaks at 20 and 100, troughs at 50 and 200

  it('max to the left / right of a frequency', () => {
    expect(snapFrequency(xs, ys, 60, 'left', 'max')).toBe(20);
    expect(snapFrequency(xs, ys, 60, 'right', 'max')).toBe(100);
  });

  it('min to the left / right of a frequency', () => {
    expect(snapFrequency(xs, ys, 60, 'left', 'min')).toBe(50);
    expect(snapFrequency(xs, ys, 60, 'right', 'min')).toBe(200);
  });

  it('the nearest by log frequency wins among those on that side', () => {
    expect(snapFrequency(xs, ys, 400, 'left', 'min')).toBe(200);
    expect(snapFrequency(xs, ys, 400, 'left', 'max')).toBe(100);
  });

  it('with no frequency, measures from the middle sample and searches the whole series', () => {
    expect(snapFrequency(xs, ys, null, 'left', 'max')).toBe(100);
    // 50 and 200 are equally far from 100 in log space: the first wins.
    expect(snapFrequency(xs, ys, null, 'right', 'min')).toBe(50);
  });

  it('null when nothing qualifies, and non-finite samples never do', () => {
    expect(snapFrequency(xs, ys, 5, 'left', 'max')).toBeNull();
    expect(snapFrequency([1, 2, 3], [1, 2, 3], 2, 'right', 'max')).toBeNull();
    expect(snapFrequency([1, 2, 3], [0, Number.NaN, 0], null, 'left', 'max')).toBeNull();
  });
});

describe('interpolatedY', () => {
  it('interpolates linearly between the straddling points', () => {
    expect(interpolatedY([10, 100, 1000], [0, 10, 40], 31.6227766)).toBe(2.4025307333333332);
    expect(interpolatedY([10, 100, 1000], [0, 10, 40], 550)).toBe(25);
  });

  it('holds the end values outside the series', () => {
    expect(interpolatedY([10, 100], [1, 2], 5)).toBe(1);
    expect(interpolatedY([10, 100], [1, 2], 500)).toBe(2);
  });
});

describe('crossingFrequency — lowest frequency where the trace reaches a level', () => {
  const xs = [10, 20, 40, 80, 160];
  const ys = [-20, -8, -2, 0, -1];

  it('interpolates linearly between the two samples straddling the level', () => {
    expect(crossingFrequency(xs, ys, -5)).toBeCloseTo(20 + 20 * (3 / 6), 10);
  });

  it('a sample exactly on the level is the crossing', () => {
    expect(crossingFrequency(xs, ys, -2)).toBe(40);
  });

  it('the lowest crossing wins when the trace dips back below the level', () => {
    expect(crossingFrequency([10, 20, 40, 80], [-9, -1, -9, -1], -3)).toBeCloseTo(10 + 10 * (6 / 8), 10);
  });

  it('a trace already at or above the level at its first sample crosses at that sample', () => {
    expect(crossingFrequency(xs, ys, -30)).toBe(10);
  });

  it('null when the trace never reaches the level', () => {
    expect(crossingFrequency(xs, ys, 5)).toBeNull();
  });

  it('non-finite samples are skipped', () => {
    expect(crossingFrequency([10, 20, 40], [NaN, -8, -2], -5)).toBeCloseTo(20 + 20 * (3 / 6), 10);
  });
});
