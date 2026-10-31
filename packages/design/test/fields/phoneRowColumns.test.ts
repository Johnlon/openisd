import {describe, expect, it} from 'vitest';
import {PhoneRowColumns} from '../../fields/index.js';

describe('PhoneRowColumns', () => {
  it('gives every mobile label preset one control inset and permanent cue-rail dimensions', () => {
    for (const columns of [PhoneRowColumns.STANDARD, PhoneRowColumns.MEDIUM_LABEL, PhoneRowColumns.WIDE_LABEL]) {
      expect(columns.cssVars().get('--mob-col-gutter')).toBe('16px');
      expect(columns.cssVars().get('--mob-col-dq')).toBe('26px');
      expect(columns.cssVars().get('--mob-col-model')).toBe('24px');
    }
  });
  it('provides a wide unit column so warning and difference cues can reserve its space', () => {
    expect(PhoneRowColumns.STANDARD.cssVars().get('--mob-col-chip-wide')).toBe('60px');
  });

  it('reserves the wide column for multi-character compound units', () => {
    for (const unit of ['mm/N', 'Ns/m', '1000/K', 'kg/m³']) expect(PhoneRowColumns.chipIsWide(unit)).toBe(true);
    for (const unit of ['Hz', 'L', 'Ω', 'mm']) expect(PhoneRowColumns.chipIsWide(unit)).toBe(false);
  });
});
