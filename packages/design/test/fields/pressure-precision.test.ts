import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';
// John, 10 Nov 2026: "ap doesn't need 2 dp". Air pressure is shown whole in Pa; the other units keep the
// decimals the unit shift gives (kPa three, atm five), so the figure stays as exact as in Pa.
describe('Air pressure shows no decimals in Pa', () => {
  it('101325 Pa is 101325', () => {
    expect(NumberField.ADV_PRESSURE_KPA.format(101325, undefined, 'Pa')).toBe('101325');
  });
  it('kPa keeps three decimals, atm five', () => {
    expect(NumberField.ADV_PRESSURE_KPA.format(101325, undefined, 'kPa')).toBe('101.325');
    expect(NumberField.ADV_PRESSURE_KPA.format(101325, undefined, 'atm')).toBe('1.00');
    expect(NumberField.ADV_PRESSURE_KPA.format(99000, undefined, 'atm')).toBe('0.97705');
  });
});
