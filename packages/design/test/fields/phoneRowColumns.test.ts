import {describe, expect, it} from 'vitest';
import {PhoneRowColumns} from '../../fields/index.js';

describe('PhoneRowColumns', () => {
  it('lists every column but the label column for a root that measures its own', () => {
    const all = PhoneRowColumns.STANDARD.cssVars();
    const rest = PhoneRowColumns.STANDARD.cssVarsWithoutLabelColumn();
    expect(all.has(PhoneRowColumns.LABEL_COLUMN_VAR)).toBe(true);
    expect(rest.has(PhoneRowColumns.LABEL_COLUMN_VAR)).toBe(false);
    expect(rest.size).toBe(all.size - 1);
  });
  it('gives the one mobile column set one control inset and permanent cue-rail dimensions', () => {
    for (const columns of [PhoneRowColumns.STANDARD]) {
      expect(columns.cssVars().get('--mob-col-gutter')).toBe('16px');
      expect(columns.cssVars().get('--mob-col-dq')).toBe('26px');
      expect(columns.cssVars().get('--mob-col-model')).toBe('24px');
    }
  });
  it('provides a wide unit column so warning and difference cues can reserve its space', () => {
    expect(PhoneRowColumns.STANDARD.cssVars().get('--mob-col-chip-wide')).toBe('50px');
  });

  it('reserves the wide column for multi-character compound units', () => {
    for (const unit of ['mm/N', 'Ns/m', '1000/K', 'kg/m³']) expect(PhoneRowColumns.chipIsWide(unit)).toBe(true);
    for (const unit of ['Hz', 'L', 'Ω', 'mm']) expect(PhoneRowColumns.chipIsWide(unit)).toBe(false);
  });

  it('sizes the phone Signal typing box to the longest value its three fields show (T720, rule 11)', () => {
    // System input power tops out at 100000.00 W: 9 characters; the volts and the series resistance need 7.
    expect(PhoneRowColumns.signalInputChars()).toBe(9);
    expect(PhoneRowColumns.STANDARD.cssVars().get('--mob-col-input-chars')).toBe('9');
  });
});
