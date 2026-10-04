import {describe, expect, it} from 'vitest';
import type {DriverIssue, DriverSolverParams, SolverField} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {checkConsistency, fakeSolverField} from './testSolver.js';

const engine = createEngine();

// Deliberately NOT the reference condition (`engine.environment.solve({}).values`): `solveConsistencyGroup`'s own
// internal driverC/driverRho fallback already defaults to reference air on its own, so a test
// using reference air here would pass even if `solveDriver` never threaded `air` through at all.
const AIR = engine.environment.solve({ tempK: 350 }).values;

function fakeWiringField(value: 'series' | 'parallel' | null): SolverField<'series' | 'parallel'> {
  let current = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get precision() { return null; },
    get dq() { return []; },
    setCalculated(v: 'series' | 'parallel') { current = v; state = 'calculated'; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NUMERIC_DRIVER_FIELDS = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
  'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
  'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
  'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
  'Re_terminal_ohm', 'BL_terminal_Tm', 'numVC',
] as const satisfies readonly (keyof Omit<DriverSolverParams, 'wiring'>)[];

/** A full `DriverSolverParams` of `not-available` fakes, with `entered` overriding a subset.
 *  `precision` states a subset's own reading precision explicitly (D13); a field left out of it
 *  falls back to `fakeSolverField`'s own auto-`halfUlp(value)` default. */
function driverParams(
  entered: Partial<Record<typeof NUMERIC_DRIVER_FIELDS[number], number>>,
  precision: Partial<Record<typeof NUMERIC_DRIVER_FIELDS[number], number>> = {},
): DriverSolverParams {
  const e = (key: typeof NUMERIC_DRIVER_FIELDS[number]): SolverField =>
    fakeSolverField(entered[key] ?? null, precision[key]);
  return {
    Fs_hz: e('Fs_hz'), Re_ohm: e('Re_ohm'), Znom_ohm: e('Znom_ohm'), Le_H: e('Le_H'),
    fLe_hz: e('fLe_hz'), KLe_H_sqrtHz: e('KLe_H_sqrtHz'), Qes: e('Qes'), Qms: e('Qms'),
    Qts: e('Qts'), Vas_m3: e('Vas_m3'), Sd_m2: e('Sd_m2'), Dd_m: e('Dd_m'), BL_Tm: e('BL_Tm'),
    Mms_kg: e('Mms_kg'), Cms_m_per_N: e('Cms_m_per_N'), Rms_kg_per_s: e('Rms_kg_per_s'),
    EBP_hz: e('EBP_hz'), Xmax_m: e('Xmax_m'), Vd_m3: e('Vd_m3'), Hc_m: e('Hc_m'), Hg_m: e('Hg_m'),
    Pe_W: e('Pe_W'), no: e('no'), SPLref_dB: e('SPLref_dB'), SPL_dB: e('SPL_dB'),
    USPL_dB: e('USPL_dB'), SPLmax_dB: e('SPLmax_dB'), SPLmaxLF_dB: e('SPLmaxLF_dB'),
    Rme_kg_per_s: e('Rme_kg_per_s'), Mpow_N_per_sqrtW: e('Mpow_N_per_sqrtW'),
    Mcost_kg_per_s: e('Mcost_kg_per_s'), gamma_m_per_s2_A: e('gamma_m_per_s2_A'), Gloss: e('Gloss'),
    Vcd_m: e('Vcd_m'), Depth_m: e('Depth_m'), MagDepth_m: e('MagDepth_m'), Magnet_m: e('Magnet_m'),
    DVol_m3: e('DVol_m3'),
    c_m_per_s: e('c_m_per_s'), roo_kg_per_m3: e('roo_kg_per_m3'),
    Re_terminal_ohm: e('Re_terminal_ohm'), BL_terminal_Tm: e('BL_terminal_Tm'), numVC: e('numVC'),
    wiring: fakeWiringField(null),
  };
}

describe('Engine.checkConsistency', () => {
  describe('Engine.checkConsistency', () => {
    it('returns no issues for a self-consistent driver', () => {
      const Qes = 0.4, Qms = 3.0;
      const Qts = (Qes * Qms) / (Qes + Qms);
      const issues = checkConsistency({ Qts, Qes, Qms });
      expect(issues).toEqual([]);
    });

    it('reports an inconsistent-inputs issue when Qts contradicts Qes/Qms', () => {
      // 3.5 is a genuine, large disagreement with Qes/Qms's implied ~0.35 (D12), and — deliberately
      // — still inside Qts's own physical band (0.01–5.0, D5/O4): this test is about the
      // inconsistent-inputs channel alone, not the range channel (`physicalRange.test.ts` covers
      // that one).
      const Qes = 0.4, Qms = 3.0;
      const issues = checkConsistency({ Qts: 3.5, Qes, Qms });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        kind: 'inconsistent-inputs',
        target: 'Qts',
        fields: ['Qts', 'Qes', 'Qms'],
        actual: 3.5,
      });
    });

    it('reports a missing-dependencies issue for Qts when fewer than two of Qts/Qes/Qms are stated', () => {
      const issues = checkConsistency({ Qes: 0.4 });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        kind: 'missing-dependencies',
        target: 'Qts',
      });
      if (issues[0].kind === 'missing-dependencies') {
        expect(issues[0].routes).toEqual([
          { formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] },
        ]);
      }
    });

    it('reports a missing-dependencies issue for the trio even when Qts ITSELF is entered — the group has no route with fewer than two of three stated (S9a Cluster 6)', () => {
      const issues = checkConsistency({ Qts: 0.38 });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        kind: 'missing-dependencies',
        target: 'Qts',
      });
      if (issues[0].kind === 'missing-dependencies') {
        expect(issues[0].routes).toEqual([
          { formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qes', 'Qms'] },
        ]);
      }
    });
  });

  // D13/D12: each entered field's own tolerance is its stated reading precision (or, absent a
  // reading, half the last decimal it was typed to) — never a fixed per-relation allowance. These
  // port the "rounding artifacts must not fire, genuine errors still do" cases from
  // winisd_tools/scrapers/scrapers/lib/semantic_dq.py's own test suite, against the real solver
  // (`driverParams` + `Engine.solveDriver`, not the plain bag wrapper) so each case's OWN stated
  // precision — not an auto-derived one — decides the outcome.
  describe('Engine.checkConsistency — precision-derived tolerance, not a fixed allowance (D12/D13)', () => {
    function inconsistentInputIssues(p: DriverSolverParams): readonly DriverIssue[] {
      return engine.driver.solve(p, AIR).filter((i): i is DriverIssue => i.kind === 'inconsistent-inputs');
    }

    it('a coarse-precision stated Vas is absorbed by Sd/Cms rounding — no issue', () => {
      const p = driverParams(
        { Vas_m3: 0.0180, Sd_m2: 0.013, Cms_m_per_N: 0.0007 },
        { Vas_m3: 0.00005, Sd_m2: 0.0005, Cms_m_per_N: 0.00005 },
      );
      expect(inconsistentInputIssues(p)).toEqual([]);
    });

    it('the SAME stated Vas fires once Sd/Cms are stated to a tighter precision', () => {
      const p = driverParams(
        { Vas_m3: 0.0180, Sd_m2: 0.013, Cms_m_per_N: 0.0007 },
        { Vas_m3: 0.00005, Sd_m2: 0.000005, Cms_m_per_N: 0.0000005 },
      );
      const issues = inconsistentInputIssues(p);
      expect(issues).toContainEqual(expect.objectContaining({ target: 'Vas_m3' }));
    });

    it('a gross Qts error still fires despite typed-to-two-decimals precision', () => {
      const p = driverParams(
        { Qts: 0.60, Qes: 0.50, Qms: 4.75 },
        { Qts: 0.005, Qes: 0.005, Qms: 0.005 },
      );
      const issues = inconsistentInputIssues(p);
      expect(issues).toContainEqual(expect.objectContaining({ target: 'Qts', actual: 0.60 }));
    });

    it('a gross EBP error still fires despite each field\'s own typed precision', () => {
      const p = driverParams(
        { EBP_hz: 120, Fs_hz: 43.0, Qes: 0.40 },
        { EBP_hz: 0.5, Fs_hz: 0.05, Qes: 0.005 },
      );
      const issues = inconsistentInputIssues(p);
      expect(issues).toContainEqual(expect.objectContaining({ target: 'EBP_hz' }));
    });

    it('a consistent Fs/Qts/Qes/Qms record reports nothing', () => {
      const p = driverParams(
        { Fs_hz: 43.0, Qts: 0.45, Qes: 0.50, Qms: 4.75 },
        { Qts: 0.005, Qes: 0.005, Qms: 0.005 },
      );
      expect(inconsistentInputIssues(p)).toEqual([]);
    });

    it('acceptance: w5-1138smf\'s own real Qts/Qes/Qms readings and their real read_precision (0.005 each) report no issue', () => {
      const p = driverParams(
        { Qts: 0.49, Qes: 0.57, Qms: 3.56 },
        { Qts: 0.005, Qes: 0.005, Qms: 0.005 },
      );
      expect(inconsistentInputIssues(p)).toEqual([]);
    });
  });

  describe('Engine.checkConsistency — RELATIONS loop non-finite guards', () => {
    it('skips a relation whose predicted value is not finite instead of reporting a spurious mismatch', () => {
      const issues = checkConsistency({ Mpow_N_per_sqrtW: 5, BL_Tm: 6, Re_ohm: 0 });
      // Re_ohm = 0 makes "Mpow = Bl/√Re" predict Infinity (division by zero); that relation must be
      // skipped rather than reported as inconsistent.
      expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.formula === 'Mpow = Bl/√Re')).toBe(false);
    });

    it('excludes a bumped field from the tolerance when its bumped prediction overflows to Infinity', () => {
      const Sd_m2 = Number.MAX_VALUE, Xmax_m = 1e-300;
      const issues = checkConsistency({ Sd_m2, Xmax_m });
      // Vd = Sd·Xmax derives a finite Vd_m3; bumping Sd_m2 by its own half-ulp overflows the
      // product to Infinity, so that arm must be excluded from the tolerance sum rather than
      // reported or allowed to poison it with a non-finite value.
      expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.formula === 'Vd = Sd·Xmax')).toBe(false);
    });
  });
});
