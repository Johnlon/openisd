/**
 * T929: a lossless shortcut must give the same answer as the lossy model in the limit.
 *
 * WinISD has no lossless form: it always computes the losses (winisd_research/spec/S04_sealed_box.md
 * section 6; fields/losslessQ.ts). OpenISD reaches its lossless shortcuts only through loaded files
 * (an old project's retired 'lossless' loss mode, domain/project/retiredLossMode.ts, or a .wpr with
 * Q >= 1e6). So a box whose every loss Q is at the limit (1e6) and the same box with every Q just
 * under it (999999) must chart the same, for every box type: no jump at the limit.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {BoxType, SweepParams, SweepResult} from '../../engine/types.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const D = solveConsistencyGroup({Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6});

function run(box: BoxType, P: SweepParams): SweepResult {
  const r = engine.simulation.sweep(sweepDriver(D), 0.5e-3, box, P);
  if (r.values === null) throw new Error(JSON.stringify(r.issues));
  return r.values;
}

function maxAbsDiff(a: readonly number[], b: readonly number[]): number {
  return a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);
}

function maxRelDiff(a: readonly number[], b: readonly number[]): number {
  return a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i]) / Math.abs(b[i])), 0);
}

/** The two sweeps chart the same: SPL within 0.001 dB, impedance within 1e-4 of itself. The lossy form
 *  itself moves its impedance peaks by up to 4e-5 between Q = 999999 and Q = 1e9, so this is as tight as the
 *  limit is. */
function expectSameChart(a: SweepResult, b: SweepResult): void {
  expect(maxAbsDiff(a.spl, b.spl)).toBeLessThan(1e-3);
  expect(maxRelDiff(a.zmag, b.zmag)).toBeLessThan(1e-4);
}

/** A port length that tunes `Vb_m3` to `f_hz` (Map = ρ·Leff/Sp = 1/(ω²·Cab)), so the geometry the
 *  lossless vented and bandpass4 branches read and the tuning the lossy ones read agree. */
function leffFor(Sp_m2: number, Vb_m3: number, f_hz: number): number {
  const k = 2 * Math.PI * f_hz / REFERENCE_AIR.c();
  return Sp_m2 / (Vb_m3 * k * k);
}

/** Every loss Q a box can read, set to `q`. */
function everyQ(q: number): Partial<SweepParams> {
  return {Ql: q, Qa: q, Qp: q, Qlr: q, Qar: q, Qpr: q, Qlf: q, Qaf: q, Qpf: q, Qiclfr: q};
}

const BASE: SweepParams = {Vb: 0.02, eg: 2.83, fmin: 10, fmax: 1000, N: 200, air: REFERENCE_AIR};
const BOXES: readonly (readonly [BoxType, SweepParams])[] = [
  ['sealed', BASE],
  ['vented', {...BASE, Fb: 40, Sp: 0.004, Leff: leffFor(0.004, 0.02, 40)}],
  ['box-passive-radiator', {...BASE, prSd: 0.0133, prNum: 1, prMmd: 0.06, prMadd: 0, prCms: 0.0007, prRms: 1}],
  ['bandpass4', {...BASE, Vf: 0.015, Ff: 60, Sp: 0.004, Leff: leffFor(0.004, 0.015, 60)}],
  ['bandpass6', {...BASE, Vf: 0.015, Fr: 42, Ff: 60, Sp: 0.004, Spr: 0.004}],
  ['abc', {...BASE, Vf: 0.015, Fr: 42, Ff: 60, Sp: 0.004, Spr: 0.004, SpIntra: 0.002, LeffIntra: 0.12}],
];

describe('the lossless shortcut agrees with the lossy model in the limit', () => {
  for (const [box, P] of BOXES) {
    it(`${box}: every loss Q at 1e6 charts as every loss Q at 999999`, () => {
      const atLimit = run(box, {...P, ...everyQ(1e6)});
      const underLimit = run(box, {...P, ...everyQ(999999)});
      expectSameChart(atLimit, underLimit);
    });
  }
});

/** Real losses besides the shared Ql/Qa: the vented port, and every chamber Q (WinISD's own defaults for
 *  the ports and the inter-chamber leak, a leaky front chamber). */
const OTHER_LOSSES: Partial<SweepParams> = {Qp: 10, Qlr: 1e6, Qar: 1e6, Qpr: 100, Qlf: 5, Qaf: 10, Qpf: 100, Qiclfr: 20};

describe('Ql and Qa at the limit do not drop the box\'s other losses', () => {
  for (const [box, P] of BOXES.filter(([box]) => box !== 'sealed' && box !== 'box-passive-radiator')) {
    it(`${box}: Ql = Qa = 1e6 charts as Ql = Qa = 999999, the other losses kept`, () => {
      const atLimit = run(box, {...P, ...OTHER_LOSSES, Ql: 1e6, Qa: 1e6});
      const underLimit = run(box, {...P, ...OTHER_LOSSES, Ql: 999999, Qa: 999999});
      expectSameChart(atLimit, underLimit);
    });
  }
});
