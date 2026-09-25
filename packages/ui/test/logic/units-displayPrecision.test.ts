import {describe, expect, it} from 'vitest';
import {displayPrecision} from '../../src/logic/fields/units.js';

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
