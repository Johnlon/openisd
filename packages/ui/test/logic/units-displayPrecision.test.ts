import {describe, expect, it} from 'vitest';
import {decimalsIn, knownDecimals, toDisplayDelta, unitFor, type UnitGroup} from '@openisd/design/fields';

function displayPrecision(baseDp: number, group: UnitGroup, baseToken: string, token: string): number {
  const u = unitFor(group, token, baseToken);
  return decimalsIn(u, baseDp);
}

function shownDecimals(minDp: number, halfWidthSI: number | null | undefined, valDisp: number, group?: UnitGroup, token?: string): number {
  if (halfWidthSI != null && group != null && token != null) {
    const u = unitFor(group, token);
    const hwDisp = toDisplayDelta(u, halfWidthSI);
    return Math.max(minDp, knownDecimals(hwDisp, valDisp));
  }
  if (halfWidthSI != null) {
    return Math.max(minDp, knownDecimals(halfWidthSI, valDisp));
  }
  return minDp;
}

// The registry declares ONE precision per field, in the field's base unit, and that states the
// field's ABSOLUTE resolution — Mms is known to a hundredth of a gram. Rotating the unit derives
// the shown decimals from it so that resolution survives the conversion: a ×10 coarser unit
// shows one MORE decimal, a ×10 finer one fewer. There is no ceiling — a fixed number of
// decimals per unit would show a coarser number than the field holds (John, 2026-09-25).
describe('displayPrecision', () => {
  it('shows the registry precision unchanged in the base unit', () => {
    expect(displayPrecision(5, 'mass', 'g', 'g')).toBe(5);
    expect(displayPrecision(6, 'resistance', 'Ns/m', 'Ns/m')).toBe(6);
    expect(displayPrecision(1, 'length', 'cm', 'cm')).toBe(1);
  });

  it('shrinks decimals for a finer unit and grows them for a coarser one', () => {
    expect(displayPrecision(1, 'length', 'cm', 'mm')).toBe(0);
    expect(displayPrecision(1, 'freq', 'Hz', 'kHz')).toBe(4);
    expect(displayPrecision(0, 'length', 'cm', 'mm')).toBe(0);
  });

  // John's own worked example: a field stated to 2 dp of grams, shown in kilograms, must have
  // the digits to write 1.23 g as 0.00123 kg — five of them, not the four a ceiling allowed.
  it('carries a 2 dp gram resolution into kilograms as five decimals', () => {
    const dp = displayPrecision(2, 'mass', 'g', 'kg');
    expect(dp).toBe(5);
    expect((1.23 / 1000).toFixed(dp)).toBe('0.00123');
  });

  it('never caps: the decimals a coarser unit needs are the resolution, not padding', () => {
    expect(displayPrecision(5, 'mass', 'g', 'kg')).toBe(8);
    expect(displayPrecision(6, 'mass', 'g', 'kg')).toBe(9);
  });

  it('floors at zero — a unit finer than the field\'s own resolution needs no decimals', () => {
    expect(displayPrecision(0, 'mass', 'kg', 'g')).toBe(0);
  });
});

// A value shows at least its field's decimals, and more where its own half-width — typed, or
// inherited from what it was calculated from — states them (John, 2026-10-02: "0.0754 entered
// in η₀ shows as 0.08").
describe('shownDecimals', () => {
  it('η₀ typed as 0.0754 % (stored as a fraction) shows 4 decimals in %', () => {
    const halfWidthSI = 0.00005 / 100;
    expect(shownDecimals(2, halfWidthSI, 0.0754, 'percent', 'pct')).toBe(4);
  });

  it('a value typed to fewer decimals than the field shows still shows the field\'s decimals', () => {
    expect(shownDecimals(3, 0.005, 0.45)).toBe(3);
  });

  it('no half-width: the field\'s decimals', () => {
    expect(shownDecimals(2, null, 1.234567)).toBe(2);
  });

  it('a width stated in grams carries into kilograms', () => {
    // 30.125 g typed: ±0.0005 g = ±5e-7 kg, shown in kg → 6 decimals.
    expect(shownDecimals(5, 5e-7, 0.030125, 'mass', 'kg')).toBe(6);
  });
});
