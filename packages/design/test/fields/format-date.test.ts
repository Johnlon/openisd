import {afterEach, describe, it, expect, vi} from 'vitest';
import {formatCount, formatDate, formatDateTime} from '../../fields/format.js';

// John, 2026-10-05: "never never never use US style" dates; "yyyy-mm-dd was good enough
// everywhere". One shape everywhere a user sees a date: ISO order, 24-hour clock, no seconds.
describe('date and time formatting', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('formatDateTime: "2026-10-05 23:32"', () => {
    expect(formatDateTime(new Date(2026, 9, 5, 23, 32, 59))).toBe('2026-10-05 23:32');
  });

  it('formatDateTime: midnight is 00:00, minutes padded', () => {
    expect(formatDateTime(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01 00:00');
    expect(formatDateTime(new Date(2026, 11, 31, 9, 5))).toBe('2026-12-31 09:05');
  });

  it('formatDate: date only, month and day padded', () => {
    expect(formatDate(new Date(2026, 4, 7, 18, 0))).toBe('2026-05-07');
  });

  it('never asks the runtime locale, so en-US and en-GB give the same text', () => {
    const d = new Date(2026, 9, 5, 23, 32);
    const before = formatDateTime(d);
    const toLocale = vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => '10/5/2026, 11:32:00 PM');
    const dtf = vi.spyOn(Intl, 'DateTimeFormat');
    expect(formatDateTime(d)).toBe(before);
    expect(formatDate(d)).toBe('2026-10-05');
    expect(toLocale).not.toHaveBeenCalled();
    expect(dtf).not.toHaveBeenCalled();
    expect(before).not.toBe(d.toLocaleString('en-US'));
  });

  // John, 2026-10-05: 05/10/2026 hides the day/month order; year first never does.
  it('writes the year first and never a "/"', () => {
    for (const text of [formatDateTime(new Date(2026, 9, 5, 23, 32)), formatDate(new Date(2026, 1, 3))]) {
      expect(text).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(text).not.toContain('/');
    }
  });

  it('formatCount: thousands grouped with commas, whatever the locale', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(42)).toBe('42');
  });
});
