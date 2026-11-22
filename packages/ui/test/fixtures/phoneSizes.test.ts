import {describe, expect, it} from 'vitest';
import {PHONE_SIZES} from './phoneSizes.js';

describe('PHONE_SIZES', () => {
  it('covers six named phone screens, smallest height to largest', () => {
    expect(PHONE_SIZES.map(s => `${s.width}x${s.height}`)).toEqual([
      '375x667', '374x705', '360x740', '390x844', '412x915', '430x932',
    ]);
  });
  it('has unique names and sizes', () => {
    expect(new Set(PHONE_SIZES.map(s => s.name)).size).toBe(PHONE_SIZES.length);
    expect(new Set(PHONE_SIZES.map(s => `${s.width}x${s.height}`)).size).toBe(PHONE_SIZES.length);
  });
});
