/**
 * `SheetMode` — the Tune sheet and the What-if sheet: separate sheets with their own fields.
 * Tune: the box figures, power and drivers. What-if: those plus the driver's Fs, Qts and Vas.
 */
import {describe, expect, it} from 'vitest';
import {BOX_TYPE_OPTIONS} from '../../fields/options.js';
import {SheetField} from '../../fields/sheetField.js';
import {SheetMode} from '../../fields/sheetMode.js';

describe('SheetMode', () => {
  it('exposes TUNE, WHAT_IF and ALL', () => {
    expect(SheetMode.ALL).toEqual([SheetMode.TUNE, SheetMode.WHAT_IF]);
    expect(SheetMode.TUNE.label).toBe('Tune');
    expect(SheetMode.TUNE.edits).toBe('project');
    expect(SheetMode.WHAT_IF.label).toBe('What-if');
    expect(SheetMode.WHAT_IF.edits).toBe('whatIfLayer');
  });

  describe('Tune fields', () => {
    it.each(BOX_TYPE_OPTIONS.map(o => o.value))('are the %s box figures, power and drivers, one per line', (type) => {
      const expected = SheetField.forBox(type).filter(f => !SheetField.DRIVER_SPEC.includes(f));
      expect(SheetMode.TUNE.lines(type)).toEqual(expected.map(f => [f]));
    });

    it('never contain the driver Fs, Qts or Vas', () => {
      for (const o of BOX_TYPE_OPTIONS) {
        for (const line of SheetMode.TUNE.lines(o.value)) {
          for (const field of line) expect(SheetField.DRIVER_SPEC.includes(field)).toBe(false);
        }
      }
    });
  });

  describe('What-if fields', () => {
    it('are every box figure plus Fs, Qts and Vas, one per line', () => {
      for (const o of BOX_TYPE_OPTIONS) {
        const lines = SheetMode.WHAT_IF.lines(o.value);
        expect(lines.every(line => line.length === 1)).toBe(true);
        expect(lines.map(line => line[0])).toEqual(SheetField.forBox(o.value));
        for (const f of SheetField.DRIVER_SPEC) expect(lines.flat()).toContain(f);
      }
    });
  });

  describe('labelOf', () => {
    it('gives Tune real short names, never a bare letter, and What-if the full names', () => {
      for (const f of SheetField.ALL) {
        expect(SheetMode.TUNE.labelOf(f)).toBe(f.tuneLabel);
        expect(SheetMode.WHAT_IF.labelOf(f)).toBe(f.label);
      }
      for (const o of BOX_TYPE_OPTIONS) {
        for (const f of SheetMode.TUNE.lines(o.value).flat()) expect(f.tuneLabel.length).toBeGreaterThanOrEqual(5);
      }
      expect(SheetField.BOX_VOLUME.tuneLabel).toBe('Box volume');
      expect(SheetField.PR_ADDED_MASS.tuneLabel).toBe('Added mass');
      expect(SheetField.PR_COUNT.tuneLabel).toBe('Radiators');
      expect(SheetField.INPUT_POWER.tuneLabel).toBe('Power');
      expect(SheetField.DRIVER_COUNT.tuneLabel).toBe('Drivers');
    });
  });
});
