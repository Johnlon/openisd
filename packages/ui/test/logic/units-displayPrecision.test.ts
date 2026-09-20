import {describe, expect, it} from 'vitest';
import {displayPrecision} from '../../src/logic/fields/units.js';

// The registry declares ONE precision per field, in the field's base unit. Rotating the unit
// derives the shown decimals from that (a ×10 coarser unit shows one fewer, a ÷10 finer one
// more) — but a conversion must never pile up meaningless zeros: 100 g at 5 dp is 0.1 kg, not
// 0.10000000 kg. The cap applies to CONVERTED units only; a field shown in its own base unit
// keeps exactly the precision the registry gave it (KLe is 6 dp, Rme 5 dp).
describe('displayPrecision', () => {
  it('shows the registry precision unchanged in the base unit, even above the conversion cap', () => {
    expect(displayPrecision(5, 'mass', 'g', 'g')).toBe(5);
    expect(displayPrecision(6, 'resistance', 'Ns/m', 'Ns/m')).toBe(6);
    expect(displayPrecision(1, 'length', 'cm', 'cm')).toBe(1);
  });

  it('shrinks decimals for a coarser unit and grows them for a finer one', () => {
    expect(displayPrecision(1, 'length', 'cm', 'mm')).toBe(0);
    expect(displayPrecision(1, 'freq', 'Hz', 'kHz')).toBe(4);
    expect(displayPrecision(0, 'length', 'cm', 'mm')).toBe(0);
  });

  it('caps a converted unit at 4 dp so grams → kilograms never shows runaway zeros', () => {
    expect(displayPrecision(5, 'mass', 'g', 'kg')).toBe(4);
    expect(displayPrecision(6, 'mass', 'g', 'kg')).toBe(4);
  });
});
