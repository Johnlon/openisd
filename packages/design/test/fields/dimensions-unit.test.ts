import {describe, expect, it} from 'vitest';
import {
  decimalsIn,
  isTokenIn,
  parseEntry,
  toDisplay,
  toDisplayDelta,
  toSI,
  unitFor,
} from '../../fields/dimensions.js';

describe('dimensions unit authority', () => {
  it('isTokenIn validates tokens strictly by group', () => {
    expect(isTokenIn('length', 'mm')).toBe(true);
    expect(isTokenIn('length', 'L')).toBe(false);
    expect(isTokenIn('length', 123)).toBe(false);
    expect(isTokenIn('volume', 'cuft')).toBe(true);
  });

  it('unitFor resolves switchable and fixed units', () => {
    const sw = unitFor({ kind: 'switchable', group: 'length', base: 'mm' }, 'in');
    expect(sw.kind).toBe('switchable');
    if (sw.kind === 'switchable') {
      expect(sw.token).toBe('in');
      expect(sw.factor).toBeCloseTo(39.3701, 4);
    }

    const fixed = unitFor({ kind: 'fixed', symbol: 'Ω' }, 'kHz');
    expect(fixed).toEqual({ kind: 'fixed', label: 'Ω' });
  });

  it('toDisplay and toSI convert values symmetrically', () => {
    const tempDegC = unitFor({ kind: 'switchable', group: 'temp', base: 'degC' });
    expect(toDisplay(tempDegC, 273.15)).toBeCloseTo(0, 5);
    expect(toSI(tempDegC, 0)).toBeCloseTo(273.15, 5);

    const lenMm = unitFor({ kind: 'switchable', group: 'length', base: 'mm' });
    expect(toDisplay(lenMm, 0.0254)).toBeCloseTo(25.4, 5);
    expect(toSI(lenMm, 25.4)).toBeCloseTo(0.0254, 5);
  });

  it('toDisplayDelta scales uncertainty without additive offsets', () => {
    const tempDegC = unitFor({ kind: 'switchable', group: 'temp', base: 'degC' });
    expect(toDisplayDelta(tempDegC, 0.5)).toBe(0.5);
  });

  it('decimalsIn calculates display decimals based on unit factor shift', () => {
    const lenMm = unitFor({ kind: 'switchable', group: 'length', base: 'cm' }, 'mm');
    // base 3 dp in cm (0.001 cm = 0.01 mm) shifted by log10(10) = 1 -> 2 dp in mm
    expect(decimalsIn(lenMm, 3)).toBe(2);
  });

  it('parseEntry handles standard, scientific, and locale numbers cleanly', () => {
    const lenMm = unitFor({ kind: 'switchable', group: 'length', base: 'mm' });
    const res = parseEntry(lenMm, ' 25.4 ');
    expect(res.kind).toBe('quantity');
    if (res.kind === 'quantity') {
      expect(res.valueSI).toBeCloseTo(0.0254, 5);
      expect(res.halfWidthSI).toBeCloseTo(0.00005, 7);
    }

    const malformed = parseEntry(lenMm, '15.2.4');
    expect(malformed.kind).toBe('text');

    const arabic = parseEntry(lenMm, '٢٥٫٤');
    expect(arabic.kind).toBe('quantity');
  });
});
