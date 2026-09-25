import { describe, it, expect } from 'vitest';
import { crosshairIndex } from '../../src/ui/canvas.js';

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
