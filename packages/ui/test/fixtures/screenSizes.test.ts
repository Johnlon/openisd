import {describe, expect, it} from 'vitest';
import {MAY_SCROLL_SIZES, MUST_FIT_SIZES} from './screenSizes.js';

const sizes = (list: readonly {width: number; height: number}[]): string[] => list.map(s => `${s.width}x${s.height}`);

// The window sizes are the ones docs/spec/SPEC_UI.md UI-5 states.
describe('screen sizes (SPEC_UI UI-5)', () => {
  it('must fit: the five desktop windows and four upright phones the spec names', () => {
    expect(sizes(MUST_FIT_SIZES.desktop)).toEqual(['1920x970', '1536x754', '1440x790', '1366x657', '2560x1330']);
    expect(sizes(MUST_FIT_SIZES.phone)).toEqual(['360x800', '390x844', '414x896', '430x932']);
  });
  it('may scroll: 1280x720, 800x600 and the 200% text zoom window on desktop; 320 wide and landscape on phone', () => {
    expect(sizes(MAY_SCROLL_SIZES.desktop)).toEqual(['1280x720', '800x600', '640x360']);
    expect(sizes(MAY_SCROLL_SIZES.phone)).toEqual(['320x640', '844x390']);
  });
  it('every size has a unique name', () => {
    const all = [...MUST_FIT_SIZES.desktop, ...MUST_FIT_SIZES.phone, ...MAY_SCROLL_SIZES.desktop, ...MAY_SCROLL_SIZES.phone];
    expect(new Set(all.map(s => s.name)).size).toBe(all.length);
  });
});
