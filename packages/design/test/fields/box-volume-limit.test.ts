import {describe, it, expect} from 'vitest';
import {NumberField} from '../../fields/field.js';
import {DEFAULT_VENTED_DESIGN_LIMITS} from '../../engine/appSettings.js';

// 10 m3 = 10,000 L: far beyond any speaker box, and the longest value fits the phone Box tab's box in every unit (QO946.c187, lead).
const TEN_THOUSAND_LITRES_M3 = 10;
// The factory vented design band tops out at 100 L, whatever the Vb box accepts.
const ONE_HUNDRED_LITRES_M3 = 0.1;

describe('box volume top limit', () => {
  it('the net enclosure volume tops out at 10,000 L', () => {
    expect(NumberField.BOX_VB_L.limits.max).toBe(TEN_THOUSAND_LITRES_M3);
  });
  it('the bandpass front chamber volume tops out at 10,000 L', () => {
    expect(NumberField.BOX_VF_L.limits.max).toBe(TEN_THOUSAND_LITRES_M3);
  });
});

describe('the vented design band does not follow the Vb box limit', () => {
  it('keeps its own 100 L top while the box accepts up to 10,000 L', () => {
    expect(DEFAULT_VENTED_DESIGN_LIMITS.maxVb_m3).toBe(ONE_HUNDRED_LITRES_M3);
    expect(DEFAULT_VENTED_DESIGN_LIMITS.maxVb_m3).not.toBe(NumberField.BOX_VB_L.limits.max);
  });
  it('never allows a volume the box refuses', () => {
    expect(DEFAULT_VENTED_DESIGN_LIMITS.minVb_m3).toBeGreaterThanOrEqual(NumberField.BOX_VB_L.limits.min);
    expect(DEFAULT_VENTED_DESIGN_LIMITS.maxVb_m3).toBeLessThanOrEqual(NumberField.BOX_VB_L.limits.max);
  });
});
