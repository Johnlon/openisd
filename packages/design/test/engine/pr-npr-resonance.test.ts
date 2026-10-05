/**
 * Passive-radiator box, winisd-lossy: the fixed-loss frequency ωr and the "PR Npr resonance" switch.
 *
 * WinISD takes ωr = 1/√(Npr·Map·(Cab ∥ Npr·Cap)), Npr times below the physical tuning
 * 1/√((Map/Npr)·(Cab ∥ Npr·Cap)); the two coincide at Npr = 1. `winisdPrNprResonance` off (the
 * default) uses the physical tuning; on, WinISD's. Evidence: bugs/archive/BUG_20260928_pr-added-mass-or-count-not-winisd.md
 * and the pr-w5-npr-1 capture (passive-radiator-count-winisd.test.ts, switch on).
 *
 * Exact oracle: the leak and absorption resistances are Ral = Ql·ωr·Map and Raa = ωr·Map/Qa, and
 * ωr(physical) = Npr·ωr(WinISD), so the physical-tuning sweep equals the WinISD-tuning sweep with
 * Ql·Npr and Qa/Npr.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {SweepParams, SweepResult} from '../../engine/index.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

const engine = createEngine();
const LE_H = 0.5e-3;

const BASE: SweepParams = {
  Vb: 0.01, eg: 2.83, fmin: 20, fmax: 20000, N: 200,
  Ql: 7, Qa: 30,
  prMmd: 0.0164, prMadd: 0, prSd: 0.0095, prCms: 7.9e-4, prRms: 1.13, prNum: 2,
};

function sweepWith(flag: boolean | undefined, extra: Partial<SweepParams> = {}): SweepResult {
  const d = solveConsistencyGroup({Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6});
  const P: SweepParams = {...BASE, ...extra, ...(flag === undefined ? {} : {winisdPrNprResonance: flag})};
  const r = engine.simulation.sweep(sweepDriver(d), LE_H, 'box-passive-radiator', P).values;
  if (r === null) throw new Error('sweep refused');
  return r;
}

function maxRelative(a: readonly number[], b: readonly number[]): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i]! - b[i]!) / Math.max(Math.abs(b[i]!), 1e-12));
  return worst;
}

describe('PR box ωr, winisd-lossy', () => {
  it('switch off, Npr 2: equals the WinISD-tuning sweep with Ql·Npr and Qa/Npr (ωr is the physical tuning)', () => {
    const off = sweepWith(false);
    const scaled = sweepWith(true, {Ql: BASE.Ql! * 2, Qa: BASE.Qa! / 2});
    expect(maxRelative(off.zmag, scaled.zmag)).toBeLessThan(1e-12);
    expect(maxRelative(off.spl, scaled.spl)).toBeLessThan(1e-12);
    expect(maxRelative(off.excPR, scaled.excPR)).toBeLessThan(1e-12);
  });

  it('absent flag means off', () => {
    expect(sweepWith(undefined).zmag).toEqual(sweepWith(false).zmag);
  });

  it('switch on differs from off at Npr 2', () => {
    expect(maxRelative(sweepWith(true).zmag, sweepWith(false).zmag)).toBeGreaterThan(1e-3);
  });

  it('Npr 1: on and off are identical', () => {
    expect(sweepWith(true, {prNum: 1}).zmag).toEqual(sweepWith(false, {prNum: 1}).zmag);
    expect(sweepWith(true, {prNum: 1}).spl).toEqual(sweepWith(false, {prNum: 1}).spl);
  });

  it('the lossless form never reads the switch', () => {
    expect(sweepWith(true, {Ql: 1e6, Qa: 1e6}).zmag).toEqual(sweepWith(false, {Ql: 1e6, Qa: 1e6}).zmag);
  });
});
