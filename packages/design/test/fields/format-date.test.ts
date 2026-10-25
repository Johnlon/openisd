import {afterEach, describe, it, expect, vi} from 'vitest';
import {dateStampFrom, formatCount, formatDate, formatDateStamp, formatDateTime, parseBasicUtc} from '../../fields/format.js';

// John, 2026-10-05: "never never never use US style" dates. Date and time for a user: day, month
// name, year, 24-hour clock, no seconds ("1 Jan 2026, 01:02", T056); a bare date stays yyyy-mm-dd.
describe('date and time formatting', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('formatDateTime: "5 Oct 2026, 23:32"', () => {
    expect(formatDateTime(new Date(2026, 9, 5, 23, 32, 59))).toBe('5 Oct 2026, 23:32');
  });

  it('formatDateTime: midnight is 00:00, minutes padded', () => {
    expect(formatDateTime(new Date(2026, 0, 1, 0, 0))).toBe('1 Jan 2026, 00:00');
    expect(formatDateTime(new Date(2026, 11, 31, 9, 5))).toBe('31 Dec 2026, 09:05');
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

  // John, 2026-10-05: 05/10/2026 hides the day/month order; a month name never does.
  it('names the month and never writes a "/"', () => {
    expect(formatDateTime(new Date(2026, 9, 5, 23, 32))).not.toContain('/');
    expect(formatDate(new Date(2026, 1, 3))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parseBasicUtc: minute and second stamps, with or without the v', () => {
    expect(parseBasicUtc('20260101T0102Z')?.toISOString()).toBe('2026-01-01T01:02:00.000Z');
    expect(parseBasicUtc('v20260101T010203Z')?.toISOString()).toBe('2026-01-01T01:02:03.000Z');
  });

  it('parseBasicUtc: null for anything else', () => {
    for (const bad of ['', 'banana', '2026-01-01T01:02Z', '20261301T0102Z', '20260230T0102Z', '20260101T2502Z']) {
      expect(parseBasicUtc(bad)).toBeNull();
    }
  });

  it('formatCount: thousands grouped with commas, whatever the locale', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(formatCount(42)).toBe('42');
  });
});

// John, 17 Oct 2026: the Project tab's Created and Modified follow the date rule. The stored stamp is
// WinISD's YYYYMMDD and holds no time, so the boxes show the day: "16 Oct 2026".
describe('project Created/Modified stamps', () => {
  it('formatDateStamp: "20261016" shows as "16 Oct 2026", a single-digit day without a zero', () => {
    expect(formatDateStamp('20261016')).toBe('16 Oct 2026');
    expect(formatDateStamp('20260105')).toBe('5 Jan 2026');
  });

  it('formatDateStamp: a stamp that is not a real day shows as stored', () => {
    expect(formatDateStamp('')).toBe('');
    expect(formatDateStamp('2026')).toBe('2026');
    expect(formatDateStamp('20260231')).toBe('20260231');
  });

  it('dateStampFrom: reads the shown form, the ISO form and the stamp itself', () => {
    expect(dateStampFrom('16 Oct 2026', '')).toBe('20261016');
    expect(dateStampFrom(' 5 jan 2026 ', '')).toBe('20260105');
    expect(dateStampFrom('2026-01-02', '')).toBe('20260102');
    expect(dateStampFrom('20260102', '')).toBe('20260102');
  });

  it('dateStampFrom: text that names no real day keeps the previous stamp', () => {
    for (const text of ['', '16 O', '16 Oct 202', '31 Feb 2026', '2026-13-01', 'banana']) {
      expect(dateStampFrom(text, '20261016')).toBe('20261016');
    }
  });

  it('round-trips: what is shown reads back as the same stamp', () => {
    expect(dateStampFrom(formatDateStamp('20261016'), '')).toBe('20261016');
  });
});
