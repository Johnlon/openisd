import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {AirState} from '../../engine/index.js';
import {availableAir} from '../../engine/index.js';
import {missingDependencies} from '../../engine/consistency.js';
import type {PrSolverParams, VentSolverParams} from '../../engine/solverTypes.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {driverParams, fakeSolverField} from './testSolver.js';

const engine = createEngine();

const AVAILABLE: AirState = availableAir(REFERENCE_AIR);
const NOT_AVAILABLE: AirState = {
  kind: 'notAvailable',
  issues: [missingDependencies('c', [{formula: 'c from tempK', required: ['tempK'], missing: ['tempK']}])],
};

/** The fields a missing-dependencies issue names. */
function namedFields(issues: readonly {readonly kind: string; readonly fields?: readonly string[]}[], target: string): readonly string[] {
  return issues.flatMap(i => ('target' in i && i.target === target && i.fields ? i.fields : []));
}

function ventParams(p: {tuning_goal_hz?: number; length_m?: number}): VentSolverParams {
  const input = (v: number): {value: number; entered: boolean} => ({value: v, entered: true});
  return {
    tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null), length_m: fakeSolverField(p.length_m ?? null),
    Vb_m3: input(0.03), area_m2: input(0.002), count: input(1), endCorrection_m: input(0.732),
  };
}

function prParams(p: {tuning_goal_hz?: number; addedMass_kg?: number}): PrSolverParams {
  const input = (v: number): {value: number; entered: boolean} => ({value: v, entered: true});
  return {
    addedMass_kg: fakeSolverField(p.addedMass_kg ?? null), tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null),
    Vb_m3: input(0.03), prMmd_kg: input(0.02), prSd_m2: input(0.02), prCms_m_per_N: input(0.0008), prNum: input(1),
    resonanceWithAddedMass_hz: fakeSolverField<number>(null), systemTuning_hz: fakeSolverField<number>(null),
  };
}

describe('AirState — driver solve', () => {
  it('solves Qts from Qes and Qms with no air', () => {
    const p = driverParams({Qes: 0.4, Qms: 3});
    engine.driver.solve(p, NOT_AVAILABLE);
    expect(p.Qts.value).toBeCloseTo(0.4 * 3 / 3.4, 12);
    expect(p.Qts.calculated).toBe(true);
  });

  it('leaves Vas from Cms and Sd not available and names c and rho', () => {
    const p = driverParams({Cms_m_per_N: 0.0008, Sd_m2: 0.02});
    const issues = engine.driver.solve(p, NOT_AVAILABLE);
    expect(p.Vas_m3.value).toBeNull();
    expect(p.Vas_m3.calculated).toBe(false);
    expect(issues).toContainEqual(expect.objectContaining({kind: 'missing-dependencies', target: 'Vas_m3'}));
    expect(namedFields(issues, 'Vas_m3')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });

  it('keeps an entered Vas', () => {
    const p = driverParams({Cms_m_per_N: 0.0008, Sd_m2: 0.02, Vas_m3: 0.05});
    const issues = engine.driver.solve(p, NOT_AVAILABLE);
    expect(p.Vas_m3.value).toBe(0.05);
    expect(p.Vas_m3.entered).toBe(true);
    expect(namedFields(issues, 'Vas_m3')).toEqual([]);
  });

  it('writes c and rho as not available', () => {
    const p = driverParams({Qes: 0.4, Qms: 3});
    engine.driver.solve(p, NOT_AVAILABLE);
    expect(p.c_m_per_s.value).toBeNull();
    expect(p.roo_kg_per_m3.value).toBeNull();
  });

  it('available air gives the same Vas as the air itself', () => {
    const p = driverParams({Cms_m_per_N: 0.0008, Sd_m2: 0.02});
    engine.driver.solve(p, AVAILABLE);
    expect(p.Vas_m3.value).toBe(REFERENCE_AIR.rho() * REFERENCE_AIR.c() * REFERENCE_AIR.c() * 0.02 * 0.02 * 0.0008);
  });
});

describe('AirState — vent solve', () => {
  it('leaves length not available and names c and rho', () => {
    const p = ventParams({tuning_goal_hz: 35});
    const issues = engine.vent.solve(p, NOT_AVAILABLE);
    expect(p.length_m.value).toBeNull();
    expect(issues).toContainEqual(expect.objectContaining({kind: 'missing-dependencies', target: 'length_m'}));
    expect(namedFields(issues, 'length_m')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });

  it('leaves tuning not available when only the length is entered', () => {
    const p = ventParams({length_m: 0.1});
    const issues = engine.vent.solve(p, NOT_AVAILABLE);
    expect(p.tuning_goal_hz.value).toBeNull();
    expect(namedFields(issues, 'tuning_goal_hz')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });

  it('keeps an entered tuning and an entered length', () => {
    const p = ventParams({tuning_goal_hz: 35, length_m: 0.5});
    const issues = engine.vent.solve(p, NOT_AVAILABLE);
    expect(p.tuning_goal_hz.value).toBe(35);
    expect(p.length_m.value).toBe(0.5);
    expect(issues).toEqual([]);
  });

  it('available air solves the length', () => {
    const p = ventParams({tuning_goal_hz: 35});
    expect(engine.vent.solve(p, AVAILABLE)).toEqual([]);
    expect(p.length_m.value).toBeGreaterThan(0);
  });
});

describe('AirState — passive radiator', () => {
  it('solve leaves added mass not available and names c and rho', () => {
    const p = prParams({tuning_goal_hz: 30});
    const issues = engine.pr.solve(p, NOT_AVAILABLE);
    expect(p.addedMass_kg.value).toBeNull();
    expect(namedFields(issues, 'addedMass_kg')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });

  it('solve leaves tuning not available when only the added mass is entered', () => {
    const p = prParams({addedMass_kg: 0.01});
    const issues = engine.pr.solve(p, NOT_AVAILABLE);
    expect(p.tuning_goal_hz.value).toBeNull();
    expect(p.systemTuning_hz.value).toBeNull();
    expect(namedFields(issues, 'tuning_goal_hz')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });

  it('solveSpec derives Cms from Mms and Fs but not Vas from Cms and Sd', () => {
    const stated = {Fs_hz: 30, Qms: null, Vas_m3: null, Sd_m2: 0.01, Mms_kg: 0.02, Cms_m_per_N: null, Rms_kg_per_s: null};
    const solved = engine.pr.solveSpec(stated, NOT_AVAILABLE);
    expect(solved.Cms_m_per_N).not.toBeNull();
    expect(solved.Vas_m3).toBeNull();
  });

  it('solveSpec with available air derives Vas', () => {
    const stated = {Fs_hz: 30, Qms: null, Vas_m3: null, Sd_m2: 0.01, Mms_kg: 0.02, Cms_m_per_N: null, Rms_kg_per_s: null};
    expect(engine.pr.solveSpec(stated, AVAILABLE).Vas_m3).not.toBeNull();
  });

  it('checkSpec names c and rho when Cms cannot come from Vas and Sd without air', () => {
    const stated = {Fs_hz: null, Qms: null, Vas_m3: 0.005, Sd_m2: 0.01, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};
    const zero = {Fs_hz: 0, Qms: 0, Vas_m3: 0, Sd_m2: 0, Mms_kg: 0, Cms_m_per_N: 0, Rms_kg_per_s: 0};
    const issues = engine.pr.checkSpec(stated, zero, NOT_AVAILABLE);
    expect(namedFields(issues, 'Cms_m_per_N')).toEqual(expect.arrayContaining(['c_m_per_s', 'roo_kg_per_m3']));
  });
});
