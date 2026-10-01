/**
 * `NumberField.rounded` — a value at the field's own display precision. The Options dialog shows
 * the plot frequency range this way: a drag-zoomed axis stores e.g. 13.478123 Hz, which the
 * dialog showed to every digit (John, 2026-10-01: "unreasonably over precise").
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

describe('NumberField.rounded', () => {
  it('rounds to the field\'s precision', () => {
    expect(NumberField.PLOT_FMIN_HZ.rounded(13.478123)).toBe(13.5);
    expect(NumberField.PLOT_FMAX_HZ.rounded(19987.3456)).toBe(19987.3);
  });

  it('keeps a value already at that precision', () => {
    expect(NumberField.PLOT_FMIN_HZ.rounded(10)).toBe(10);
  });

  it('the plot range fields carry the Options limits', () => {
    expect(NumberField.PLOT_FMIN_HZ.limits).toEqual({min: 1, max: 20000});
    expect(NumberField.PLOT_FMAX_HZ.limits).toEqual({min: 1, max: 40000});
  });
});
