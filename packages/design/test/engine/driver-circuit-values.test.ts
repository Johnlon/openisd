/**
 * `DriverEngine.circuitValues` — the values the circuit runs on are the boxes as they show (QO534, John 11 Nov 2026:
 * "the editor and pr settings will use the [on-screen] values not hidden recalcs always"): a stated Cms, Mms, Rms and BL
 * are used as stated, never worked out again from Vas, Fs and the Q's. A driver with only Qts gets WinISD's fallback,
 * Qes = Qms = 2·Qts, and an Rms or BL the boxes leave empty is worked out from those.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR, REFERENCE_AIR_VALUES} from '../fixtures/referenceAir.js';
import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver} from './testSolver.js';

const engine = createEngine();

const STATED: TestSolverQuantities = {
  Fs_hz: 40, Vas_m3: 0.02, Sd_m2: 0.0132, Re_ohm: 6, Re_terminal_ohm: 6, Qes: 0.5, Qms: 4,
  Cms_m_per_N: 0.009, Mms_kg: 0.5, Rms_kg_per_s: 9, BL_Tm: 7.5, BL_terminal_Tm: 7.5,
};
const circuitOf = (q: TestSolverQuantities) => engine.driver.circuitValues(sweepDriver(q).values);

describe('DriverEngine.circuitValues', () => {
  it('uses the stated Cms, Mms, Rms and BL as the boxes show them, though Vas, Fs and the Qs disagree', () => {
    const v = circuitOf(STATED);
    expect(v.Cms_m_per_N).toBe(0.009);
    expect(v.Mms_kg).toBe(0.5);
    expect(v.Rms_kg_per_s).toBe(9);
    expect(v.BL_terminal_Tm).toBe(7.5);
  });

  it('keeps the stated Cms when Vas is absent', () => {
    const v = circuitOf({...STATED, Vas_m3: undefined});
    expect(v.Cms_m_per_N).toBe(0.009);
  });

  it('with only Qts, takes Qes = Qms = 2·Qts', () => {
    const v = circuitOf({...STATED, Qes: undefined, Qms: undefined, Qts: 0.4});
    expect(v.Qes).toBeCloseTo(0.8, 12);
    expect(v.Qms).toBeCloseTo(0.8, 12);
  });

  it('with only Qts and no Rms or BL in the boxes, works them out from the fallback Qs', () => {
    const v = circuitOf({...STATED, Qes: undefined, Qms: undefined, Qts: 0.4, Rms_kg_per_s: undefined, BL_terminal_Tm: undefined});
    expect(v.Rms_kg_per_s).toBeCloseTo(2 * Math.PI * 40 * 0.5 / 0.8, 12);
    expect(v.BL_terminal_Tm).toBeCloseTo(Math.sqrt(6 / (2 * Math.PI * 40 * 0.8 * 0.009)), 12);
  });

  it('with Qts and Qes, takes no fallback: Qts feeds nothing else', () => {
    const v = circuitOf({...STATED, Qms: undefined, Qts: 0.4});
    expect(v.Qes).toBe(0.5);
    expect(v.Qms).toBeNull();
  });
});

/** `DriverEngine.winisdCircuitValues`: "Chart from Fs, Vas, Qms (WinISD's way)" ticked (John, 11 Nov 2026, QO539: picked B). */
describe('DriverEngine.winisdCircuitValues', () => {
  const {c, rho} = REFERENCE_AIR_VALUES;
  const winisdOf = (q: TestSolverQuantities) => engine.driver.winisdCircuitValues(sweepDriver(q).values, REFERENCE_AIR);

  it('works Cms out from Vas and Sd, Mms from Fs and that Cms, Rms from Fs, that Mms and Qms, and BL from Re, Fs, Qes and that Cms; the stated ones are not read', () => {
    const v = winisdOf(STATED);
    const cms = 0.02 / (rho * c * c * 0.0132 ** 2);
    const mms = 1 / ((2 * Math.PI * 40) ** 2 * cms);
    expect(v.Cms_m_per_N).toBeCloseTo(cms, 12);
    expect(v.Mms_kg).toBeCloseTo(mms, 12);
    expect(v.Rms_kg_per_s).toBeCloseTo(2 * Math.PI * 40 * mms / 4, 12);
    expect(v.BL_terminal_Tm).toBeCloseTo(Math.sqrt(6 / (2 * Math.PI * 40 * 0.5 * cms)), 12);
  });

  it('keeps a stated value whose T/S inputs are missing: no Vas, so the stated Cms stands, and Mms and Rms follow from it', () => {
    const v = winisdOf({...STATED, Vas_m3: undefined});
    expect(v.Cms_m_per_N).toBe(0.009);
    expect(v.Mms_kg).toBeCloseTo(1 / ((2 * Math.PI * 40) ** 2 * 0.009), 12);
  });

  it('keeps the stated Mms and Rms when there is no Fs to work them out from', () => {
    const v = winisdOf({...STATED, Fs_hz: undefined});
    expect(v.Mms_kg).toBe(0.5);
    expect(v.Rms_kg_per_s).toBe(9);
  });

  it('with only Qts, takes Qes = Qms = 2·Qts there too', () => {
    const v = winisdOf({...STATED, Qes: undefined, Qms: undefined, Qts: 0.4});
    expect(v.Qes).toBeCloseTo(0.8, 12);
    expect(v.Qms).toBeCloseTo(0.8, 12);
  });
});
