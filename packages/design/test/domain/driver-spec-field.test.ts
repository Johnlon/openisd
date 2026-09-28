/**
 * `OpenISDDriver.specField` — the dispatch from a runtime spec-field name to the driver's typed
 * handle, for a data-driven field table that has a name rather than a member. Reading, writing
 * and clearing all go through it, rather than each restating the same 55-case table.
 *
 * `field` is typed `NumericDriverSpecFieldName` (`DriverSpecFieldName` minus `VCCon`) so the
 * accessor is TOTAL — no null, no `!` at any call site
 * (BUG_20260927_ui-fakes-driver-cells.md). `VCCon` cannot even be passed; it stays on its own
 * dropdown, never this dispatch.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '@openisd/design';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';

describe('OpenISDDriver.specField — one name-to-handle dispatch, total over the numeric names', () => {
  it('returns the handle a write then reads back through', () => {
    const driver = OpenISDDriver.empty(createEngine());

    driver.specField('Fs_hz').set(111111);

    expect(driver.specField('Fs_hz').value).toBe(111111);
  });

  it('names the right accessor per field — two fields do not share one slot', () => {
    const driver = OpenISDDriver.empty(createEngine());

    driver.specField('Re_ohm').set(999999);
    driver.specField('Qts').set(222222);

    expect(driver.specField('Re_ohm').value).toBe(999999);
    expect(driver.specField('Qts').value).toBe(222222);
  });

  it('clears through the same handle, returning the field to not-stated', () => {
    const driver = OpenISDDriver.empty(createEngine());
    driver.specField('Sd_m2').set(123456);

    driver.specField('Sd_m2').clear();

    expect(driver.specField('Sd_m2').entered).toBe(false);
  });

  it('covers every numeric spec name the editor can ask for', () => {
    const driver = OpenISDDriver.empty(createEngine());
    const numericFields: NumericDriverSpecFieldName[] = [
      'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
      'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
      'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'numVC', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
      'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
      'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss', 'c_m_per_s', 'roo_kg_per_m3',
      'Vcd_m', 'Hg_m', 'Hc_m', 'freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg',
      'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m', 'OuterX_m',
      'OuterY_m', 'DVol_m3',
    ];

    // No `=== null` filter needed any more — the return type has no null to check for; this
    // proves it at runtime too, over every field, not just the compiler's say-so.
    for (const f of numericFields) expect(driver.specField(f)).not.toBeNull();
  });
});