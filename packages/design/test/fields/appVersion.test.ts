import {describe, expect, it} from 'vitest';
import {formatAppVersion, trailOfPathname, type AppVersion} from '../../fields/appVersion.js';
import {formatDateTime} from '../../fields/format.js';

describe('trailOfPathname', () => {
  it.each([
    ['/', 'release'], ['/index.html', 'release'], ['/v/20261014T1045Z/', 'release'],
    ['/snap/20261014T1045Z/', 'snap'], ['/snap/20261014T1045Z/index.html', 'snap'],
    ['/snap/', 'release'], ['/test/', 'test'], ['/test', 'release'],
  ] as const)('%s is %s', (path, trail) => {
    expect(trailOfPathname(path)).toBe(trail);
  });
});

describe('formatAppVersion', () => {
  it('prefixes the label with the trail, published builds only', () => {
    const v: AppVersion = { kind: 'published', version: 'v20261014T104500Z' };
    expect(formatAppVersion(v, 'snap')).toBe('snap · Oct 14 10:45Z');
    expect(formatAppVersion(v, 'test')).toBe('test · Oct 14 10:45Z');
    expect(formatAppVersion({ kind: 'dev', sha: 'abc', hasChanges: false, committedAt: '' }, 'test')).toBe('dev abc');
  });

  it('formats a published version as its UTC build time with a Z suffix', () => {
    const v: AppVersion = { kind: 'published', version: 'v20261009T234100Z' };
    expect(formatAppVersion(v, 'release')).toBe('Oct 09 23:41Z');
  });


  it('formats published version without leading v', () => {
    const v: AppVersion = { kind: 'published', version: '20261009T234100Z' };
    expect(formatAppVersion(v, 'release')).toBe('Oct 09 23:41Z');
  });

  it('preserves unparseable published version verbatim', () => {
    const v1: AppVersion = { kind: 'published', version: 'v1' };
    expect(formatAppVersion(v1, 'release')).toBe('v1');

    const v2: AppVersion = { kind: 'published', version: 'invalid-stamp' };
    expect(formatAppVersion(v2, 'release')).toBe('invalid-stamp');
  });

  // The commit's instant is shown by the one design formatter, in the machine's local time.
  const committedAt = '20261013T1041Z';
  const shown = formatDateTime(new Date(Date.UTC(2026, 9, 13, 10, 41)));

  it('formats dev version as the commit date and time, then the id', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: false, committedAt };
    expect(formatAppVersion(v, 'release')).toBe(`dev ${shown} · 5a3f9c1`);
    expect(shown).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
  });

  it('formats dev version with changes', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: true, committedAt };
    expect(formatAppVersion(v, 'release')).toBe(`dev ${shown} · 5a3f9c1 + changes`);
  });

  it('dev version without a readable commit time shows the id alone', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: false, committedAt: '' };
    expect(formatAppVersion(v, 'release')).toBe('dev 5a3f9c1');
  });

  it('formats unknown version', () => {
    const v: AppVersion = { kind: 'unknown' };
    expect(formatAppVersion(v, 'release')).toBe('unknown');
  });

  it('exhaustive match: all variants handled', () => {
    const variants: AppVersion[] = [
      { kind: 'published', version: 'v20261009T234100Z' },
      { kind: 'published', version: 'custom-tag' },
      { kind: 'dev', sha: 'abc', hasChanges: false, committedAt: '20261013T1041Z' },
      { kind: 'dev', sha: 'abc', hasChanges: true, committedAt: '' },
      { kind: 'unknown' },
    ];
    for (const v of variants) {
      const res = formatAppVersion(v, 'release');
      expect(typeof res).toBe('string');
      expect(res.length).toBeGreaterThan(0);
    }
  });
});