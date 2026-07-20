import { describe, it, expect } from 'vitest';
import { fieldSpecs, fieldById, precision, limits } from '../src/fields/fieldRegistry.js';

describe('fieldRegistry — the canonical field data model', () => {
  it('every spec is well-formed (unique id, labelled, described, paned; numbers have integer precision ≥ 0)', () => {
    const seen = new Set<string>();
    for (const f of fieldSpecs) {
      expect(f.id, 'id must be non-empty').toBeTruthy();
      expect(seen.has(f.id), `duplicate field id "${f.id}"`).toBe(false);
      seen.add(f.id);
      expect(f.label, `${f.id} needs a label`).toBeTruthy();
      expect(f.description, `${f.id} needs a description`).toBeTruthy();
      expect(f.pane, `${f.id} needs a pane`).toBeTruthy();
      if (f.kind === 'number') {
        expect(Number.isInteger(f.precision), `${f.id} (number) precision must be an integer`).toBe(true);
        expect(f.precision, `${f.id} precision must be ≥ 0`).toBeGreaterThanOrEqual(0);
      } else {
        expect(f.precision, `${f.id} is ${f.kind} → must not carry a precision`).toBeUndefined();
      }
    }
  });

  it('sanity bounds are ordered (min < max where both are given)', () => {
    for (const f of fieldSpecs) {
      if (f.min !== undefined && f.max !== undefined) {
        expect(f.min, `${f.id}: min must be < max`).toBeLessThan(f.max);
      }
    }
  });

  it('modeled calculated fields carry a formula + dependency edges; entered fields carry neither', () => {
    for (const f of fieldSpecs) {
      if (f.provenance === 'calculated' && f.modeled) {
        expect(f.formula, `${f.id} is modeled+calculated → needs a formula`).toBeTruthy();
        expect(f.dependsOn?.length, `${f.id} is modeled+calculated → needs dependsOn edges`).toBeGreaterThan(0);
      }
      if (f.provenance === 'entered') {
        expect(f.formula, `${f.id} is entered → must not have a formula`).toBeUndefined();
      }
    }
  });

  it('enum fields list their options', () => {
    for (const f of fieldSpecs) {
      if (f.kind === 'enum') expect(f.options?.length, `${f.id} (enum) needs options`).toBeGreaterThan(0);
    }
  });

  it('precision(id)/limits(id) return the spec values and throw on an unknown id', () => {
    expect(precision('Rs')).toBe(fieldById('Rs')!.precision);
    expect(limits('Vb')).toEqual({ min: fieldById('Vb')!.min, max: fieldById('Vb')!.max });
    expect(() => precision('does-not-exist')).toThrow(/no field/);
    expect(() => limits('does-not-exist')).toThrow(/no field/);
  });

  // Anchors the registry to the WinISD 0.7.0.950 screenshots (docs/winisd/INPUT_PARITY.md):
  // a stray dp change here fails loudly instead of silently diverging from the reference.
  it('matches the WinISD-sourced decimal places for the anchor fields', () => {
    expect(precision('Pin')).toBe(1);    // System input power   140.0 W
    expect(precision('driveV')).toBe(1); // Driver input voltage 15.2 V
    expect(precision('Rs')).toBe(3);     // Series resistance    0.100 ohm
    expect(precision('Vb')).toBe(2);     // Box volume           6.00 l
    expect(precision('ventD')).toBe(2);  // Vent diameter        10.20 cm
    expect(precision('prSd')).toBe(1);   // PR Sd                95.0 cm²
    expect(precision('advTemp')).toBe(2); // Temperature         293.15 K
    // Deliberate documented divergences from WinISD's literal dp (sane values / unit-adjusted):
    expect(precision('advHumidity')).toBe(1); // WinISD 4 dp (30.0000 %) is spurious → 1 dp
    expect(precision('advPressure')).toBe(2); // kPa 2 dp, vs WinISD's Pa 1 dp
  });
});
