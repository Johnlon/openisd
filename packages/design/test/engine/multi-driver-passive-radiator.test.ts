/**
 * Several drivers in a passive-radiator box: WinISD's model is one driver in Vb/N with its share of
 * the radiators. A sweep that states no radiator count has one radiator (the box reads an absent
 * count as 1), so its N drivers share that one radiator, exactly as a stated count of 1. Before
 * T928 (ultra review 1 finding 5) an absent count was not divided, so each of the N sub-boxes got
 * a whole radiator: N radiators in all.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/types.js';
import {createEngine} from '../../engine/Engine.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const LE_H = 0.7e-3;
const DRV = sweepDriver(solveConsistencyGroup({Fs_hz: 37, Qes: 0.40, Qms: 7.0, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 5.6}));
const PR_BOX = {Vb: 0.02, prMmd: 0.010, prMadd: 0.020, prSd: 0.0133, prCms: 0.0008};

function params(prNum: number | undefined): SweepParams {
  return {
    ...PR_BOX, ...(prNum === undefined ? {} : {prNum}), nDrivers: 2, air: REFERENCE_AIR, Ql: 7, eg: 2.83,
    prRms: 1.0, prXmax: 0.012, fmin: 10, fmax: 1000, N: 200,
    Fr: engine.pr.tuning({...PR_BOX, prNum: 1}, REFERENCE_AIR),
  };
}

describe('two drivers in a passive-radiator box with no radiator count stated (T928)', () => {
  it('sweep the same as with one radiator stated', () => {
    const stated = engine.simulation.sweep(DRV, LE_H, 'box-passive-radiator', params(1)).values!;
    const absent = engine.simulation.sweep(DRV, LE_H, 'box-passive-radiator', params(undefined)).values!;
    for (let i = 0; i < stated.fs.length; i++) {
      assert.ok(Math.abs(absent.spl[i] - stated.spl[i]) < 1e-9,
        `SPL at ${stated.fs[i].toFixed(1)} Hz: no count ${absent.spl[i]}, one radiator ${stated.spl[i]}`);
      assert.ok(Math.abs(absent.excPR[i] - stated.excPR[i]) < 1e-9 * Math.max(1, stated.excPR[i]),
        `PR excursion at ${stated.fs[i].toFixed(1)} Hz: no count ${absent.excPR[i]}, one radiator ${stated.excPR[i]}`);
    }
  });
});
