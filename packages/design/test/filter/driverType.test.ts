import {describe, expect, it} from 'vitest';
import {DriverType} from '@openisd/design/filter';

describe('DriverType — the wire value a record states', () => {
  it('parses the canonical wire string to the member itself, not a copy', () => {
    expect(DriverType.parse('subwoofer')).toBe(DriverType.Subwoofer);
  });

  it('takes the leading token, because a scraper may append qualifiers', () => {
    // "subwoofer, automotive" — only the first token is a type; the rest describe the market.
    expect(DriverType.parse('subwoofer, automotive')).toBe(DriverType.Subwoofer);
  });

  it('answers null for a value the enum does not declare, so the caller can fall back', () => {
    expect(DriverType.parse('compression')).toBeNull();
    expect(DriverType.parse('')).toBeNull();
    expect(DriverType.parse(null)).toBeNull();
    expect(DriverType.parse(undefined)).toBeNull();
  });

  it('declares exactly the eleven values the cross-repo contract fixes', () => {
    // Must stay identical to the Python DriverType in winisd_tools
    // (scrapers/scrapers/lib/driver_type.py) — changing one REQUIRES changing the other.
    expect(DriverType.ALL.map((d) => d.value)).toEqual([
      'woofer', 'subwoofer', 'midrange', 'mid-bass', 'mid-woofer', 'full-range',
      'bmr', 'coaxial', 'tweeter', 'amt', 'passive-radiator', 'unclassified',
    ]);
  });

  it('reaches every member from its own wire value', () => {
    for (const member of DriverType.ALL) expect(DriverType.parse(member.value)).toBe(member);
  });

  it('projects a subwoofer onto the bass chips, so a bass search returns it', () => {
    expect(DriverType.parse('subwoofer')?.chips.map((c) => c.value)).toEqual(['sub', 'woofer', 'bass']);
  });

  it('gives Unclassified no chips at all — it is the absence of a verdict', () => {
    expect(DriverType.Unclassified.chips).toEqual([]);
  });

  it('serialises as the wire string, so interpolation and JSON cannot leak the object', () => {
    expect(`${DriverType.Tweeter}`).toBe('tweeter');
    expect(JSON.stringify({ driver_type: DriverType.Tweeter })).toBe('{"driver_type":"tweeter"}');
  });
});
