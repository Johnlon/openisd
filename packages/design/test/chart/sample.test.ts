import {describe, it, expect} from 'vitest';
import {interpolatedY, snapFrequency} from '../../chart/sample.js';

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
