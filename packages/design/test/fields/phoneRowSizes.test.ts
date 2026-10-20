import {describe, expect, it} from 'vitest';
import {PhoneRowSizes, SheetSizes} from '../../fields/index.js';

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

  it('compact rows are a half-way house: 40 px rows, 36 px boxes, the label on the row\'s own line', () => {
    const vars = PhoneRowSizes.COMPACT.cssVars();
    expect(vars.get('--mob-row-min')).toBe('40px');
    expect(vars.get('--mob-input-h')).toBe('36px');
    expect(vars.get('--mob-label-w')).toBe('120px');
    expect(vars.get('--mob-stepper-w')).toBe('40px');
    expect(vars.get('--mob-touch-min')).toBe(`${SheetSizes.TOUCH_MIN_PX}px`);
  });

  it('both sets name the same variables', () => {
    expect([...PhoneRowSizes.SHEET.cssVars().keys()]).toEqual([...PhoneRowSizes.TAB.cssVars().keys()]);
    expect([...PhoneRowSizes.COMPACT.cssVars().keys()]).toEqual([...PhoneRowSizes.TAB.cssVars().keys()]);
  });
});
