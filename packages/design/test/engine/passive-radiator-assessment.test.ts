import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const driver = sweepDriver(solveConsistencyGroup({Fs_hz: 37, Qes: 0.4, Qms: 7, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 5.6}));
const params = {Vb: 0.02, prMmd: 0.01, prMadd: 0.02, prSd: 0.0133, prCms: 0.0008, prNum: 1,
  prRms: 1, air: REFERENCE_AIR, Ql: 7, eg: 8, fmin: 10, fmax: 1000, N: 200};

describe('passive radiator excursion assessment', () => {
  it('finds a count that stays within the limit at the original tuning and signal', () => {
    const original = engine.simulation.sweep(driver, undefined, 'box-passive-radiator', params).values!;
    const peak = Math.max(...original.excPR);
    const limit = peak * 0.7 / 1000;
    const result = engine.simulation.passiveRadiatorAssessment(driver, undefined, params, limit)!;
    expect(result.exceededBands.length).toBeGreaterThan(0);
    expect(result.minimumCount).toBeGreaterThan(1);
    const n = result.minimumCount!;
    const target = engine.pr.tuning(params, REFERENCE_AIR);
    const mass = engine.pr.massForFp({...params, prNum: n}, target, REFERENCE_AIR) - params.prMmd;
    const proposed = engine.simulation.sweep(driver, undefined, 'box-passive-radiator', {...params, prNum: n, prMadd: mass, Fr: target}).values!;
    expect(Math.max(...proposed.excPR)).toBeLessThanOrEqual(limit * 1000);
  });

  it('returns no warning below the limit and no result without a usable Xmax', () => {
    expect(engine.simulation.passiveRadiatorAssessment(driver, undefined, params, 1)?.exceededBands).toEqual([]);
    expect(engine.simulation.passiveRadiatorAssessment(driver, undefined, params, null)).toBeNull();
  });

  it('reflects the signal level and enabled filters', () => {
    const original = engine.simulation.sweep(driver, undefined, 'box-passive-radiator', params).values!;
    const limit = Math.max(...original.excPR) * 0.8 / 1000;
    expect(engine.simulation.passiveRadiatorAssessment(driver, undefined, params, limit)!.exceededBands.length).toBeGreaterThan(0);
    expect(engine.simulation.passiveRadiatorAssessment(driver, undefined, {...params, eg: 0}, limit)!.exceededBands).toEqual([]);
    const filtered = {...params, filters: [{type: 'highpass' as const, family: 'butterworth' as const,
      order: 4, fc: 200, Q: 0.707, enabled: true}]};
    expect(engine.simulation.passiveRadiatorAssessment(driver, undefined, filtered, limit)!.exceededBands).toEqual([]);
  });
});
