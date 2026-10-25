import {describe, it, expect} from 'vitest';
import {
  comparePublicVersion, formatPublicVersion, runningHeading, parsePublicVersion, publicVersionOfTitle, titleOfPublicVersion, type PublicVersion,
} from '../../fields/publicVersion.js';

const v = (text: string): PublicVersion => {
  const parsed = parsePublicVersion(text);
  if (parsed === null) throw new Error(`not a version: ${text}`);
  return parsed;
};

describe('public version', () => {
  it('parses and formats three numbers', () => {
    expect(parsePublicVersion('7.0.951')).toEqual({major: 7, minor: 0, patch: 951});
    expect(formatPublicVersion(v('7.0.951'))).toBe('7.0.951');
  });
  it('refuses anything that is not three numbers', () => {
    for (const text of ['', '7', '7.0', '7.0.951.1', '7.0.x', 'v7.0.951', ' 7.0.951', '7.0.-1']) {
      expect(parsePublicVersion(text), text).toBeNull();
    }
  });
  it('titles a release "OpenISD 7.0.951" and reads the number back', () => {
    expect(titleOfPublicVersion(v('7.0.951'))).toBe('OpenISD 7.0.951');
    expect(publicVersionOfTitle('OpenISD 7.0.951')).toEqual(v('7.0.951'));
  });
  it('finds no number in a snapshot or an old release title', () => {
    expect(publicVersionOfTitle('Snapshot 20261015T1542Z')).toBeNull();
    expect(publicVersionOfTitle('Release 20261013T1842Z')).toBeNull();
    expect(publicVersionOfTitle('OpenISD 7.0')).toBeNull();
  });
  it('leads About with the number and the day, or just the day when there is no number', () => {
    expect(runningHeading('7.0.951', '15 Oct 2026')).toBe('OpenISD 7.0.951 · 15 Oct 2026');
    expect(runningHeading('', '15 Oct 2026')).toBe('OpenISD · 15 Oct 2026');
  });
  it('orders by the numbers, not the text', () => {
    expect(comparePublicVersion(v('7.0.952'), v('7.0.951'))).toBeGreaterThan(0);
    expect(comparePublicVersion(v('7.0.951'), v('7.0.1000'))).toBeLessThan(0);
    expect(comparePublicVersion(v('7.1.0'), v('7.0.999'))).toBeGreaterThan(0);
    expect(comparePublicVersion(v('8.0.0'), v('7.9.9'))).toBeGreaterThan(0);
    expect(comparePublicVersion(v('7.0.951'), v('7.0.951'))).toBe(0);
  });
});
