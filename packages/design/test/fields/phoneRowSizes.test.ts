import {describe, expect, it} from 'vitest';
import {PhoneRowColumns, PhoneRowSizes, SheetSizes} from '../../fields/index.js';

describe('PhoneRowSizes', () => {
  it('tab rows are 7.0.951 deep: 48 px, 10 px padding, 32 px boxes', () => {
    const vars = PhoneRowSizes.TAB.cssVars();
    expect(vars.get('--mob-row-min')).toBe('48px');
    expect(vars.get('--mob-row-pad-y')).toBe('10px');
    expect(vars.get('--mob-input-h')).toBe('32px');
    expect(vars.get('--mob-label-gap')).toBe('2px');
  });

  it('sheet rows stay tight but tappable', () => {
    const vars = PhoneRowSizes.SHEET.cssVars();
    expect(vars.get('--mob-row-pad-y')).toBe('2px');
    expect(vars.get('--mob-row-min')).toBe(`${SheetSizes.ROW_MIN_PX}px`);
    expect(vars.get('--mob-input-h')).toBe(`${SheetSizes.TOUCH_MIN_PX}px`);
    expect(vars.get('--mob-label-gap')).toBe('0px');
  });

  it('every set gives the one 44 px phone button', () => {
    expect(PhoneRowSizes.BUTTON_PX).toBe(44);
    for (const set of [PhoneRowSizes.TAB, PhoneRowSizes.CLASSIC, PhoneRowSizes.SHEET]) {
      expect(set.cssVars().get('--mob-button-h')).toBe('44px');
    }
  });

  it('both sets name the same variables', () => {
    expect([...PhoneRowSizes.SHEET.cssVars().keys()]).toEqual([...PhoneRowSizes.TAB.cssVars().keys()]);
    expect([...PhoneRowSizes.CLASSIC.cssVars().keys()]).toEqual([...PhoneRowSizes.TAB.cssVars().keys()]);
  });

  it('classic rows are 40 px with 34 px boxes and a 3 px pad', () => {
    const vars = PhoneRowSizes.CLASSIC.cssVars();
    expect(vars.get('--mob-row-min')).toBe('40px');
    expect(vars.get('--mob-row-pad-y')).toBe('3px');
    expect(vars.get('--mob-input-h')).toBe('34px');
    expect(vars.get('--mob-label-lh')).toBe('16px');
    expect(vars.get('--mob-label-gap')).toBe('0px');
  });
});

describe('PhoneRowColumns', () => {
  it('standard columns: 82 px label, 90 px stepper, 40 px chip, 14 px gutter', () => {
    const vars = PhoneRowColumns.STANDARD.cssVars();
    expect(vars.get('--mob-col-label')).toBe('82px');
    expect(vars.get('--mob-col-stepper')).toBe('90px');
    expect(vars.get('--mob-col-chip-min')).toBe('40px');
    expect(vars.get('--mob-col-gutter')).toBe('14px');
  });

  it('wide label columns differ from standard only in the label', () => {
    const wide = PhoneRowColumns.WIDE_LABEL.cssVars();
    expect(wide.get('--mob-col-label')).toBe('128px');
    expect(wide.get('--mob-col-stepper')).toBe('90px');
    expect([...wide.keys()]).toEqual([...PhoneRowColumns.STANDARD.cssVars().keys()]);
  });
});
