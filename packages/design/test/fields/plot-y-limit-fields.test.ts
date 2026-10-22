/**
 * The Options dialog's per-chart Y limit boxes are field rows. Their bounds live on these
 * fields, one per unit a chart axis is drawn in, not as a literal in the dialog.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

const Y_FIELDS = [
  ['PLOT_Y_DB', 'dB'], ['PLOT_Y_DEG', 'deg'], ['PLOT_Y_MM', 'mm'], ['PLOT_Y_OHM', 'Ω'],
  ['PLOT_Y_MS', 'ms'], ['PLOT_Y_W', 'W'], ['PLOT_Y_MPS', 'm/s'],
] as const;

describe('plot Y limit fields', () => {
  for (const [name, unit] of Y_FIELDS) {
    it(`${name} bounds an axis end to -10000..100000 and shows ${unit}`, () => {
      const field = NumberField[name];
      expect(field.limits).toEqual({min: -10000, max: 100000});
      expect(field.unitLabel()).toBe(unit);
    });
  }
});
