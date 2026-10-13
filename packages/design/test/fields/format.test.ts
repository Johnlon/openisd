import {describe, it, expect} from 'vitest';
import {formatFixed, formatByteSize, formatCountOf, formatFixedOrDash} from '../../fields/format.js';

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

  it('formatByteSize: bytes, then KB or MB to one decimal', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(1023)).toBe('1023 B');
    expect(formatByteSize(1024)).toBe('1.0 KB');
    expect(formatByteSize(12595)).toBe('12.3 KB');
    expect(formatByteSize(1024 * 1024 * 1.25)).toBe('1.3 MB');
  });

  it('formatCountOf: a count with its noun, plural unless one', () => {
    expect(formatCountOf(0, 'project')).toBe('0 projects');
    expect(formatCountOf(1, 'project')).toBe('1 project');
    expect(formatCountOf(1200, 'project')).toBe('1,200 projects');
  });
});
