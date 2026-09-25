import {describe, expect, it} from 'vitest';
import {halfUlp} from '../../domain/precision.js';

describe('halfUlp — the rounding interval a typed decimal implies', () => {
  it('0.49 (two decimals) implies a half-width of 0.005', () => {
    expect(halfUlp(0.49)).toBeCloseTo(0.005, 9);
  });

  it('37 (a whole number) implies a half-width of 0.5', () => {
    expect(halfUlp(37)).toBeCloseTo(0.5, 9);
  });

  it('0.0355 (four decimals) implies a half-width of 0.00005', () => {
    expect(halfUlp(0.0355)).toBeCloseTo(0.00005, 9);
  });

  it('zero has no rounding interval', () => {
    expect(halfUlp(0)).toBe(0);
  });

  it('a negative value uses its own magnitude, not zero', () => {
    expect(halfUlp(-37)).toBeCloseTo(0.5, 9);
  });

  it('NaN/Infinity have no rounding interval', () => {
    expect(halfUlp(NaN)).toBe(0);
    expect(halfUlp(Infinity)).toBe(0);
  });
});
