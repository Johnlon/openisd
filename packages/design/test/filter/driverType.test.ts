/**
 * The search facility's vocabulary: the driver types a record can state, and the filter chips
 * the browser renders. Both are closed sets, so both are enums, and every fact a caller needs —
 * wire value, display label, chip projection — is carried ON the member.
 */
import { describe, it, expect } from 'vitest';
import { DriverType, Chip } from '@openisd/design/filter';

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

describe('Chip — the filter buttons the browser renders', () => {
  it('declares every chip in filter-bar render order', () => {
    expect(Chip.ALL.map((c) => c.value)).toEqual([
      'bass', 'sub', 'woofer', 'mid', 'tweet', 'fullrange', 'pr', 'coax', 'unclassified',
    ]);
  });

  it('carries a button label and a tooltip on each member, so no side map is needed', () => {
    expect(Chip.Sub.label).toBe('Sub');
    expect(Chip.Sub.title).toContain('Subwoofer');
    for (const chip of Chip.ALL) {
      expect(chip.label.length).toBeGreaterThan(0);
      expect(chip.title.length).toBeGreaterThan(0);
    }
  });

  it('serialises as its own value, which is what crosses into the reactive store', () => {
    expect(`${Chip.Bass}`).toBe('bass');
    expect(JSON.stringify([Chip.Bass])).toBe('["bass"]');
  });

  it('never emits Unclassified from a type — it is derived from an empty chip set', () => {
    for (const type of DriverType.ALL) {
      expect(type.chips).not.toContain(Chip.Unclassified);
    }
  });
});
