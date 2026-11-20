/**
 * T929: the 6th-order bandpass and ABC lossless branches (every loss Q at the lossless limit, circuit.ts `boxLoss`)
 * build each chamber with the engine's `tunedChamber` (engine/boxes/port.ts), each port with its own Qpr/Qpf, the
 * shared Qp only where the caller states none. Seen through the sweep, the engine's one door. The shared Qp is not
 * one of the losses `boxLoss` reads for these boxes, so Qp = 5 with Qpr = Qpf = 1e6 still takes the lossless branch:
 * a box that used Qp for a port would draw a lossy port (Qp 5) where the port is lossless (1e6).
 */
import {describe, expect, it} from 'vitest';
import type {SweepParams} from '../../engine/types.js';
import {createEngine} from '../../engine/Engine.js';
import {DEFAULT_NEW_PROJECT_QP} from '../../fields/defaults.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';

const engine = createEngine();
const LE_H = 0.7e-3;
const DRV = sweepDriver(solveConsistencyGroup({
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
  Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
}));
const P_BP6: SweepParams = {Vb: 0.05, Vf: 0.03, Fr: 40, Ff: 80, eg: 2.83, Ql: 1e6, Qa: 1e6, fmin: 20, fmax: 200, N: 40, air: REFERENCE_AIR};
const BOXES = [
  {box: 'bandpass6', P: P_BP6},
  {box: 'abc', P: {...P_BP6, SpIntra: Math.PI * 0.02 ** 2, LeffIntra: 0.05}},
] as const;

function spl(box: 'bandpass6' | 'abc', P: SweepParams): readonly number[] {
  const r = engine.simulation.sweep(DRV, LE_H, box, P);
  expect(r.values, `${box}: the sweep must succeed`).not.toBeNull();
  return r.values!.spl;
}

function largestGap_dB(a: readonly number[], b: readonly number[]): number {
  return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
}

describe('6th-order bandpass and ABC at the lossless limit: each port its own loss Q (T929)', () => {
  for (const {box, P} of BOXES) {
    it(`${box}: each port uses its own Qpr/Qpf, never the shared Qp`, () => {
      const ownPorts = spl(box, {...P, Qp: 5, Qpr: 1e6, Qpf: 1e6});
      const allLossless = spl(box, {...P, Qp: 1e6, Qpr: 1e6, Qpf: 1e6});
      expect(ownPorts).toEqual(allLossless);
      // The shared Qp = 5 is not a no-op: read by both ports it changes the chart.
      expect(largestGap_dB(spl(box, {...P, Qp: 5}), allLossless)).toBeGreaterThan(0.5);
      // Each port on its own: with one port's own Q stated lossless, the other port (none stated) still reads the
      // shared Qp = 5 and shows, so neither port reads the other's Q. (A stated Qpr or Qpf below the limit would
      // leave the lossless branch.)
      expect(largestGap_dB(spl(box, {...P, Qp: 5, Qpr: 1e6}), allLossless)).toBeGreaterThan(0.1);
      expect(largestGap_dB(spl(box, {...P, Qp: 5, Qpf: 1e6}), allLossless)).toBeGreaterThan(0.1);
    });

    it(`${box}: takes the shared Qp where a port states none, and the new-project Qp where neither is stated`, () => {
      expect(spl(box, {...P, Qp: 2e6})).toEqual(spl(box, {...P, Qp: 7, Qpr: 2e6, Qpf: 2e6}));
      expect(spl(box, P)).toEqual(spl(box, {...P, Qp: DEFAULT_NEW_PROJECT_QP}));
      // Not vacuous: the new-project Qp is a real loss here, unlike the stated lossless ports.
      expect(largestGap_dB(spl(box, P), spl(box, {...P, Qpr: 1e6, Qpf: 1e6}))).toBeGreaterThan(0.1);
    });

    it(`${box}: an absent chamber tuning gives no finite chart, never a throw`, () => {
      for (const missing of [{...P, Fr: undefined}, {...P, Ff: undefined}]) {
        const r = engine.simulation.sweep(DRV, LE_H, box, missing);
        expect(r.values === null || engine.simulation.classifyFinite(r.values) !== null).toBe(true);
      }
    });
  }
});
