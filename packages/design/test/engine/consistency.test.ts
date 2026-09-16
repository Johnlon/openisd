import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { DriverSolverQuantities, DriverSolverParams, SolverField } from '../../engine/index.js';
import { fakeSolverField } from './testSolver.js';

const engine = new Engine();

function fakeWiringField(value: 'series' | 'parallel' | null): SolverField<'series' | 'parallel'> {
  let current = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get notAvailable() { return state === 'not-available'; },
    get dq() { return [] as string[]; },
    setCalculated(v: 'series' | 'parallel') { current = v; state = 'calculated'; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

const NUMERIC_DRIVER_FIELDS = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
  'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
  'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
  'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
  'Re_terminal_ohm', 'BL_terminal_Tm', 'numVC',
] as const satisfies readonly (keyof Omit<DriverSolverParams, 'wiring'>)[];

/** A full `DriverSolverParams` of `not-available` fakes, with `entered` overriding a subset. */
function driverParams(entered: Partial<Record<typeof NUMERIC_DRIVER_FIELDS[number], number>>): DriverSolverParams {
  const e = (key: typeof NUMERIC_DRIVER_FIELDS[number]): SolverField => fakeSolverField(entered[key] ?? null);
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
    DVol_m3: e('DVol_m3'), c_m_per_s: e('c_m_per_s'), roo_kg_per_m3: e('roo_kg_per_m3'),
    Re_terminal_ohm: e('Re_terminal_ohm'), BL_terminal_Tm: e('BL_terminal_Tm'), numVC: e('numVC'),
    wiring: fakeWiringField(null),
  };
}

describe('Engine.checkConsistency', () => {
  it('returns no issues for a self-consistent driver', () => {
    const Qes = 0.4, Qms = 3.0;
    const Qts = (Qes * Qms) / (Qes + Qms);
    const issues = engine.checkConsistency({ Qts, Qes, Qms });
    expect(issues).toEqual([]);
  });

  it('reports an inconsistent-inputs issue when Qts contradicts Qes/Qms', () => {
    const Qes = 0.4, Qms = 3.0;
    const issues = engine.checkConsistency({ Qts: 7.5, Qes, Qms });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: 'inconsistent-inputs',
      target: 'Qts',
      fields: ['Qts', 'Qes', 'Qms'],
      actual: 7.5,
    });
  });

  it('reports a missing-dependencies issue for Qts when fewer than two of Qts/Qes/Qms are stated', () => {
    const issues = engine.checkConsistency({ Qes: 0.4 });
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
});

describe('Engine.solveDriver — handle solve, values written onto the params (T10/T11)', () => {
  it('writes the derived Qts onto its handle when Qes and Qms are entered', () => {
    const Qes = 0.4, Qms = 3.0;
    const p = driverParams({ Qes, Qms });
    const issues = engine.solveDriver(p);
    expect(p.Qts.value).toBeCloseTo((Qes * Qms) / (Qes + Qms), 12);
    expect(p.Qts.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites an entered value even when it disagrees with the derived value', () => {
    const Qes = 0.4, Qms = 3.0;
    const p = driverParams({ Qes, Qms, Qts: 7.5 });
    const issues = engine.solveDriver(p);
    expect(p.Qts.value).toBe(7.5);
    expect(p.Qts.entered).toBe(true);
    expect(issues).toEqual(engine.checkConsistency({ Qts: 7.5, Qes, Qms }));
  });

  it('leaves an underivable non-entered field not-available', () => {
    const p = driverParams({ Qes: 0.4 });
    engine.solveDriver(p);
    expect(p.Qts.value).toBeNull();
    expect(p.Qts.notAvailable).toBe(true);
  });

  it('returns the same issues checkConsistency would for the same entered numbers', () => {
    const input: DriverSolverQuantities = { Qes: 0.4 };
    const p = driverParams({ Qes: 0.4 });
    const issues = engine.solveDriver(p);
    expect(issues).toEqual(engine.checkConsistency(input));
  });
});
