import {describe, expect, it} from 'vitest';
import {PhoneHeaderSizes, PhoneRowSizes} from '../../fields/index.js';

describe('PhoneHeaderSizes', () => {
  it('every header control is the one 44 px phone button', () => {
    expect(PhoneHeaderSizes.CLASSIC.controlPx).toBe(PhoneRowSizes.BUTTON_PX);
    expect(PhoneHeaderSizes.CLASSIC.cssVars().get('--mob-header-control')).toBe('44px');
  });

  it('the project name is 13 px on a 14 px line, up to three lines so a long name shows whole (T735)', () => {
    const vars = PhoneHeaderSizes.CLASSIC.cssVars();
    expect(vars.get('--mob-header-title-px')).toBe('13px');
    expect(vars.get('--mob-header-title-lh')).toBe('14px');
    expect(vars.get('--mob-header-title-lines')).toBe('3');
  });

  it('the bar is the control plus 6 px above and below plus the 1 px rule: 57 px', () => {
    expect(PhoneHeaderSizes.CLASSIC.barHeightPx()).toBe(57);
  });
});
