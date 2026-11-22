import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import {FrequencyAxis} from '../../chart/axis.js';

describe('FrequencyAxis', () => {
  describe('FrequencyAxis.step — one nudge of the chart cursor', () => {
    it('steps up by multiplying by the factor', () => {
      const next = new FrequencyAxis(1, 20000).step({ current: 1000, dir: 1, factor: 1.02 });
      assert.equal(next, 1020);
    });

    it('steps down by dividing by the factor', () => {
      const next = new FrequencyAxis(1, 20000).step({ current: 1020, dir: -1, factor: 1.02 });
      assert.ok(Math.abs(next - 1000) < 1e-9, `got ${next}`);
    });

    it('clamps an upward step to fmax', () => {
      const next = new FrequencyAxis(1, 20000).step({ current: 19900, dir: 1, factor: 1.02 });
      assert.equal(next, 20000);
    });

    it('clamps a downward step to fmin', () => {
      // 10.2 / 1.05 = 9.714…, below the floor, so the floor is what comes back.
      const next = new FrequencyAxis(10, 20000).step({ current: 10.2, dir: -1, factor: 1.05 });
      assert.equal(next, 10);
    });

    it('starts from the geometric mean of the bounds when there is no current frequency', () => {
      // No cursor pinned yet: the first nudge has to start somewhere, and the midpoint of a
      // log-frequency axis is the geometric mean, not the arithmetic one.
      const next = new FrequencyAxis(10, 40).step({ current: null, dir: 1, factor: 1.02 });
      assert.ok(Math.abs(next - 20 * 1.02) < 1e-9, `got ${next}`);
    });

    it('honours a larger factor for a shift-modified nudge', () => {
      const next = new FrequencyAxis(1, 20000).step({ current: 1000, dir: 1, factor: 1.05 });
      assert.ok(Math.abs(next - 1050) < 1e-9, `got ${next}`);
    });
  });

  describe('FrequencyAxis.clampTyped — a typed-in frequency, committed', () => {
    it('accepts a value inside the bounds unchanged', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(1234), 1234);
    });

    it('clamps a value above fmax down to fmax', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(999999), 20000);
    });

    it('clamps a value below fmin up to fmin', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(0.5), 1);
    });

    it('rejects a non-numeric entry as null', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(Number.NaN), null);
    });

    it('rejects zero as null, because a log frequency axis has no zero', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(0), null);
    });

    it('rejects a negative entry as null', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(-100), null);
    });

    it('rejects infinity as null', () => {
      assert.equal(new FrequencyAxis(1, 20000).clampTyped(Number.POSITIVE_INFINITY), null);
    });
  });

  describe('FrequencyAxis — mapping and grid', () => {
    const axis = new FrequencyAxis(10, 1000);

    it('maps a frequency to its fraction of the axis, log-spaced', () => {
      expect(axis.fraction(10)).toBe(0);
      expect(axis.fraction(100)).toBe(0.5);
      expect(axis.fraction(1000)).toBe(1);
    });

    it('maps a fraction back to a frequency', () => {
      expect(axis.at(0)).toBe(10);
      expect(axis.at(0.5)).toBe(100);
      expect(axis.at(1)).toBe(1000);
    });

    it('grid has 1…9 times each decade inside the range, majors on the decades, labels on 1, 2, 5', () => {
      const lines = axis.gridLines();
      expect(lines.length).toBe(19);
      expect(lines.filter(l => l.major).map(l => l.f)).toEqual([10, 100, 1000]);
      expect(lines.filter(l => l.labelled).map(l => l.f)).toEqual([10, 20, 50, 100, 200, 500, 1000]);
      expect(lines[2]).toEqual({ f: 30, major: false, labelled: false });
    });

    it('clamps a band to the axis ends', () => {
      expect(axis.clampBand(5, 2000)).toEqual({ lo: 10, hi: 1000 });
      expect(axis.clampBand(20, 50)).toEqual({ lo: 20, hi: 50 });
    });

    it('two frequencies are near when within 0.02 decades', () => {
      expect(axis.isNear(1000, 1004)).toBe(true);
      expect(axis.isNear(1000, 1100)).toBe(false);
    });
  });

  describe('FrequencyAxis labels', () => {
    const axis = new FrequencyAxis(10, 1000);

    it('tick: k suffix from 1 kHz, 2 dp under 10 kHz', () => {
      expect([0.5, 9.99, 10, 99.5, 100, 999, 1000, 9999, 10000, 19999, 20000].map(f => axis.tickLabel(f)))
        .toEqual(['1', '10', '10', '100', '100', '999', '1.00k', '10.00k', '10.0k', '20.0k', '20.0k']);
    });

    it('band edge: 1 dp under 100 Hz, none above', () => {
      expect(axis.bandLabel(12.34)).toBe('12.3');
      expect(axis.bandLabel(99.94)).toBe('99.9');
      expect(axis.bandLabel(100)).toBe('100');
    });

    it('cursor: 1 dp under 100 Hz, none above', () => {
      expect(axis.cursorLabel(99.94)).toBe('99.9');
      expect(axis.cursorLabel(100.4)).toBe('100');
    });
  });

  describe('FrequencyAxis.drag — pan and zoom from the drag-start axis', () => {
    const at10to1000 = new FrequencyAxis(10, 1000);
    const at1to10 = new FrequencyAxis(1, 10);
    const range = (a: FrequencyAxis | null) => a && { min: a.fmin, max: a.fmax };

    it('pan', () => {
      expect(range(at10to1000.drag('pan', 0.125))).toEqual({ min: 5.623413251903491, max: 562.341325190349 });
      expect(range(at1to10.drag('pan', -0.75))).toEqual({ min: 5.623413251903491, max: 56.23413251903491 });
    });

    it('zoomLo drags the low end', () => {
      expect(range(at10to1000.drag('zoomLo', 0.125))).toEqual({ min: 17.78279410038923, max: 1000 });
      expect(range(at1to10.drag('zoomLo', -0.75))).toEqual({ min: 1, max: 10 });
    });

    it('zoomHi drags the high end', () => {
      expect(range(at10to1000.drag('zoomHi', 0.125))).toEqual({ min: 10, max: 1778.2794100389228 });
      expect(range(at1to10.drag('zoomHi', -0.75))).toEqual({ min: 1, max: 1.7782794100389228 });
    });

    it('zoomSym zooms about the centre', () => {
      expect(range(at10to1000.drag('zoomSym', 0.125))).toEqual({ min: 13.33521432163324, max: 749.8942093324558 });
      expect(range(at1to10.drag('zoomSym', -0.75))).toEqual({ min: 1, max: 23.71373705661655 });
    });

    it('never goes below 1 Hz or above 40 kHz, and keeps 0.1 decade', () => {
      const low = at10to1000.drag('pan', 5);
      expect(low && low.fmin).toBe(1);
      expect(low && low.fmax).toBeCloseTo(Math.pow(10, 0.1), 9);
      // Pushed past 40 kHz the 0.1-decade floor lands a float hair under 0.1: the drag is refused.
      expect(at10to1000.drag('pan', -5)).toBeNull();
    });
  });

  describe('FrequencyAxis.crosshairIndex', () => {
    const axis = new FrequencyAxis(10, 200);
    it('finds the nearest sample when the cursor is within the data range', () => {
      const xs = [10, 20, 50, 100, 200];
      expect(axis.crosshairIndex(xs, 48)).toBe(2);
    });

    it('returns null when the cursor is left of the first sample', () => {
      // The chart axis (presentationState.sweepRange) can lead the throttled sweep data during a
      // fast drag — QO: "Max power chart, missing below 10Hz but cursor still shows a value".
      const xs = [10, 20, 50, 100, 200];
      expect(axis.crosshairIndex(xs, 9.5)).toBeNull();
    });

    it('returns null when the cursor is right of the last sample', () => {
      const xs = [10, 20, 50, 100, 200];
      expect(axis.crosshairIndex(xs, 250)).toBeNull();
    });

    it('returns null for an empty series', () => {
      expect(axis.crosshairIndex([], 50)).toBeNull();
    });

    it('accepts the exact endpoints', () => {
      const xs = [10, 20, 50, 100, 200];
      expect(axis.crosshairIndex(xs, 10)).toBe(0);
      expect(axis.crosshairIndex(xs, 200)).toBe(4);
    });
  });

  describe('FrequencyAxis.nearestIndex — nearest by log distance', () => {
    const axis = new FrequencyAxis(10, 200);
    it('45 is nearer 50 than 20 in log space, 30 is nearer 20 than 50', () => {
      expect(axis.nearestIndex([10, 20, 50, 100], 45)).toBe(2);
      expect(axis.nearestIndex([10, 20, 50, 100], 30)).toBe(1);
    });

    it('log distance, not linear: 40 is nearer 20 (ratio 2) than 100 (ratio 2.5)', () => {
      expect(axis.nearestIndex([20, 100], 40)).toBe(0);
    });
  });
});
