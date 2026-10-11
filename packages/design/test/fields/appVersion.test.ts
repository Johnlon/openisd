import {describe, expect, it} from 'vitest';
import {formatAppVersion, type AppVersion, type ToLocalTime} from '../../fields/appVersion.js';

const fakeUtcZero: ToLocalTime = (epochMs: number) => {
  const d = new Date(epochMs);
  return {
    monthIndex: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

const fakeUtcPlus10: ToLocalTime = (epochMs: number) => {
  const d = new Date(epochMs + 10 * 60 * 60 * 1000);
  return {
    monthIndex: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

describe('formatAppVersion', () => {
  it('formats published version in local time at UTC+0', () => {
    const v: AppVersion = { kind: 'published', version: 'v20261009T234100Z' };
    expect(formatAppVersion(v, fakeUtcZero)).toBe('Oct 09 23:41');
  });

  it('formats published version in local time at UTC+10 (rolls over midnight)', () => {
    const v: AppVersion = { kind: 'published', version: 'v20261009T234100Z' };
    expect(formatAppVersion(v, fakeUtcPlus10)).toBe('Oct 10 09:41');
  });

  it('formats published version without leading v', () => {
    const v: AppVersion = { kind: 'published', version: '20261009T234100Z' };
    expect(formatAppVersion(v, fakeUtcZero)).toBe('Oct 09 23:41');
  });

  it('preserves unparseable published version verbatim', () => {
    const v1: AppVersion = { kind: 'published', version: 'v1' };
    expect(formatAppVersion(v1, fakeUtcZero)).toBe('v1');

    const v2: AppVersion = { kind: 'published', version: 'invalid-stamp' };
    expect(formatAppVersion(v2, fakeUtcZero)).toBe('invalid-stamp');
  });

  it('formats dev version without changes', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: false };
    expect(formatAppVersion(v, fakeUtcZero)).toBe('dev 5a3f9c1');
  });

  it('formats dev version with changes', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: true };
    expect(formatAppVersion(v, fakeUtcZero)).toBe('dev 5a3f9c1 + changes');
  });

  it('formats unknown version', () => {
    const v: AppVersion = { kind: 'unknown' };
    expect(formatAppVersion(v, fakeUtcZero)).toBe('unknown');
  });

  it('exhaustive match: all variants handled', () => {
    const variants: AppVersion[] = [
      { kind: 'published', version: 'v20261009T234100Z' },
      { kind: 'published', version: 'custom-tag' },
      { kind: 'dev', sha: 'abc', hasChanges: false },
      { kind: 'dev', sha: 'abc', hasChanges: true },
      { kind: 'unknown' },
    ];
    for (const v of variants) {
      const res = formatAppVersion(v, fakeUtcZero);
      expect(typeof res).toBe('string');
      expect(res.length).toBeGreaterThan(0);
    }
  });
});