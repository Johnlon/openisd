import {describe, expect, it} from 'vitest';
import {Chip, DriverType} from '@openisd/design/filter';

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
