import {describe, expect, it} from 'vitest';
import {PHONE_SIZES} from './phoneSizes.js';

describe('PHONE_SIZES', () => {
  it('covers six named phone screens from 360x740 to 430x932', () => {
    expect(PHONE_SIZES.map(s => `${s.width}x${s.height}`)).toEqual([
      '360x740', '375x667', '390x844', '411x923', '412x915', '430x932',
    ]);
  });
  it('has unique names and sizes', () => {
    expect(new Set(PHONE_SIZES.map(s => s.name)).size).toBe(PHONE_SIZES.length);
    expect(new Set(PHONE_SIZES.map(s => `${s.width}x${s.height}`)).size).toBe(PHONE_SIZES.length);
  });
});
