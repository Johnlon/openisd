import {describe, expect, it} from 'vitest';
import {DesktopSizes, PickWidth} from '../../fields/index.js';

describe('DesktopSizes', () => {
  it('names every size as a CSS variable in px', () => {
    const vars = DesktopSizes.cssVars();
    expect(Object.fromEntries(vars)).toEqual({
      '--ctl-h': '24px', '--ctl-font-size': '13px', '--ctl-nav-font-size': '16px', '--ctl-row-gap': '4px', '--ctl-group-gap': '6px', '--ctl-compact-row-gap': '1px', '--ctl-stepper-w': '18px', '--ctl-label-w': '150px', '--ctl-label-slot': '22px', '--ctl-btn-w': '84px', '--ctl-btn-h': '30px',
    });
  });

  it('sizes a label column to its longest label, rounded up, plus the warning slot', () => {
    expect(DesktopSizes.labelColumnPx([41.2, 96.01, 60], true)).toBe(97 + 22);
    expect(DesktopSizes.labelColumnPx([], true)).toBe(22);
  });

  it('adds no slot to a group whose rows show no warning (plain label and list rows)', () => {
    expect(DesktopSizes.labelColumnPx([31.5, 43.2], false)).toBe(44);
  });

  it('uses the common desktop control height and text size', () => {
    expect(DesktopSizes.CONTROL_H_PX).toBe(24);
    expect(DesktopSizes.CONTROL_FONT_PX).toBe(13);
  });
});

describe('PickWidth', () => {
  it('keeps the widths the wizard had in 7.0.951', () => {
    expect([PickWidth.SHORT, PickWidth.MEDIUM, PickWidth.LONG, PickWidth.TEXT].map(w => w.css)).toEqual(['180px', '240px', '260px', '280px']);
  });
});
