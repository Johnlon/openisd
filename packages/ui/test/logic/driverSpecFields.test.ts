/**
 * `logic/driverSpecFields.ts` — the ONE dispatch from a runtime spec-field name to the driver's
 * typed accessor. `SpecField` never appears as a public parameter on `OpenISDDriver` itself
 * (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md), so the editor's data-driven field
 * table needs exactly one place that maps a name to a handle — and reading, writing and clearing
 * all go through it, rather than each restating the same 55-case table.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '@openisd/design/engine';
import {OpenISDDriver} from '@openisd/design';
import {specFieldHandle} from '../../src/logic/driverSpecFields.js';
import type {SpecField} from '../../src/logic/appState.js';

describe('specFieldHandle — one name-to-accessor dispatch', () => {
  it('returns the handle a write then reads back through', () => {
    const driver = OpenISDDriver.empty(new Engine());

    specFieldHandle(driver, 'Fs_hz')!.set(111111);

    expect(specFieldHandle(driver, 'Fs_hz')!.get().value).toBe(111111);
  });

  it('names the right accessor per field — two fields do not share one slot', () => {
    const driver = OpenISDDriver.empty(new Engine());

    specFieldHandle(driver, 'Re_ohm')!.set(999999);
    specFieldHandle(driver, 'Qts')!.set(222222);

    expect(specFieldHandle(driver, 'Re_ohm')!.get().value).toBe(999999);
    expect(specFieldHandle(driver, 'Qts')!.get().value).toBe(222222);
  });

  it('clears through the same handle, returning the field to not-stated', () => {
    const driver = OpenISDDriver.empty(new Engine());
    specFieldHandle(driver, 'Sd_m2')!.set(123456);

    specFieldHandle(driver, 'Sd_m2')!.clear();

    expect(specFieldHandle(driver, 'Sd_m2')!.get().state).not.toBe('entered');
  });

  it('answers null for VCCon — a wiring name, not a numeric cell', () => {
    const driver = OpenISDDriver.empty(new Engine());

    // `VCCon` holds a wiring NAME, not a number — it cannot be read as a numeric cell, so the
    // dispatch deliberately excludes it rather than asserting a type over it.
    expect(specFieldHandle(driver, 'VCCon')).toBeNull();
  });

  it('covers every SpecField the editor can ask for', () => {
    const driver = OpenISDDriver.empty(new Engine());
    // Every SpecField except VCCon, which is excluded above by design.
    const numericFields: SpecField[] = [
      'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
      'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
      'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'numVC', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
      'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
      'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss', 'c_m_per_s', 'roo_kg_per_m3',
      'Vcd_m', 'Hg_m', 'Hc_m', 'freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg',
      'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m', 'OuterX_m',
      'OuterY_m', 'DVol_m3',
    ];

    const missing = numericFields.filter(f => specFieldHandle(driver, f) === null);

    expect(missing, 'every numeric spec field must reach an accessor').toEqual([]);
  });
});