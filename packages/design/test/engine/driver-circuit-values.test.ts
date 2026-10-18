/**
 * `DriverEngine.circuitValues` — the values the circuit runs on (John, 18 Oct 2026): Cas from Vas, Mas
 * from Fs and Cas, Ras from Qms, the damping BL from Qes. The stated Cms, Mms and Rms are never read.
 * A driver with only Qts gets WinISD's fallback, Qes = Qms = 2·Qts.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR, REFERENCE_AIR_VALUES} from '../fixtures/referenceAir.js';
import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver} from './testSolver.js';

const engine = createEngine();
const {c, rho} = REFERENCE_AIR_VALUES;

const STATED: TestSolverQuantities = {
  Fs_hz: 40, Vas_m3: 0.02, Sd_m2: 0.0132, Re_ohm: 6, Re_terminal_ohm: 6, Qes: 0.5, Qms: 4,
  Cms_m_per_N: 0.009, Mms_kg: 0.5, Rms_kg_per_s: 9, BL_Tm: 7.5, BL_terminal_Tm: 7.5,
};
const circuitOf = (q: TestSolverQuantities) => engine.driver.circuitValues(sweepDriver(q).values, REFERENCE_AIR);

describe('DriverEngine.circuitValues', () => {
  it('takes Cms from Vas and Sd, ignoring the stated Cms', () => {
    expect(circuitOf(STATED).Cms_m_per_N).toBeCloseTo(0.02 / (rho * c * c * 0.0132 ** 2), 12);
  });

  it('takes Mms from Fs and that Cms, and Rms from Fs, that Mms and Qms', () => {
    const v = circuitOf(STATED);
    expect(v.Mms_kg).toBeCloseTo(1 / ((2 * Math.PI * 40) ** 2 * v.Cms_m_per_N!), 12);
    expect(v.Rms_kg_per_s).toBeCloseTo(2 * Math.PI * 40 * v.Mms_kg! / 4, 12);
  });

  it('takes the damping BL from Re, Fs, Qes and that Cms, not the stated BL', () => {
    const v = circuitOf(STATED);
    expect(v.BL_terminal_Tm).toBeCloseTo(Math.sqrt(6 / (2 * Math.PI * 40 * 0.5 * v.Cms_m_per_N!)), 12);
  });

  it('keeps a stated value whose T/S inputs are missing', () => {
    const v = circuitOf({...STATED, Vas_m3: undefined});
    expect(v.Cms_m_per_N).toBe(0.009);
  });

  it('with only Qts, takes Qes = Qms = 2·Qts', () => {
    const v = circuitOf({...STATED, Qes: undefined, Qms: undefined, Qts: 0.4});
    expect(v.Qes).toBeCloseTo(0.8, 12);
    expect(v.Qms).toBeCloseTo(0.8, 12);
  });

  it('with Qts and Qes, takes no fallback: Qts feeds nothing else', () => {
    const v = circuitOf({...STATED, Qms: undefined, Qts: 0.4});
    expect(v.Qes).toBe(0.5);
    expect(v.Qms).toBeNull();
  });
});
