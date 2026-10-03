import {describe, it, expect} from 'vitest';
import {formatFixed, formatFixedOrDash} from '../fields/format.js';

describe('fixed-decimal number formatting', () => {
  it('formatFixed: the value to the decimals asked', () => {
    expect(formatFixed(1.234, 1)).toBe('1.2');
    expect(formatFixed(2, 3)).toBe('2.000');
  });

  it('formatFixedOrDash: a dash for missing or non-finite', () => {
    expect(formatFixedOrDash(3.14159, 2)).toBe('3.14');
    expect(formatFixedOrDash(null, 2)).toBe('—');
    expect(formatFixedOrDash(Number.NaN, 2)).toBe('—');
    expect(formatFixedOrDash(Number.POSITIVE_INFINITY, 2)).toBe('—');
  });
});
