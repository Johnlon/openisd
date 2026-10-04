import {describe, expect, it, vi} from 'vitest';
import type {DriverSolverParams, SolverField} from '../../engine/index.js';
import {DEFAULT_P_REF_PA, createEngine} from '../../engine/index.js';
import type {TestSolverQuantities} from './testSolver.js';
import {checkConsistency, fakeSolverField, solveConsistencyGroup} from './testSolver.js';
import assert from 'node:assert/strict';
import {knownDecimals} from '../../fields/precision.js';

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

/** Every `TestSolverQuantities` member is optional, since a solve fills only what it can. A
 *  test that reaches for one arithmetically has already asserted (or is about to assert) that
 *  the solve produced it — this makes that assumption a loud failure instead of a silent
 *  `undefined - x = NaN`. */
function num(v: number | undefined): number {
  assert.ok(v !== undefined, 'expected a solved numeric value, got undefined');
  return v;
}

// TYPED, so a name the solver does not have is a build error rather than a silent `undefined`.
const solve = (d: TestSolverQuantities): Readonly<TestSolverQuantities> => solveConsistencyGroup(d);

/**
 * The probe's Re-swept cases, transcribed from `runs/znom_state.jsonl` by label: the `Re` typed
 * in, and the `Znom` WinISD showed afterwards (all marked `C` — WinISD computed them).
 */
const PROBE: ReadonlyArray<readonly [label: string, Re: number, Znom: number]> = [
  ['Z_tie_re0.6',      0.6,                0],
  ['Z_absent_re1.5',   1.5,                2],
  ['Z_tie_re2.',       2,                  4],
  ['Z_absent_re3.2',   3.2,                4],
  ['Z_tie_re3.333333', 3.3333333333333335, 6],
  ['Z_absent_re4',     4,                  6],
  ['Z_tie_re4.666667', 4.666666666666667,  8],
  ['Z_absent_re5.5',   5.5,                8],
  ['Z_absent_re6',     6,                  8],
  ['Z_tie_re7.333333', 7.333333333333333, 10],
  ['Z_absent_re8',     8,                 12],
  ['Z_absent_re9',     9,                 14],
  ['Z_tie_re10.',      10,                16],
  ['Z_absent_re12',    12,                18],
  ['Z_absent_re27',    27,                40],
  ['Z_absent_re123',   123,              184],
];

/**
 * A driver complete enough for the full solver, minus `Re` and `Znom` — the probe's own entered
 * set for `Z_absent_re*` with those two removed.
 */
const BASE: Record<string, number> = {
  Fs_hz: 40.0, Mms_kg: 0.00194848430081419, Cms_m_per_N: 0.008124999999999992,
  Sd_m2: 0.022, Qms: 2.1, BL_Tm: 6.0, Xmax_m: 0.0067, Pe_W: 100,
};

const AIR_E = engine.environment.solve({}).values;

/** Qts = Qes·Qms/(Qes+Qms); its half-width is Σ |∂Qts/∂input| · input half-width. */
function qtsHalfWidth(qes: number, dQes: number, qms: number, dQms: number): number {
  const s = (qes + qms) ** 2;
  return (qms * qms / s) * dQes + (qes * qes / s) * dQms;
}

describe('Engine.solveDriver', () => {
  describe('Engine.solveDriver — handle solve, values written onto the params', () => {
    it('writes the derived Qts onto its handle when Qes and Qms are entered', () => {
      const Qes = 0.4, Qms = 3.0;
      const p = driverParams({ Qes, Qms });
      const issues = engine.driver.solve(p, AIR);
      expect(p.Qts.value).toBeCloseTo((Qes * Qms) / (Qes + Qms), 12);
      expect(p.Qts.calculated).toBe(true);
      expect(issues).toEqual([]);
    });

    it('never overwrites an entered value even when it disagrees with the derived value', () => {
      const Qes = 0.4, Qms = 3.0;
      const p = driverParams({ Qes, Qms, Qts: 7.5 });
      const issues = engine.driver.solve(p, AIR);
      expect(p.Qts.value).toBe(7.5);
      expect(p.Qts.entered).toBe(true);
      expect(issues).toEqual(checkConsistency({ Qts: 7.5, Qes, Qms }));
    });

    it('leaves an underivable non-entered field not-available', () => {
      const p = driverParams({ Qes: 0.4 });
      engine.driver.solve(p, AIR);
      expect(p.Qts.value).toBeNull();
    });

    it('returns the same issues checkConsistency would for the same entered numbers', () => {
      const input: TestSolverQuantities = { Qes: 0.4 };
      const p = driverParams({ Qes: 0.4 });
      const issues = engine.driver.solve(p, AIR);
      expect(issues).toEqual(checkConsistency(input));
    });

    it('a not-entered c_m_per_s defaults to the given air and is written back as calculated', () => {
      const p = driverParams({});
      const write = vi.spyOn(p.c_m_per_s, 'setCalculated');
      engine.driver.solve(p, AIR);
      expect(write).toHaveBeenCalledWith(AIR.c);
      expect(p.c_m_per_s.value).toBe(AIR.c);
    });

    it('a not-entered roo_kg_per_m3 defaults to the given air and is written back as calculated', () => {
      const p = driverParams({});
      const write = vi.spyOn(p.roo_kg_per_m3, 'setCalculated');
      engine.driver.solve(p, AIR);
      expect(write).toHaveBeenCalledWith(AIR.rho);
      expect(p.roo_kg_per_m3.value).toBe(AIR.rho);
    });

    it('an entered c_m_per_s is never overwritten by the given air', () => {
      const p = driverParams({ c_m_per_s: 111111 });
      engine.driver.solve(p, AIR);
      expect(p.c_m_per_s.value).toBe(111111);
      expect(p.c_m_per_s.entered).toBe(true);
    });
  });

  // The outer `air` parameter only ever pre-fills a NOT-ENTERED c_m_per_s/roo_kg_per_m3 (always
  // positive), so driverC/driverRho's own fallback arms — reached when a record enters one of
  // these as non-positive — are otherwise dead from `solveDriver`'s call site alone.
  describe('Engine.solveDriver — driverC/driverRho reference-air fallback', () => {
    it('recomputes c from an entered roo when c_m_per_s is entered non-positive', () => {
      const GAMMA = 1.4; // local oracle — engine/index.ts never re-exports the private air constant (air.test.ts precedent).
      const roo = 1.1, Vas_m3 = 0.05, Cms_m_per_N = 0.0009;
      const p = driverParams({ c_m_per_s: 0, roo_kg_per_m3: roo, Vas_m3, Cms_m_per_N });
      engine.driver.solve(p, AIR);
      // roo·c² collapses to γ·Pref regardless of roo once c = √(γ·Pref/roo), so Sd is predictable
      // without importing the private GAMMA/efficiency formulas.
      expect(p.Sd_m2.value).toBeCloseTo(Math.sqrt(Vas_m3 / (GAMMA * DEFAULT_P_REF_PA * Cms_m_per_N)), 9);
    });

    it('falls back to the reference environment when both c_m_per_s and roo_kg_per_m3 are entered non-positive', () => {
      const ref = engine.environment.solve({}).values;
      const Vas_m3 = 0.05, Cms_m_per_N = 0.0009;
      const p = driverParams({ c_m_per_s: 0, roo_kg_per_m3: 0, Vas_m3, Cms_m_per_N });
      engine.driver.solve(p, AIR);
      expect(p.Sd_m2.value).toBeCloseTo(Math.sqrt(Vas_m3 / (ref.rho * ref.c * ref.c * Cms_m_per_N)), 9);
    });
  });

  describe('Engine.solveDriver — Thiele/Small routes not otherwise exercised', () => {
    it('derives Mms from Fs/Qms/Rms', () => {
      const Fs_hz = 40, Qms = 3.0, Rms_kg_per_s = 0.5;
      const p = driverParams({ Fs_hz, Qms, Rms_kg_per_s });
      engine.driver.solve(p, AIR);
      expect(p.Mms_kg.value).toBeCloseTo((Rms_kg_per_s * Qms) / (2 * Math.PI * Fs_hz), 12);
    });

    it('derives Mms from Qes/Bl/Fs/Re', () => {
      const Qes = 0.4, BL_Tm = 6, Fs_hz = 40, Re_ohm = 6;
      const p = driverParams({ Qes, BL_Tm, Fs_hz, Re_ohm });
      engine.driver.solve(p, AIR);
      expect(p.Mms_kg.value).toBeCloseTo((Qes * BL_Tm * BL_Tm) / (2 * Math.PI * Fs_hz * Re_ohm), 12);
    });

    it('derives Hg from Hc/Xmax on the equal-or-under overhang arm (Hc <= 2·Xmax)', () => {
      const Xmax_m = 0.005, Hc_m = 0.005;
      const p = driverParams({ Xmax_m, Hc_m });
      engine.driver.solve(p, AIR);
      expect(p.Hg_m.value).toBeCloseTo(Hc_m + 2 * Xmax_m, 12);
    });

    it('falls back to deriving Sd from Vd/Xmax when Sd is not otherwise derivable', () => {
      const Vd_m3 = 0.0002, Xmax_m = 0.005;
      const p = driverParams({ Vd_m3, Xmax_m });
      engine.driver.solve(p, AIR);
      expect(p.Sd_m2.value).toBeCloseTo(Vd_m3 / Xmax_m, 12);
    });

    it('recovers Qes from η₀/Fs/Vas — round trip through the same relation the forward η₀ route uses', () => {
      const Fs_hz = 40, Vas_m3 = 0.05, Qes0 = 0.4;
      const p1 = driverParams({ Fs_hz, Vas_m3, Qes: Qes0 });
      engine.driver.solve(p1, AIR);
      const no0 = p1.no.value!;
      expect(no0).not.toBeNull();

      const p2 = driverParams({ Fs_hz, Vas_m3, no: no0 });
      engine.driver.solve(p2, AIR);
      expect(p2.Qes.value).toBeCloseTo(Qes0, 9);
    });
  });

  describe('Engine.solveDriver — USPL/SPLref/Re routes', () => {
    const V283_SQ = 2.83 * 2.83;

    it('derives Re from a stated USPL and SPL', () => {
      const Re_ohm = 6.4, SPL_dB = 90;
      const USPL_dB = SPL_dB + 10 * Math.log10(V283_SQ / Re_ohm);
      const p = driverParams({ SPL_dB, USPL_dB });
      engine.driver.solve(p, AIR);
      expect(p.Re_ohm.value).toBeCloseTo(Re_ohm, 9);
    });

    it('derives SPLref from a stated USPL and Re', () => {
      const Re_ohm = 6.4, SPLref_dB = 90;
      const USPL_dB = SPLref_dB + 10 * Math.log10(V283_SQ / Re_ohm);
      const p = driverParams({ Re_ohm, USPL_dB });
      engine.driver.solve(p, AIR);
      expect(p.SPLref_dB.value).toBeCloseTo(SPLref_dB, 9);
    });
  });

  describe('Engine.solveDriver — enteredDriverValue null handling', () => {
    it('never writes back a handle that reports entered with a null value', () => {
      let observedValue: number | null = null;
      const enteredButNull: SolverField = {
        get value() { return observedValue; },
        get entered() { return true; },
        get calculated() { return false; },
        get precision() { return null; },
        get dq() { return []; },
        setCalculated(v: number) { observedValue = v; },
        setDq() {},
        setNotAvailable() {},
      };
      const Qes = 0.4, Qms = 3.0;
      const p = driverParams({ Qes, Qms });
      p.Qts = enteredButNull;
      const issues = engine.driver.solve(p, AIR);
      // `entered: true` with `value: null` cannot arise from `fakeSolverField`'s own invariant, but
      // `enteredDriverValue`'s `?? undefined` must still treat it as absent for solving — the group
      // still resolves Qts from Qes/Qms internally — while `writeDriverBack`'s `if (field.entered)
      // return` means this handle is never told the result.
      expect(observedValue).toBeNull();
      expect(issues).toEqual([]);
    });
  });

  describe('Engine.solveDriver — nominalImpedance guards a non-finite Re', () => {
    it('yields a calculated NaN Znom when Re_ohm is entered as Infinity (Infinity > 0 but not isFinite)', () => {
      const p = driverParams({ Re_ohm: Infinity });
      engine.driver.solve(p, AIR);
      // The Znom-from-Re block guards only `Re_ohm > 0` (true for Infinity) and assigns
      // `nominalImpedance(Re_ohm)` directly, bypassing `setVal`'s own isFinite check — so
      // `nominalImpedance`'s own `!isFinite(Re)` guard is what actually stops this at NaN.
      expect(p.Znom_ohm.value).toBeNaN();
      expect(p.Znom_ohm.calculated).toBe(true);
    });
  });

  describe('solveConsistencyGroup — full fixpoint solver mode', () => {
    // The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): any one member
    // solves from the other three plus Dd and Vcd. Geometry from the DVol geometry block above's worked
    // example — Dd 90mm, Vcd 25mm, Depth 55mm, MagDepth 20mm, Magnet 60mm.
    const GEOM = { Dd_m: 0.090, Vcd_m: 0.025, Depth_m: 0.055, MagDepth_m: 0.020, Magnet_m: 0.060 } as const;
    const DVOL = (Math.PI / 4) * ((0.090 ** 2 + 0.090 * 0.025 + 0.025 ** 2) * (0.055 - 0.020) / 3
      + 0.060 ** 2 * 0.020);

    it('solves DVol from Dd/Vcd/Depth/MagDepth/Magnet', () => {
      const res = solveConsistencyGroup({ ...GEOM });
      assert.ok(Math.abs(num(res.DVol_m3) - DVOL) < 1e-9, `DVol must solve to ${DVOL}, got ${res.DVol_m3}`);
    });

    it('solves Depth back from the other four when DVol is entered', () => {
      const { Depth_m: _omitted, ...rest } = GEOM;
      const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL });
      assert.ok(Math.abs(num(res.Depth_m) - 0.055) < 1e-9, `Depth must solve to 0.055, got ${res.Depth_m}`);
    });

    it('solves MagDepth back from the other four when DVol is entered', () => {
      const { MagDepth_m: _omitted, ...rest } = GEOM;
      const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL });
      assert.ok(Math.abs(num(res.MagDepth_m) - 0.020) < 1e-9, `MagDepth must solve to 0.020, got ${res.MagDepth_m}`);
    });

    it('solves Magnet back from the other four when DVol is entered', () => {
      const { Magnet_m: _omitted, ...rest } = GEOM;
      const res = solveConsistencyGroup({ ...rest, DVol_m3: DVOL });
      assert.ok(Math.abs(num(res.Magnet_m) - 0.060) < 1e-9, `Magnet must solve to 0.060, got ${res.Magnet_m}`);
    });

    it('an entered DVol is never overwritten by the derivation', () => {
      const res = solveConsistencyGroup({ ...GEOM, DVol_m3: 0.123 });
      assert.equal(res.DVol_m3, 0.123, 'entered values are pinned; the solver fills only absent members');
    });

    it('a degenerate geometry (Depth == MagDepth) yields no DVol rather than a junk value', () => {
      const res = solveConsistencyGroup({ ...GEOM, Depth_m: 0.020 });
      assert.equal(res.DVol_m3, undefined, 'a non-positive cone height must not produce a DVol');
    });

    it('solves Hc bi-directionally when Hg and Xmax are provided (underhung default)', () => {
      const res = solveConsistencyGroup({ Hg_m: 0.008, Xmax_m: 0.003 });
      assert.equal(res.Hc_m, 0.002, 'Hc must solve to Hg - 2*Xmax = 0.002 m');
    });

    it('solves Hg bi-directionally when Hc and Xmax are provided', () => {
      const res = solveConsistencyGroup({ Hc_m: 0.015, Xmax_m: 0.005 });
      assert.ok(Math.abs(num(res.Hg_m) - 0.005) < 1e-6, `Hg must solve to Hc - 2*Xmax = 0.005 m, got ${res.Hg_m}`);
    });

    it('prioritizes Row 6 (Dd -> Sd) over Row 20 (Vd/Xmax -> Sd)', () => {
      const res = solveConsistencyGroup({ Dd_m: 0.200, Vd_m3: 0.0001, Xmax_m: 0.005 });
      const expectedSd = Math.PI * 0.100 ** 2; // ~0.0314159
      assert.ok(Math.abs(num(res.Sd_m2) - expectedSd) < 1e-6, `expected Row 6 Sd ~${expectedSd}, got ${res.Sd_m2}`);
    });

    it('executes a 4-hop multi-cascade derivation from minimal 6-input set', () => {
      const res = solveConsistencyGroup({ Fs_hz: 35.0, Qes: 0.40, Qms: 4.50, Vas_m3: 0.045, Re_ohm: 6.0, Dd_m: 0.210 });

      assert.ok(num(res.Sd_m2) > 0, 'Sd must be calculated (Hop 1)');
      assert.ok(num(res.Cms_m_per_N) > 0, 'Cms must be calculated (Hop 2)');
      assert.ok(num(res.Mms_kg) > 0, 'Mms must be calculated (Hop 3)');
      assert.ok(num(res.BL_Tm) > 0, 'BL must be calculated (Hop 4)');
      assert.ok(num(res.Rms_kg_per_s) > 0, 'Rms must be calculated (Hop 4)');
      assert.ok(num(res.Qts) > 0, 'Qts must be calculated');
      assert.ok(num(res.no) > 0, 'no must be calculated');
    });
  });

  describe('Znom in the consistency solver', () => {
    it('derives Z from Re for every probe row', () => {
      for (const [label, Re, Znom] of PROBE) {
        const r = solve({ ...BASE, Re_ohm: Re });
        assert.equal(r.Znom_ohm, Znom, `${label}: solver must fill Z=${Znom} from Re=${Re}`);
      }
    });

    it('never corrects an entered Znom that contradicts Re', () => {
      // Z_entered_znom4_re6: Znom=4 typed beside Re=6 (whose rule gives 8) stays 4, marked E.
      const r = solve({ ...BASE, Re_ohm: 6, Znom_ohm: 4 });
      assert.equal(r.Znom_ohm, 4, 'an entered Z is pinned — the rule never overwrites it');
    });

    it('follows Re, not the damping factors', () => {
      // Z_incon_re8_qes27: Re=8 written beside Qes/Qts/Rms describing a driver with Re=27.
      const r = solve({ ...BASE, Re_ohm: 8, Qes: 0.3654, Qts: 0.3113, Rms_kg_per_s: 0.2332 });
      assert.equal(r.Znom_ohm, 12, '2·round(0.75·8) = 12, not the 40 that Re=27 would give');
    });

    it('accepts a CALCULATED Re as its input', () => {
      // Z_re_unset: no Re typed. WinISD back-derived Re=6 (marked C) and Znom still landed on 8.
      const r = solve({ ...BASE, Qes: 0.08161791953430539 });
      assert.equal(r.Re_ohm, 6, 'Re must be back-derived from Qes/Bl/Fs/Mms first');
      assert.equal(r.Znom_ohm, 8, 'and Znom follows the derived Re');
    });

    it('leaves Z absent when Re is unknown', () => {
      const r = solve({ Fs_hz: 40, Mms_kg: 0.00194848430081419, Cms_m_per_N: 0.008124999999999992, Sd_m2: 0.022 });
      assert.equal(r.Re_ohm, undefined, 'guard: this record cannot derive Re');
      assert.equal(r.Znom_ohm, undefined, 'no Re → no Znom (slot 0 stays N)');
    });
  });

  /**
   * The DVol/Depth/MagDepth/Magnet geometry lock (dvolRelation.ts, wired into
   * solveConsistencyGroup at solver.ts's block 9b). Each of the four directions refuses
   * (leaves its target un-derived) rather than returning a nonsensical value when the other
   * four participants describe a degenerate geometry — never reachable directly (the engine's
   * one door forbids importing dvolRelation.ts outside solver.ts), so each guard is driven
   * here through the real consistency solve.
   */
  describe('DVol geometry lock — degenerate-geometry guards refuse rather than invent a value', () => {
    const Dd_m = 0.15, Vcd_m = 0.025; // S = Dd² + Dd·Vcd + Vcd² ≈ 0.026875

    it('dvolFromDims: a non-positive participant (Magnet_m = 0) leaves DVol_m3 un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, Depth_m: 0.06, MagDepth_m: 0.02, Magnet_m: 0});
      assert.equal(out.DVol_m3, undefined);
    });

    it('depthFromDims: a non-positive DVol_m3 leaves Depth_m un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0, MagDepth_m: 0.02, Magnet_m: 0.08});
      assert.equal(out.Depth_m, undefined);
    });

    it('magDepthFromDims: a non-positive DVol_m3 leaves MagDepth_m un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0, Depth_m: 0.06, Magnet_m: 0.08});
      assert.equal(out.MagDepth_m, undefined);
    });

    it('magDepthFromDims: a Magnet_m too large for S (S − 3·Magnet² ≤ 0) leaves MagDepth_m un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.0001, Depth_m: 0.06, Magnet_m: 0.15});
      assert.equal(out.MagDepth_m, undefined);
    });

    it('magnetFromDims: a non-positive Depth_m leaves Magnet_m un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.0001, Depth_m: 0, MagDepth_m: 0.02});
      assert.equal(out.Magnet_m, undefined);
    });

    it('magnetFromDims: a radicand that goes negative (DVol far too small for the cone) leaves Magnet_m un-derived', () => {
      const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.00001, Depth_m: 0.06, MagDepth_m: 0.02});
      assert.equal(out.Magnet_m, undefined);
    });
  });

  // A calculated value's half-width is the guaranteed first-order bound its entered inputs give
  // it: Σ |∂f/∂x|·d(x) — winisd_tools' former lib/precision.py, CALCULATIONS.md §1.3.
  describe('DriverEngine.solve — a calculated value carries the precision its inputs give it', () => {
    it('Qts from Qes 0.45 (±0.005) and Qms 3.2 (±0.05)', () => {
      const p = driverParams({});
      p.Qes = fakeSolverField(0.45, 0.005);
      p.Qms = fakeSolverField(3.2, 0.05);
      engine.driver.solve(p, AIR_E);
      expect(p.Qts.calculated).toBe(true);
      expect(p.Qts.precision).toBeCloseTo(qtsHalfWidth(0.45, 0.005, 3.2, 0.05), 9);
    });

    it('Vd = Sd 0.2 × Xmax 0.030 shows 0.006', () => {
      const p = driverParams({});
      p.Sd_m2 = fakeSolverField(0.2, 0.05);
      p.Xmax_m = fakeSolverField(0.03, 0.0005);
      engine.driver.solve(p, AIR_E);
      const vd = p.Vd_m3.value!;
      expect(vd.toFixed(knownDecimals(p.Vd_m3.precision!, vd))).toBe('0.006');
    });

    it('Vd = Sd 0.20 × Xmax 0.0300 shows 0.0060', () => {
      const p = driverParams({});
      p.Sd_m2 = fakeSolverField(0.2, 0.005);
      p.Xmax_m = fakeSolverField(0.03, 0.00005);
      engine.driver.solve(p, AIR_E);
      const vd = p.Vd_m3.value!;
      expect(vd.toFixed(knownDecimals(p.Vd_m3.precision!, vd))).toBe('0.0060');
    });

    it('a value calculated from no entered input carries no precision', () => {
      const p = driverParams({});
      engine.driver.solve(p, AIR_E);
      expect(p.c_m_per_s.calculated).toBe(true);
      expect(p.c_m_per_s.precision).toBeNull();
    });
  });
});
