import {describe, it, expect} from 'vitest';
import {LevelAxis} from '../../chart/axis.js';

describe('LevelAxis', () => {
  describe('LevelAxis labels', () => {
    const axis = new LevelAxis(0, 10, false);

    it('tick: k suffix from 1000, fewer decimals as magnitude grows', () => {
      expect([-1500, -1000, -12.34, -10, -1.5, -1, 0.5, 0, 0.004, 999.9, 1000, 25000].map(v => axis.tickLabel(v)))
        .toEqual(['-1.5k', '-1.0k', '-12', '-10', '-1.5', '-1.0', '0.50', '0.00', '0.00', '1000', '1.0k', '25.0k']);
    });

    it('readout: dash for non-finite, decimals by magnitude, unit appended', () => {
      expect(axis.readout(Number.NaN, 'dB')).toBe('—');
      expect(axis.readout(Number.POSITIVE_INFINITY, 'dB')).toBe('—');
      expect(axis.readout(100.4, 'dB')).toBe('100 dB');
      expect(axis.readout(-100.4, 'dB')).toBe('-100 dB');
      expect(axis.readout(10, 'dB')).toBe('10.0 dB');
      expect(axis.readout(9.99, 'W')).toBe('9.99 W');
      expect(axis.readout(0.123, 'W')).toBe('0.12 W');
    });

    it('band statistic: 1 dp', () => {
      expect(axis.statLabel(1.234)).toBe('1.2');
    });
  });

  describe('LevelAxis — mapping, validity, ticks', () => {
    it('maps a value to its fraction, linear and log', () => {
      const lin = new LevelAxis(-40, 10, false);
      expect(lin.fraction(-40)).toBe(0);
      expect(lin.fraction(-15)).toBe(0.5);
      expect(lin.fraction(10)).toBe(1);
      expect(new LevelAxis(0.1, 100, true).fraction(1)).toBeCloseTo(1 / 3, 12);
    });

    it('overridden: a finite ascending range replaces the axis; a log range must be positive', () => {
      const lin = new LevelAxis(0, 10, false), log = new LevelAxis(1, 10, true);
      const range = (a: LevelAxis | null) => a && { min: a.min, max: a.max, logy: a.logy };
      expect(range(lin.overridden(1, 2))).toEqual({ min: 1, max: 2, logy: false });
      expect(range(lin.overridden(-1, 1))).toEqual({ min: -1, max: 1, logy: false });
      expect(lin.overridden(2, 1)).toBeNull();
      expect(lin.overridden(Number.NaN, 1)).toBeNull();
      expect(lin.overridden(0, Number.POSITIVE_INFINITY)).toBeNull();
      expect(range(log.overridden(0.5, 5))).toEqual({ min: 0.5, max: 5, logy: true });
      expect(log.overridden(-1, 1)).toBeNull();
      expect(log.overridden(0, 1)).toBeNull();
    });

    it('linear ticks: round values, majors on multiples of ten steps, all labelled', () => {
      const t = new LevelAxis(0, 100, false).ticks(300);
      expect(t.map(x => x.value)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      expect(t.filter(x => x.major).map(x => x.value)).toEqual([0, 100]);
      expect(t.every(x => x.labelled)).toBe(true);
      const u = new LevelAxis(-20, 20, false).ticks(400);
      expect(u.filter(x => x.major).map(x => x.value)).toEqual([-20, -10, 0, 10, 20]);
    });

    it('log ticks: 1, 2, 5 per decade, majors and labels on the decades only', () => {
      const t = new LevelAxis(10, 1000, true).ticks(300);
      expect(t.map(x => x.value)).toEqual([10, 20, 50, 100, 200, 500, 1000]);
      expect(t.filter(x => x.major).map(x => x.value)).toEqual([10, 100, 1000]);
      expect(t.filter(x => x.labelled).map(x => x.value)).toEqual([10, 100, 1000]);
    });
  });

  describe('LevelAxis.drag — pan and zoom in display space', () => {
    const range = (a: LevelAxis | null) => a && { min: a.min, max: a.max };
    const lin = new LevelAxis(-40, 10, false);
    const log = new LevelAxis(0.1, 100, true);
    const zero = new LevelAxis(0, 10, false);

    it('pan', () => {
      expect(range(lin.drag('pan', 0.15))).toEqual({ min: -47.5, max: 2.5 });
      expect(range(log.drag('pan', -0.3))).toEqual({ min: 0.7943282347242813, max: 794.3282347242814 });
      expect(range(zero.drag('pan', 2))).toEqual({ min: -20, max: -10 });
    });

    it('zoomTop drags the top end; collapsing past 5 % of the span is refused', () => {
      expect(range(lin.drag('zoomTop', 0.15))).toEqual({ min: -40, max: 2.5 });
      expect(range(log.drag('zoomTop', -0.3))).toEqual({ min: 0.1, max: 794.3282347242814 });
      expect(zero.drag('zoomTop', 2)).toBeNull();
    });

    it('zoomBot drags the bottom end', () => {
      expect(range(lin.drag('zoomBot', 0.15))).toEqual({ min: -47.5, max: 10 });
      expect(range(log.drag('zoomBot', -0.3))).toEqual({ min: 0.7943282347242813, max: 100 });
      expect(range(zero.drag('zoomBot', 2))).toEqual({ min: -20, max: 10 });
    });

    it('zoomSym zooms about the centre', () => {
      expect(range(lin.drag('zoomSym', 0.15))).toEqual({ min: -43.75, max: 13.749999999999996 });
      expect(range(log.drag('zoomSym', -0.3))).toEqual({ min: 0.2818382931264455, max: 35.481338923357534 });
      expect(range(zero.drag('zoomSym', 2))).toEqual({ min: -10, max: 20 });
    });
  });
});
