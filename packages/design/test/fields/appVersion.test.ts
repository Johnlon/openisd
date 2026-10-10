import {describe, expect, it} from 'vitest';
import {formatAppVersion, type AppVersion} from '../../fields/appVersion.js';

describe('formatAppVersion', () => {
  it('formats published version with v prefix', () => {
    const v: AppVersion = { kind: 'published', version: 'v20261010T123456Z' };
    expect(formatAppVersion(v)).toBe('vv20261010T123456Z');
  });

  it('formats dev version without changes', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: false };
    expect(formatAppVersion(v)).toBe('dev 5a3f9c1');
  });

  it('formats dev version with changes', () => {
    const v: AppVersion = { kind: 'dev', sha: '5a3f9c1', hasChanges: true };
    expect(formatAppVersion(v)).toBe('dev 5a3f9c1 + changes');
  });

  it('formats unknown version', () => {
    const v: AppVersion = { kind: 'unknown' };
    expect(formatAppVersion(v)).toBe('unknown');
  });

  it('exhaustive match: all variants handled', () => {
    // This test ensures TypeScript exhaustiveness checking works
    const variants: AppVersion[] = [
      { kind: 'published', version: 'v1' },
      { kind: 'dev', sha: 'abc', hasChanges: false },
      { kind: 'dev', sha: 'abc', hasChanges: true },
      { kind: 'unknown' },
    ];
    for (const v of variants) {
      expect(typeof formatAppVersion(v)).toBe('string');
      expect(formatAppVersion(v).length).toBeGreaterThan(0);
    }
  });
});