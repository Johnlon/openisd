import {describe, expect, it} from 'vitest';
import {availableAir} from '../../engine/index.js';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {fakeSolverField} from './testSolver.js';

const engine = createEngine();

function prParams(prNum: number | null) {
  return {
    addedMass_kg: fakeSolverField(0.01),
    tuning_goal_hz: fakeSolverField<number>(null),
    Vb_m3: fakeSolverField(0.03),
    prMmd_kg: fakeSolverField(0.02),
    prSd_m2: fakeSolverField(0.02),
    prCms_m_per_N: fakeSolverField(0.0008),
    prNum: fakeSolverField(prNum),
    resonanceWithAddedMass_hz: fakeSolverField<number>(null),
    systemTuning_hz: fakeSolverField<number>(null),
  };
}

describe('PrEngine.solve radiator count', () => {
  it('counts one radiator when the count is blank', () => {
    const blank = prParams(null);
    const one = prParams(1);
    engine.pr.solve(blank, availableAir(REFERENCE_AIR));
    engine.pr.solve(one, availableAir(REFERENCE_AIR));
    expect(blank.tuning_goal_hz.value).toBe(one.tuning_goal_hz.value);
    expect(blank.systemTuning_hz.value).toBe(one.systemTuning_hz.value);
    expect(blank.tuning_goal_hz.value).toBeGreaterThan(0);
  });
});

describe('PrEngine.checkSpec', () => {
  const none = {Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: null, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};
  const exact = {Fs_hz: 0, Qms: 0, Vas_m3: 0, Sd_m2: 0, Mms_kg: 0, Cms_m_per_N: 0, Rms_kg_per_s: 0};

  it('names Mms as the missing figure when Cms is known from Vas and Sd but Fs is not stated', () => {
    const issues = engine.pr.checkSpec({...none, Vas_m3: 0.0048, Sd_m2: 0.0095, Qms: 3.3}, exact, availableAir(REFERENCE_AIR));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({kind: 'missing-dependencies', target: 'Mms_kg'});
  });
});
