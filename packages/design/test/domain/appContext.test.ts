import {describe, expect, it} from 'vitest';
import {dateStamp, realAppContext} from '../../domain/appContext.js';

describe('realAppContext', () => {
  it('newId mints a v4-shaped uuid', () => {
    expect(realAppContext.newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('now returns the current moment as a Date', () => {
    const before = Date.now();
    const stamp = realAppContext.now();
    const after = Date.now();
    expect(stamp).toBeInstanceOf(Date);
    expect(stamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(stamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('platformUser has no OS-username source today, so it reads null', () => {
    expect(realAppContext.platformUser()).toBeNull();
  });
});

describe('dateStamp', () => {
  it('formats a date as WinISD\'s YYYYMMDD', () => {
    expect(dateStamp(new Date(2026, 0, 5))).toBe('20260105');
  });

  it('zero-pads a single-digit month and day', () => {
    expect(dateStamp(new Date(2026, 8, 9))).toBe('20260909');
  });
});
