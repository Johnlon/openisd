import {describe, expect, it} from 'vitest';
import {DesktopSizes, PickWidth} from '../../fields/index.js';

describe('DesktopSizes', () => {
  it('names every size as a CSS variable in px', () => {
    const vars = DesktopSizes.cssVars();
    expect(Object.fromEntries(vars)).toEqual({
      '--ctl-h': '28px', '--ctl-stepper-w': '18px', '--ctl-label-w': '150px', '--ctl-label-slot': '22px', '--ctl-btn-w': '84px', '--ctl-btn-h': '30px',
    });
  });

  it('sizes a label column to its longest label, rounded up, plus the warning slot', () => {
    expect(DesktopSizes.labelColumnPx([41.2, 96.01, 60])).toBe(97 + 22);
    expect(DesktopSizes.labelColumnPx([])).toBe(22);
  });

  it('makes the arrows at least as tall as the number box', () => {
    expect(DesktopSizes.CONTROL_H_PX).toBeGreaterThanOrEqual(28);
  });
});

describe('PickWidth', () => {
  it('keeps the widths the wizard had in 7.0.951', () => {
    expect([PickWidth.SHORT, PickWidth.MEDIUM, PickWidth.LONG, PickWidth.TEXT].map(w => w.css)).toEqual(['180px', '240px', '260px', '280px']);
  });
});
