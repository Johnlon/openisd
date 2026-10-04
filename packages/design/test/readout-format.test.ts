import {describe, it, expect} from 'vitest';
import {NumberField, ReadoutFormat} from '../fields/index.js';

describe('ReadoutFormat — decimals of a readout that is not a registered field', () => {
  it('each member shows its own decimals', () => {
    expect(ReadoutFormat.QTC.text(0.7071, '—')).toBe('0.707');
    expect(ReadoutFormat.EBP.text(52.34, '—')).toBe('52.3');
    expect(ReadoutFormat.ALIGNMENT_VOLUME_L.text(12.345, '')).toBe('12.35');
    expect(ReadoutFormat.TUNING_HZ.text(34.56, '—')).toBe('34.6');
    expect(ReadoutFormat.PROJECT_VOLUME_L.text(12.345, '--')).toBe('12.3');
    expect(ReadoutFormat.CURSOR_FREQUENCY_HZ.text(1000, '—')).toBe('1000.00');
    expect(ReadoutFormat.CURSOR_LEVEL.text(-3.0103, '—')).toBe('-3.010');
  });

  it('a missing value shows the caller\'s placeholder; a number is never shown as the placeholder', () => {
    expect(ReadoutFormat.QTC.text(null, '--')).toBe('--');
    expect(ReadoutFormat.QTC.text(undefined, '')).toBe('');
    expect(ReadoutFormat.QTC.text(0, '--')).toBe('0.000');
  });
});

describe('NumberField.fixed — a value at the field\'s own registry precision', () => {
  it('shows the SI value to the field\'s precision', () => {
    const f = NumberField.ADV_SOUNDVELOCITY_M_PER_S;
    expect(f.fixed(343.2351)).toBe((343.2351).toFixed(f.precision));
    const rho = NumberField.ADV_AIRDENSITY_KG_PER_M3;
    expect(rho.fixed(1.20412)).toBe((1.20412).toFixed(rho.precision));
  });
});
