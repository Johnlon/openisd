import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

// WinISD names both chambers' boxes "Volume" and "Tuning freq."; the chamber is named by its
// heading (Rear chamber / Front chamber). OpenISD adds the symbol in brackets, same on both sides.
describe('ABC / bandpass chamber field labels', () => {
  it('rear and front volume are both "Volume"', () => {
    expect(NumberField.BOX_VB_L.label).toBe('Volume');
    expect(NumberField.BOX_VF_L.label).toBe('Volume');
  });

  it('rear and front tuning say the same words, differing only in the symbol', () => {
    expect(NumberField.BOX_FRC_HZ.label).toBe('Tuning freq (Frc)');
    expect(NumberField.BOX_FFC_HZ.label).toBe('Tuning freq (Ffc)');
  });
});

describe('tuning fields', () => {
  it('no tuning label says "Target"; every tuning help says it is a goal the box may not reach', () => {
    for (const f of [NumberField.BOX_FB_HZ, NumberField.BOX_FRC_HZ, NumberField.BOX_FFC_HZ]) {
      expect(f.label).not.toMatch(/target/i);
      expect(f.description).toContain('The tuning is a goal; the box may not reach it.');
    }
  });
});
