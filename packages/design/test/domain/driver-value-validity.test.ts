/**
 * Every driver spec field has its OWN floor (BUG_20260927_driver-bad-value-decided-in-ui.md,
 * follow-up 2026-09-27) — NOT one blanket "must be positive" rule. A decibel LEVEL relative to a
 * reference (`SPL_dB`, `SPLmax_dB`, `SPLmaxLF_dB`, `USPL_dB`) can be zero or negative; `Le_H`,
 * `KLe_H_sqrtHz`, `Znom_ohm` and `alfaVC_per_K` are legitimately zero but never negative. Every
 * other field is a magnitude that must be strictly positive. The floor for each field is
 * the field's own `NumberField.floor`, which this test pins field by field so a floor cannot
 * silently change without a failing test naming which one.
 *
 * Each field is driven through its own `.set()` — the same field the UI hooks already hold — and
 * the resulting `.dq` is checked, never the stored value: a bad value is kept exactly as entered,
 * only marked.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/index.js';
import type {DriverSpecFieldName} from '../../domain/index.js';

type NumSpecField = Exclude<DriverSpecFieldName, 'VCCon'>;

/** `toContainEqual`, not `toEqual`: setting one field can also disturb OTHERS' own
 *  missing-dependencies/inconsistent-inputs marks by the solver's normal cross-field relations
 *  (autoCalculate resolves on every `.set()`) — none of that is this floor's business. This
 *  checks the ONE mark this floor is responsible for, alongside whatever else is there. */
function field(engine: Engine, name: NumSpecField) {
  const driver = OpenISDDriver.empty(engine);
  return driver.specs[name];
}

// Regression for bugs/archive/BUG_20260927*.md
describe('driver spec-field value validity — every field has its OWN floor', () => {
  describe("'positive' floor — zero, negative or non-finite is not physical", () => {
    it.each([
      'Fs_hz', 'Re_ohm', 'fLe_hz', 'Qts', 'Qes', 'Qms', 'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg',
      'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m', 'Pe_W', 'Dd_m', 'EBP_hz', 'numVC',
      'Dia_m', 'Vd_m3', 'no', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A', 'Rme_kg_per_s',
      'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss', 'c_m_per_s', 'roo_kg_per_m3', 'Vcd_m',
      'Hg_m', 'Hc_m', 'freq_low_hz', 'freq_high_hz', 'power_peak_W', 'weight_kg', 'Thick_m',
      'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m', 'Outer_m', 'OuterX_m', 'OuterY_m',
      'DVol_m3',
    ] satisfies NumSpecField[])('%s', (name) => {
      const engine = createEngine();
      for (const value of [0, -1, NaN]) {
        const f = field(engine, name);
        f.set(value);
        expect(f.dq).toContainEqual(engine.issues.positiveValueIssue(value));
      }
    });
  });

  describe("'non-negative' floor — negative or non-finite is not physical, zero is fine", () => {
    it.each([
      'Le_H', 'KLe_H_sqrtHz', 'Znom_ohm', 'alfaVC_per_K',
    ] satisfies NumSpecField[])('%s', (name) => {
      const engine = createEngine();
      const zero = field(engine, name);
      zero.set(0);
      expect(zero.dq).not.toContainEqual(expect.objectContaining({kind: 'invalid-value'}));
      expect(zero.dq).not.toContainEqual(expect.objectContaining({kind: 'negative-value'}));

      for (const value of [-1, NaN]) {
        const f = field(engine, name);
        f.set(value);
        expect(f.dq).toContainEqual(engine.issues.nonNegativeValueIssue(value));
      }
    });
  });

  describe("'none' floor — a decibel LEVEL can be any value, zero or negative included", () => {
    it.each([
      'SPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB', 'USPL_dB',
    ] satisfies NumSpecField[])('%s', (name) => {
      const engine = createEngine();
      for (const value of [0, -3]) {
        const f = field(engine, name);
        f.set(value);
        expect(f.dq).not.toContainEqual(expect.objectContaining({kind: 'invalid-value'}));
        expect(f.dq).not.toContainEqual(expect.objectContaining({kind: 'negative-value'}));
      }
    });
  });

  it('leaves a not-entered field alone — absence is not a bad value', () => {
    const engine = createEngine();
    const driver = OpenISDDriver.empty(engine);
    expect(driver.specs.Fs_hz.dq).toEqual([]);
  });

  it('keeps the bad value exactly as entered, never coerced', () => {
    const engine = createEngine();
    const driver = OpenISDDriver.empty(engine);
    driver.specs.Fs_hz.set(-5);
    expect(driver.specs.Fs_hz.value).toBe(-5);
  });
});
