import {describe, expect, it, vi} from 'vitest';
import type {CalculationIssue, DqIssue, DriverIssue, DriverSolverParams, SolverField} from '../../engine/index.js';
import {DEFAULT_P_REF_PA, Engine} from '../../engine/index.js';
import type {TestSolverQuantities} from './testSolver.js';
import {checkConsistency, fakeSolverField} from './testSolver.js';

const engine = new Engine();
// Deliberately NOT the reference condition (`engine.solveEnvironment({}).values`): `solveConsistencyGroup`'s own
// internal driverC/driverRho fallback already defaults to reference air on its own, so a test
// using reference air here would pass even if `solveDriver` never threaded `air` through at all.
const AIR = engine.solveEnvironment({ tempK: 350 }).values;

function fakeWiringField(value: 'series' | 'parallel' | null): SolverField<'series' | 'parallel'> {
  let current = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get precision() { return null; },
    get dq() { return [] as DqIssue[]; },
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
    return engine.solveDriver(p, AIR).filter((i): i is DriverIssue => i.kind === 'inconsistent-inputs');
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

describe('Engine.solveDriver — handle solve, values written onto the params (T10/T11)', () => {
  it('writes the derived Qts onto its handle when Qes and Qms are entered', () => {
    const Qes = 0.4, Qms = 3.0;
    const p = driverParams({ Qes, Qms });
    const issues = engine.solveDriver(p, AIR);
    expect(p.Qts.value).toBeCloseTo((Qes * Qms) / (Qes + Qms), 12);
    expect(p.Qts.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites an entered value even when it disagrees with the derived value', () => {
    const Qes = 0.4, Qms = 3.0;
    const p = driverParams({ Qes, Qms, Qts: 7.5 });
    const issues = engine.solveDriver(p, AIR);
    expect(p.Qts.value).toBe(7.5);
    expect(p.Qts.entered).toBe(true);
    expect(issues).toEqual(checkConsistency({ Qts: 7.5, Qes, Qms }));
  });

  it('leaves an underivable non-entered field not-available', () => {
    const p = driverParams({ Qes: 0.4 });
    engine.solveDriver(p, AIR);
    expect(p.Qts.value).toBeNull();
  });

  it('returns the same issues checkConsistency would for the same entered numbers', () => {
    const input: TestSolverQuantities = { Qes: 0.4 };
    const p = driverParams({ Qes: 0.4 });
    const issues = engine.solveDriver(p, AIR);
    expect(issues).toEqual(checkConsistency(input));
  });

  it('a not-entered c_m_per_s defaults to the given air and is written back as calculated', () => {
    const p = driverParams({});
    const write = vi.spyOn(p.c_m_per_s, 'setCalculated');
    engine.solveDriver(p, AIR);
    expect(write).toHaveBeenCalledWith(AIR.c);
    expect(p.c_m_per_s.value).toBe(AIR.c);
  });

  it('a not-entered roo_kg_per_m3 defaults to the given air and is written back as calculated', () => {
    const p = driverParams({});
    const write = vi.spyOn(p.roo_kg_per_m3, 'setCalculated');
    engine.solveDriver(p, AIR);
    expect(write).toHaveBeenCalledWith(AIR.rho);
    expect(p.roo_kg_per_m3.value).toBe(AIR.rho);
  });

  it('an entered c_m_per_s is never overwritten by the given air', () => {
    const p = driverParams({ c_m_per_s: 111111 });
    engine.solveDriver(p, AIR);
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
    engine.solveDriver(p, AIR);
    // roo·c² collapses to γ·Pref regardless of roo once c = √(γ·Pref/roo), so Sd is predictable
    // without importing the private GAMMA/efficiency formulas.
    expect(p.Sd_m2.value).toBeCloseTo(Math.sqrt(Vas_m3 / (GAMMA * DEFAULT_P_REF_PA * Cms_m_per_N)), 9);
  });

  it('falls back to the reference environment when both c_m_per_s and roo_kg_per_m3 are entered non-positive', () => {
    const ref = engine.solveEnvironment({}).values;
    const Vas_m3 = 0.05, Cms_m_per_N = 0.0009;
    const p = driverParams({ c_m_per_s: 0, roo_kg_per_m3: 0, Vas_m3, Cms_m_per_N });
    engine.solveDriver(p, AIR);
    expect(p.Sd_m2.value).toBeCloseTo(Math.sqrt(Vas_m3 / (ref.rho * ref.c * ref.c * Cms_m_per_N)), 9);
  });
});

describe('Engine.solveDriver — Thiele/Small routes not otherwise exercised', () => {
  it('derives Mms from Fs/Qms/Rms', () => {
    const Fs_hz = 40, Qms = 3.0, Rms_kg_per_s = 0.5;
    const p = driverParams({ Fs_hz, Qms, Rms_kg_per_s });
    engine.solveDriver(p, AIR);
    expect(p.Mms_kg.value).toBeCloseTo((Rms_kg_per_s * Qms) / (2 * Math.PI * Fs_hz), 12);
  });

  it('derives Mms from Qes/Bl/Fs/Re', () => {
    const Qes = 0.4, BL_Tm = 6, Fs_hz = 40, Re_ohm = 6;
    const p = driverParams({ Qes, BL_Tm, Fs_hz, Re_ohm });
    engine.solveDriver(p, AIR);
    expect(p.Mms_kg.value).toBeCloseTo((Qes * BL_Tm * BL_Tm) / (2 * Math.PI * Fs_hz * Re_ohm), 12);
  });

  it('derives Hg from Hc/Xmax on the equal-or-under overhang arm (Hc <= 2·Xmax)', () => {
    const Xmax_m = 0.005, Hc_m = 0.005;
    const p = driverParams({ Xmax_m, Hc_m });
    engine.solveDriver(p, AIR);
    expect(p.Hg_m.value).toBeCloseTo(Hc_m + 2 * Xmax_m, 12);
  });

  it('falls back to deriving Sd from Vd/Xmax when Sd is not otherwise derivable', () => {
    const Vd_m3 = 0.0002, Xmax_m = 0.005;
    const p = driverParams({ Vd_m3, Xmax_m });
    engine.solveDriver(p, AIR);
    expect(p.Sd_m2.value).toBeCloseTo(Vd_m3 / Xmax_m, 12);
  });

  it('recovers Qes from η₀/Fs/Vas — round trip through the same relation the forward η₀ route uses', () => {
    const Fs_hz = 40, Vas_m3 = 0.05, Qes0 = 0.4;
    const p1 = driverParams({ Fs_hz, Vas_m3, Qes: Qes0 });
    engine.solveDriver(p1, AIR);
    const no0 = p1.no.value!;
    expect(no0).not.toBeNull();

    const p2 = driverParams({ Fs_hz, Vas_m3, no: no0 });
    engine.solveDriver(p2, AIR);
    expect(p2.Qes.value).toBeCloseTo(Qes0, 9);
  });
});

describe('Engine.solveDriver — USPL/SPLref/Re routes', () => {
  const V283_SQ = 2.83 * 2.83;

  it('derives Re from a stated USPL and SPL', () => {
    const Re_ohm = 6.4, SPL_dB = 90;
    const USPL_dB = SPL_dB + 10 * Math.log10(V283_SQ / Re_ohm);
    const p = driverParams({ SPL_dB, USPL_dB });
    engine.solveDriver(p, AIR);
    expect(p.Re_ohm.value).toBeCloseTo(Re_ohm, 9);
  });

  it('derives SPLref from a stated USPL and Re', () => {
    const Re_ohm = 6.4, SPLref_dB = 90;
    const USPL_dB = SPLref_dB + 10 * Math.log10(V283_SQ / Re_ohm);
    const p = driverParams({ Re_ohm, USPL_dB });
    engine.solveDriver(p, AIR);
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
      get dq() { return [] as DqIssue[]; },
      setCalculated(v: number) { observedValue = v; },
      setDq() {},
      setNotAvailable() {},
    };
    const Qes = 0.4, Qms = 3.0;
    const p = driverParams({ Qes, Qms });
    p.Qts = enteredButNull;
    const issues = engine.solveDriver(p, AIR);
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
    engine.solveDriver(p, AIR);
    // The Znom-from-Re block guards only `Re_ohm > 0` (true for Infinity) and assigns
    // `nominalImpedance(Re_ohm)` directly, bypassing `setVal`'s own isFinite check — so
    // `nominalImpedance`'s own `!isFinite(Re)` guard is what actually stops this at NaN.
    expect(p.Znom_ohm.value).toBeNaN();
    expect(p.Znom_ohm.calculated).toBe(true);
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

describe('issueToText', () => {
  it('renders a missing-dependencies issue as "<target> cannot be calculated yet - state <routes>."', () => {
    const issue: CalculationIssue<string> = {
      kind: 'missing-dependencies',
      target: 'Qts',
      routes: [{formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms']}],
    };
    expect(engine.issueToText(issue)).toBe(
      'Qts cannot be calculated yet - state Qts = Qes·Qms/(Qes+Qms) (needs Qms).',
    );
  });

  it('renders an inconsistent-inputs issue as "<fields> disagree by <pct>: <formula>. Every field..."', () => {
    const issue: CalculationIssue<string> = {
      kind: 'inconsistent-inputs',
      target: 'Qts',
      fields: ['Qts', 'Qes', 'Qms'],
      formula: 'Qts = Qes·Qms/(Qes+Qms)',
      expected: 1,
      actual: 1.953,
      relative: 0.953,
    };
    expect(engine.issueToText(issue)).toBe(
      'Qts, Qes, Qms disagree by 95.3%: Qts = Qes·Qms/(Qes+Qms). Every field in the group is marked '
      + '- correct one of them, or clear one to let it be calculated.',
    );
  });
});

describe('plausibilityToText', () => {
  it('states the value, its unit and that WinISD agrees, for a non-physical answer', () => {
    const text = engine.plausibilityToText({kind: 'non-physical', quantity: 'Vb', value: -0.02});
    expect(text).toMatch(/-20 L/);
    expect(text).toMatch(/not a physical/i);
    expect(text).toMatch(/WinISD/);
  });

  it('states the band a value fell outside', () => {
    const text = engine.plausibilityToText(
      {kind: 'out-of-range', quantity: 'Vb', value: 1.684, min: 0.001, max: 1.0});
    expect(text).toMatch(/1684 L/);
    expect(text).toMatch(/1 L/);
    expect(text).toMatch(/1000 L/);
    expect(text).toMatch(/Settings/);
  });

  it('prints tuning in Hz', () => {
    const text = engine.plausibilityToText(
      {kind: 'out-of-range', quantity: 'Fb', value: 5.4, min: 10, max: 150});
    expect(text).toMatch(/5\.4 Hz/);
    expect(text).toMatch(/10 Hz/);
    expect(text).toMatch(/150 Hz/);
  });

  it('renders a sub-0.1 value to two significant figures instead of rounding it to zero', () => {
    const text = engine.plausibilityToText({kind: 'non-physical', quantity: 'Vb', value: 0.00005});
    expect(text).toMatch(/0\.050 L/);
  });

  it('renders exactly zero as 0, not -0 or a precision string', () => {
    const text = engine.plausibilityToText({kind: 'non-physical', quantity: 'Vb', value: 0});
    expect(text).toMatch(/\bis 0 L\b/);
  });
});

describe('targetUnreachableToText', () => {
  it('names the target and the geometry\'s reachable ceiling', () => {
    const text = engine.targetUnreachableToText({kind: 'target-unreachable', target: 'length_m', maxReachable_hz: 42});
    expect(text).toMatch(/length_m/);
    expect(text).toMatch(/42 Hz/);
  });

  it('prints a non-finite ceiling as the literal string, not a formatted number', () => {
    const text = engine.targetUnreachableToText({kind: 'target-unreachable', target: 'length_m', maxReachable_hz: Infinity});
    expect(text).toMatch(/Infinity Hz/);
  });
});

describe('dqIssueText', () => {
  it('dispatches every DqIssue kind to its own renderer', () => {
    expect(engine.dqIssueText({kind: 'missing-dependencies', target: 'Qts', routes: []})).toMatch(/Qts/);
    expect(engine.dqIssueText({
      kind: 'inconsistent-inputs', target: 'Qts', fields: ['Qts'], formula: 'f', expected: 1, actual: 2, relative: 1,
    })).toMatch(/disagree/);
    expect(engine.dqIssueText({kind: 'non-physical', quantity: 'Vb', value: -1})).toMatch(/not a physical/i);
    expect(engine.dqIssueText({kind: 'out-of-range', quantity: 'Fb', value: 1, min: 10, max: 20})).toMatch(/plausible/);
    expect(engine.dqIssueText({kind: 'target-unreachable', target: 'length_m', maxReachable_hz: 42})).toMatch(/length_m/);
  });
});
