import { describe, it, expect } from 'vitest';
import {
  UNIT_GROUPS,
  groupUnits,
  defaultUnit,
  unitDef,
  toDisplay,
  fromDisplay,
  nextToken,
  displayPrecision,
  type UnitGroup,
} from '../src/fields/units.js';

const GROUPS = Object.keys(UNIT_GROUPS) as UnitGroup[];

describe('units — display unit registry (model stays SI; conversion at the boundary only)', () => {
  it('every group has ≥1 unit with a unique token, and the first is the canonical default', () => {
    for (const g of GROUPS) {
      const units = groupUnits(g);
      expect(units.length, `${g} needs at least one unit`).toBeGreaterThan(0);
      const tokens = new Set(units.map((u) => u.token));
      expect(tokens.size, `${g} tokens must be unique`).toBe(units.length);
      expect(defaultUnit(g)).toBe(units[0]);
      for (const u of units) {
        expect(u.label, `${g}/${u.token} needs a label`).toBeTruthy();
        expect(u.factor, `${g}/${u.token} factor must be finite > 0`).toBeGreaterThan(0);
      }
    }
  });

  it('toDisplay applies the factor (display = SI × factor); fromDisplay is its exact inverse', () => {
    // The whole point: the store holds SI, the screen shows SI × factor, typing divides back.
    expect(toDisplay(0.03, 'volume', 'L')).toBeCloseTo(30, 9); // 0.03 m³ → 30 L
    expect(toDisplay(0.1, 'length', 'cm')).toBeCloseTo(10, 9); // 0.1 m → 10 cm
    expect(toDisplay(0.1, 'length', 'mm')).toBeCloseTo(100, 9); // 0.1 m → 100 mm
    for (const g of GROUPS) {
      for (const u of groupUnits(g)) {
        const si = 0.1234;
        expect(fromDisplay(toDisplay(si, g, u.token), g, u.token), `${g}/${u.token} round-trip`).toBeCloseTo(si, 12);
      }
    }
  });

  it('an unknown token falls back to the group default (never throws, never NaN)', () => {
    expect(unitDef('length', 'furlong')).toBe(defaultUnit('length'));
    expect(toDisplay(0.1, 'length', 'furlong')).toBeCloseTo(10, 9); // falls back to cm
  });

  it('nextToken cycles through the group and wraps back to the first', () => {
    const seq = groupUnits('length').map((u) => u.token); // cm, mm, in
    let t = seq[0];
    const visited = [t];
    for (let i = 0; i < seq.length; i++) {
      t = nextToken('length', t);
      visited.push(t);
    }
    expect(visited).toEqual([...seq, seq[0]]); // full cycle returns to start
  });

  it('displayPrecision shrinks decimals for a coarser unit and grows them for a finer one', () => {
    // ventL is 1 dp in cm; in mm (×10 bigger number) it needs one fewer decimal.
    expect(displayPrecision(1, 'length', 'cm', 'cm')).toBe(1);
    expect(displayPrecision(1, 'length', 'cm', 'mm')).toBe(0);
    // A calculated Hz field at 1 dp needs more decimals once shown as kHz (÷1000).
    expect(displayPrecision(1, 'freq', 'Hz', 'kHz')).toBe(4);
    // Never negative.
    expect(displayPrecision(0, 'length', 'cm', 'mm')).toBe(0);
  });
});
