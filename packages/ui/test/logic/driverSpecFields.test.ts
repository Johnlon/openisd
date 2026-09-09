/**
 * `logic/driverSpecFields.ts` — the ONE dispatch from a runtime spec-field name to the driver's
 * typed accessor. `SpecField` never appears as a public parameter on `OpenISDDriver` itself
 * (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md), so the editor's data-driven field
 * table needs exactly one place that maps a name to a handle — and reading, writing and clearing
 * all go through it, rather than each restating the same 55-case table.
 */
import { describe, it, expect } from 'vitest';
import { Engine } from '@openisd/design/engine';
import { OpenISDDriver } from '@openisd/design';
import { specFieldHandle } from '../../src/logic/driverSpecFields.js';

describe('specFieldHandle — one name-to-accessor dispatch', () => {
  it('returns the handle a write then reads back through', () => {
    const driver = OpenISDDriver.empty(new Engine());

    specFieldHandle(driver, 'Fs')!.set(111111);

    expect(specFieldHandle(driver, 'Fs')!.get().value).toBe(111111);
  });

  it('names the right accessor per field — two fields do not share one slot', () => {
    const driver = OpenISDDriver.empty(new Engine());

    specFieldHandle(driver, 'Re')!.set(999999);
    specFieldHandle(driver, 'Qts')!.set(222222);

    expect(specFieldHandle(driver, 'Re')!.get().value).toBe(999999);
    expect(specFieldHandle(driver, 'Qts')!.get().value).toBe(222222);
  });

  it('clears through the same handle, returning the field to not-stated', () => {
    const driver = OpenISDDriver.empty(new Engine());
    specFieldHandle(driver, 'Sd')!.set(123456);

    specFieldHandle(driver, 'Sd')!.clear();

    expect(specFieldHandle(driver, 'Sd')!.get().state).not.toBe('entered');
  });

  it('answers null for a name the numeric table does not own', () => {
    const driver = OpenISDDriver.empty(new Engine());

    // `VCCon` holds a wiring NAME, not a number — it cannot be read as a numeric cell, so the
    // table deliberately excludes it rather than asserting a type over it.
    expect(specFieldHandle(driver, 'VCCon')).toBeNull();
    expect(specFieldHandle(driver, 'not-a-field')).toBeNull();
  });

  it('covers every name the editor\'s field table can ask for', () => {
    const driver = OpenISDDriver.empty(new Engine());
    // Every SpecField except VCCon, which is excluded above by design.
    const numericFields = [
      'Fs', 'Re', 'Le', 'fLe', 'KLe', 'Znom', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'BL',
      'Mms', 'Cms', 'Rms', 'Xmax', 'Xlim', 'SPL', 'Pe', 'Dd', 'EBP', 'numVC',
      'Dia', 'Vd', 'no', 'SPLmax', 'SPLmaxLF', 'USPL', 'alfaVC', 'Rt', 'Ct', 'gamma',
      'Rme', 'Mpow', 'Mcost', 'Gloss', 'c', 'roo', 'Vcd', 'Hg', 'Hc', 'freq_low_hz',
      'freq_high_hz', 'power_peak_W', 'weight_kg', 'Thick', 'Depth', 'MagDepth', 'Magnet',
      'Basket', 'Outer', 'OuterX', 'OuterY', 'DVol',
    ];

    const missing = numericFields.filter(f => specFieldHandle(driver, f) === null);

    expect(missing, 'every numeric spec field must reach an accessor').toEqual([]);
  });
});
