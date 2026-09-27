/**
 * Every driver spec field shares ONE floor: zero, negative or non-finite is not a physical
 * value, whatever field it is (BUG_20260927_driver-bad-value-decided-in-ui.md). This was a
 * UI-only `!(v > 0)` check before (DriverEditorModal-hooks.ts `isBadValue`, OgTune-hooks.ts's
 * own copy), never reaching the domain. `Engine.positiveValueIssue` is the SAME method
 * `box-volume-validity.test.ts` already pins for box volumes
 * (BUG_20260927_box-volume-validity-decided-in-ui.md) — a box volume is one instance of a value
 * that must be positive; a driver spec field is another, so this reuses the identical
 * `InvalidValueIssue` kind rather than a near-duplicate.
 *
 * Each field is driven to 0 / negative / NaN through its own `.set()` — the same field the UI
 * hooks already hold — and the resulting `.dq` is checked, never the stored value: a bad value
 * is kept exactly as entered, only marked.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/index.js';
import type {DriverSpecFieldName} from '../../domain/index.js';

type NumSpecField = Exclude<DriverSpecFieldName, 'VCCon'>;

/** `toContainEqual`, not `toEqual`: setting one field can also disturb OTHERS' own
 *  missing-dependencies/inconsistent-inputs marks by the solver's normal cross-field relations
 *  (autoCalculate resolves on every `.set()`) — none of that is this floor's business. This
 *  checks the ONE mark this floor is responsible for, alongside whatever else is there. */
function expectInvalidValueAtEachBadValue(field: {set(v: number): void; dq: readonly unknown[]}) {
  for (const value of [0, -1, NaN]) {
    field.set(value);
    expect(field.dq).toContainEqual({kind: 'invalid-value', value});
  }
}

describe('driver spec-field value validity — every numeric field shares one floor (BUG_20260927)', () => {
  it.each([
    'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
    'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
    'SPL_dB', 'Pe_W', 'Dd_m', 'numVC', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
    'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
    'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss', 'c_m_per_s', 'roo_kg_per_m3',
    'Vcd_m', 'Hg_m', 'Hc_m', 'freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg',
    'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m', 'OuterX_m',
    'OuterY_m', 'DVol_m3',
  ] satisfies NumSpecField[])('%s', (field) => {
    const engine = new Engine();
    const driver = OpenISDDriver.empty(engine);
    expectInvalidValueAtEachBadValue(driver.specs[field]);
  });

  it('EBP_hz is a calculation, not an entered field — excluded from this table, not exempt from the floor', () => {
    // EBP_hz has no `.set()` (it is derived from Fs/Qes), so it cannot carry a BAD entered
    // value at all — nothing to mark. Every field that CAN be entered is covered above.
  });

  it('leaves a not-entered field alone — absence is not a bad value', () => {
    const engine = new Engine();
    const driver = OpenISDDriver.empty(engine);
    expect(driver.specs.Fs_hz.dq).toEqual([]);
  });

  it('keeps the bad value exactly as entered, never coerced', () => {
    const engine = new Engine();
    const driver = OpenISDDriver.empty(engine);
    driver.specs.Fs_hz.set(-5);
    expect(driver.specs.Fs_hz.value).toBe(-5);
  });
});
