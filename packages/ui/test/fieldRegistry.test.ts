import { describe, it, expect } from 'vitest';
import { fieldSpecs, fieldById, precision } from '../src/fields/fieldRegistry.js';

describe('fieldRegistry — the numeric-field SSOT', () => {
  it('every spec is well-formed (unique id, integer precision ≥ 0, labelled, described)', () => {
    const seen = new Set<string>();
    for (const f of fieldSpecs) {
      expect(f.id, 'id must be non-empty').toBeTruthy();
      expect(seen.has(f.id), `duplicate field id "${f.id}"`).toBe(false);
      seen.add(f.id);
      expect(Number.isInteger(f.precision), `${f.id} precision must be an integer`).toBe(true);
      expect(f.precision, `${f.id} precision must be ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(f.label, `${f.id} needs a label`).toBeTruthy();
      expect(f.description, `${f.id} needs a description`).toBeTruthy();
    }
  });

  it('calculated fields carry a formula + dependency edges; entered fields carry neither', () => {
    for (const f of fieldSpecs) {
      if (f.provenance === 'calculated') {
        expect(f.formula, `${f.id} is calculated → needs a formula`).toBeTruthy();
        expect(f.dependsOn?.length, `${f.id} is calculated → needs dependsOn edges`).toBeGreaterThan(0);
      } else {
        expect(f.formula, `${f.id} is entered → must not have a formula`).toBeUndefined();
      }
    }
  });

  it('precision(id) returns the spec value and throws on an unknown id', () => {
    expect(precision('Rs')).toBe(fieldById('Rs')!.precision);
    expect(() => precision('does-not-exist')).toThrow(/no field/);
  });

  // Anchors the registry to the WinISD 0.7.0.950 screenshots (docs/winisd/INPUT_PARITY.md):
  // a stray dp change here fails loudly instead of silently diverging from the reference.
  it('matches the WinISD-sourced decimal places for the anchor fields', () => {
    expect(precision('Pin')).toBe(1); // System input power  140.0 W
    expect(precision('driveV')).toBe(1); // Driver input voltage 15.2 V
    expect(precision('Rs')).toBe(3); // Series resistance   0.100 ohm
    expect(precision('Vb')).toBe(2); // Box volume          6.00 l
  });
});
