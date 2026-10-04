import {describe, expect, it} from 'vitest';
import {halfUlp} from '../../domain/precision.js';
import {knownDecimals} from '../../fields/precision.js';

describe('knownDecimals — the decimals a value is known to, from its half-width', () => {
  it('typed 0.0754 (±0.00005) shows 4 decimals', () => {
    expect(knownDecimals(0.00005, 0.0754)).toBe(4);
  });

  it('a half-width carried through a unit factor still lands on its own decimal', () => {
    // "0.0754" typed in %, stored as a fraction, shown in % again: 0.00005 / 100 * 100.
    expect(knownDecimals(0.00005 / 100 * 100, 0.0754)).toBe(4);
  });

  it('a propagated ±0.0046 is known to its leading digit: 3 decimals', () => {
    expect(knownDecimals(0.0046, 0.395)).toBe(3);
  });

  it('a whole-number statement (±0.5) shows no decimals', () => {
    expect(knownDecimals(0.5, 37)).toBe(0);
  });

  it('an interval wider than one unit shows no decimals, never a negative count', () => {
    expect(knownDecimals(5, 370)).toBe(0);
  });

  it('no stated width says nothing: 0 decimals', () => {
    expect(knownDecimals(0, 1.5)).toBe(0);
  });

  it('a stored double\'s float tail is cut at 10 significant digits', () => {
    const v = 1.9085175370557992;
    expect(knownDecimals(halfUlp(v), v)).toBe(9);
  });

  it('0.1000 + 0.1200 (each ±0.00005, sum ±0.0001) shows 0.2200', () => {
    expect((0.22).toFixed(knownDecimals(0.0001, 0.22))).toBe('0.2200');
  });
});
