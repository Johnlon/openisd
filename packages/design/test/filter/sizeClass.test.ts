import {describe, expect, it} from 'vitest';
import {SizeClass} from '@openisd/design/filter';

/** Drivers whose maker prints the nominal size, with the Sd the record states (m2). Measured on the
 *  bundled catalogue: the class worked out from Sd must be the class the maker printed. */
const PRINTED_AND_SD: readonly {name: string; printed: string; Sd_m2: number}[] = [
  {name: 'Beyma 6P200Fe', printed: '6.5', Sd_m2: 0.0135},
  {name: 'Dayton RSS210HO-8', printed: '8', Sd_m2: 0.0213206},
  {name: 'Dayton RS270P-8A', printed: '10', Sd_m2: 0.03464},
  {name: 'Dayton MX12-22', printed: '12', Sd_m2: 0.05147},
  {name: 'Beyma 15LEX1600Fe', printed: '15', Sd_m2: 0.088},
  {name: 'Dayton UMII18-22', printed: '18', Sd_m2: 0.1184},
];

describe('SizeClass.ofSd — a size class worked out from Sd, for search only', () => {
  it('gives the class the maker printed for drivers that print one', () => {
    for (const d of PRINTED_AND_SD) expect(SizeClass.ofSd(d.Sd_m2)?.value, d.name).toBe(d.printed);
  });

  it('is one class off at most for a 7 inch driver (Accuton AS168, Sd 0.0161): the nearest class, not a promise', () => {
    expect(SizeClass.ofSd(0.0161)?.value).toBe('6.5');
  });

  it('says nothing when Sd is not stated or not a size', () => {
    expect(SizeClass.ofSd(null)).toBeNull();
    expect(SizeClass.ofSd(0)).toBeNull();
    expect(SizeClass.ofSd(-0.01)).toBeNull();
    expect(SizeClass.ofSd(Number.NaN)).toBeNull();
  });

  it('snaps an out-of-range Sd to the nearest end class', () => {
    expect(SizeClass.ofSd(0.00001)?.value).toBe(SizeClass.ALL[0].value);
    expect(SizeClass.ofSd(2)?.value).toBe(SizeClass.ALL[SizeClass.ALL.length - 1].value);
  });
});

describe('SizeClass — the filter chips', () => {
  it('lists the classes smallest first, each with its value and label', () => {
    const inches = SizeClass.ALL.map(c => c.inches);
    expect(inches).toEqual([...inches].sort((a, b) => a - b));
    expect(SizeClass.ALL.map(c => c.value)).toContain('6.5');
    expect(SizeClass.parse('6.5')?.label).toBe('6.5 in');
    expect(SizeClass.parse('7')).toBeNull();
  });

  it('labels a derived size as derived, never as the maker\'s nominal size', () => {
    expect(SizeClass.derivedLabel(8)).toBe('≈ 8 in (from Sd)');
    expect(SizeClass.derivedLabel(6.5)).toBe('≈ 6.5 in (from Sd)');
    expect(SizeClass.derivedLabel(null)).toBeNull();
  });

  it('admits every driver when no chip is on, and only the chosen classes when some are', () => {
    expect(SizeClass.admits([], 8)).toBe(true);
    expect(SizeClass.admits([], null)).toBe(true);
    expect(SizeClass.admits(['8'], 8)).toBe(true);
    expect(SizeClass.admits(['8', '10'], 10)).toBe(true);
    expect(SizeClass.admits(['8'], 10)).toBe(false);
    expect(SizeClass.admits(['8'], null)).toBe(false);
  });

  it('names the chosen classes for the "Filters on" line', () => {
    expect(SizeClass.filterLabel([])).toBeNull();
    expect(SizeClass.filterLabel(['10', '8'])).toBe('Size ≈ 8 or 10 in (from Sd)');
  });
});
