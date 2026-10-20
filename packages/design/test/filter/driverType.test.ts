import {describe, expect, it} from 'vitest';
import {Chip, DriverType} from '@openisd/design/filter';

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

  it('declares exactly the values the cross-repo contract fixes', () => {
    // Must stay identical to the Python DriverType in winisd_tools
    // (scrapers/scrapers/lib/driver_type.py) — changing one REQUIRES changing the other.
    expect(DriverType.ALL.map((d) => d.value)).toEqual([
      'woofer', 'subwoofer', 'midrange', 'bass', 'bass-midrange', 'mid-bass', 'mid-woofer', 'full-range',
      'bmr', 'coaxial', 'tweeter', 'amt', 'passive-radiator', 'unclassified',
    ]);
  });

  it('reaches every member from its own wire value', () => {
    for (const member of DriverType.ALL) expect(DriverType.parse(member.value)).toBe(member);
  });

  it('projects a subwoofer onto the bass chips, so a bass search returns it', () => {
    expect(DriverType.parse('subwoofer')?.chips.map((c) => c.value)).toEqual(['sub', 'woofer', 'bass']);
  });

  it('parses bass and bass-midrange to their members, both carrying the Woofer chip', () => {
    expect(DriverType.parse('bass')).toBe(DriverType.Bass);
    expect(DriverType.parse('bass-midrange')).toBe(DriverType.BassMidrange);
    expect(DriverType.Bass.chips).toContain(Chip.Woofer);
    expect(DriverType.BassMidrange.chips).toContain(Chip.Woofer);
    expect(DriverType.BassMidrange.chips).toContain(Chip.Mid);
  });

  it('does not make a midrange a woofer', () => {
    expect(DriverType.Midrange.chips).not.toContain(Chip.Woofer);
  });

  it('gives Unclassified no chips at all — it is the absence of a verdict', () => {
    expect(DriverType.Unclassified.chips).toEqual([]);
  });

  it('serialises as the wire string, so interpolation and JSON cannot leak the object', () => {
    expect(`${DriverType.Tweeter}`).toBe('tweeter');
    expect(JSON.stringify({ driver_type: DriverType.Tweeter })).toBe('{"driver_type":"tweeter"}');
  });
});

describe('DriverType — a record with several roles', () => {
  it('parseRoles keeps declared roles in list order and drops unknown and unclassified ones', () => {
    expect(DriverType.parseRoles(['midrange', 'bogus', 'tweeter', 'unclassified'])).toEqual([DriverType.Midrange, DriverType.Tweeter]);
  });

  it('chipValuesOf is the union of the roles chips, each once', () => {
    expect(DriverType.chipValuesOf([DriverType.Midrange, DriverType.Tweeter])).toEqual(['mid', 'tweet']);
  });

  it('displayOf joins the role labels', () => {
    expect(DriverType.displayOf([DriverType.Midrange, DriverType.Tweeter])).toBe('Midrange / Tweeter');
  });
});
