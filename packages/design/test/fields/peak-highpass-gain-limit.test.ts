/**
 * The Peaking 2nd order highpass Peak mag (Gpk) box stops at 0 dB when typing: a 2nd-order
 * high-pass cannot peak below its flat level (John, 18 Nov 2026, QO951.c9: "UI should not allow
 * and maths should do what you said anyway"). The limit and its note live in the field
 * definition; every other filter gain keeps -60..+60 dB. A negative Gpk that arrives from a file
 * is kept (the engine draws no curve and says so, T913), so only a typed edit is limited.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';
import {createEngine} from '../../engine/Engine.js';
import type {PeakHighpassFilter} from '../../engine/types.js';

const engine = createEngine();

describe('Peaking 2nd order highpass Peak mag limit', () => {
  it('accepts 0 to 60 dB', () => {
    expect(NumberField.FILTER_PEAK_HIGHPASS_GAIN_DB.limits).toEqual({min: 0, max: 60});
  });

  it('says why a value below 0 dB is refused', () => {
    expect(NumberField.FILTER_PEAK_HIGHPASS_GAIN_DB.minimumReason)
      .toBe('A 2nd-order high-pass cannot peak below its flat level.');
  });

  it('leaves every other filter gain at -60 to +60 dB, with no extra note', () => {
    expect(NumberField.FILTER_GAIN_DB.limits).toEqual({min: -60, max: 60});
    expect(NumberField.FILTER_GAIN_DB.minimumReason).toBeUndefined();
  });

  it('a typed Gpk below 0 dB is stored as 0 dB', () => {
    const base: PeakHighpassFilter = {type: 'peakHighpass', enabled: true, fpk: 50, gainPk: 6};
    expect(engine.filters.editPeakHighpass(base, {gainPk: -6}).gainPk).toBe(0);
  });

  it('a negative Gpk loaded from a file is kept when another value is edited', () => {
    const loaded: PeakHighpassFilter = {type: 'peakHighpass', enabled: true, fpk: 50, gainPk: -6};
    expect(engine.filters.editPeakHighpass(loaded, {fpk: 60}).gainPk).toBe(-6);
  });
});
