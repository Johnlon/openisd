import {describe, expect, it} from 'vitest';
import {basicUtc, parseBasicUtc} from '../../fields/basicTime.js';

describe('ISO 8601 basic UTC time', () => {
  it('writes seconds in UTC with no separators', () => {
    expect(basicUtc(Date.UTC(2026, 0, 1, 1, 2, 3))).toBe('20260101T010203Z');
  });

  it('reads minutes or seconds back to the instant', () => {
    expect(parseBasicUtc('20260101T0102Z')?.getTime()).toBe(Date.UTC(2026, 0, 1, 1, 2, 0));
    expect(parseBasicUtc('20261012T213005Z')?.getTime()).toBe(Date.UTC(2026, 9, 12, 21, 30, 5));
  });

  it('round-trips', () => {
    const at = Date.UTC(2031, 11, 31, 23, 59, 58);
    expect(parseBasicUtc(basicUtc(at))?.getTime()).toBe(at);
  });

  it('refuses text that is not a basic UTC time', () => {
    for (const bad of ['', '2026-01-01T01:02:03Z', '20260101T0102', '20260101 0102Z', 'v20260101T0102Z']) {
      expect(parseBasicUtc(bad)).toBeNull();
    }
  });
});
