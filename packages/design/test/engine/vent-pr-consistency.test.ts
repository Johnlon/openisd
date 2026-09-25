import {describe, expect, it} from 'vitest';
import type {SolverField} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {
    checkPrConsistency,
    checkVentConsistency,
    fakeSolverField,
    solvePrConsistencyGroup,
    solveVentConsistencyGroup,
} from './testSolver.js';

const engine = new Engine();
const AIR = engine.solveEnvironment({}).values;

describe('checkVentConsistency (S2-10: a test-only bag wrapper over Engine.solveVent) — missing-dependencies', () => {
  it('returns no issues once tuning_goal_hz solves from a complete vent geometry', () => {
    const solved = solveVentConsistencyGroup({ tuning_goal_hz: 35, Vb_m3: 0.03, area_m2: 0.002 }, AIR);
    expect(checkVentConsistency(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for length_m when tuning_goal_hz is stated but the geometry is not', () => {
    const solved = solveVentConsistencyGroup({ tuning_goal_hz: 35 }, AIR);
    const issues = checkVentConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'length_m' });
    if (issues[0].kind === 'missing-dependencies') {
      expect([...issues[0].routes[0].missing].sort()).toEqual(['Vb_m3', 'area_m2']);
    }
  });

  it('reports a missing-dependencies issue for tuning_goal_hz when length_m is stated but the geometry is not', () => {
    const solved = solveVentConsistencyGroup({ length_m: 0.1 }, AIR);
    const issues = checkVentConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'tuning_goal_hz' });
  });

  it('reports no issue when neither tuning_goal_hz nor length_m is stated — no target chosen yet', () => {
    const solved = solveVentConsistencyGroup({}, AIR);
    expect(checkVentConsistency(solved)).toEqual([]);
  });

  it('still reports the existing inconsistent-inputs case for a non-positive tuning frequency', () => {
    const issues = checkVentConsistency({ tuning_goal_hz: -5 });
    expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.target === 'tuning_goal_hz')).toBe(true);
  });
});

describe('Engine.solveVent — handle solve, values written onto the params (T10/T11)', () => {
  function params(p: {
    tuning_goal_hz?: number; length_m?: number; Vb_m3?: number; area_m2?: number; count?: number; endCorrection_m?: number;
  }): { tuning_goal_hz: SolverField; length_m: SolverField; Vb_m3: SolverField; area_m2: SolverField; count: SolverField; endCorrection_m: SolverField } {
    return {
      tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null),
      length_m: fakeSolverField(p.length_m ?? null),
      Vb_m3: fakeSolverField(p.Vb_m3 ?? null),
      area_m2: fakeSolverField(p.area_m2 ?? null),
      count: fakeSolverField(p.count ?? null),
      endCorrection_m: fakeSolverField(p.endCorrection_m ?? null),
    };
  }

  it('two ports need a longer port than one for the same tuning — the count reaches the solve', () => {
    const one = params({ tuning_goal_hz: 35, Vb_m3: 0.03, area_m2: 0.002, count: 1 });
    const two = params({ tuning_goal_hz: 35, Vb_m3: 0.03, area_m2: 0.002, count: 2 });
    engine.solveVent(one, AIR);
    engine.solveVent(two, AIR);
    expect(two.length_m.value).toBeGreaterThan(one.length_m.value ?? Infinity);
  });

  it('writes the derived length onto its handle when tuning is stated and the geometry is complete', () => {
    const p = params({ tuning_goal_hz: 35, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeGreaterThan(0);
    expect(p.length_m.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('writes the derived tuning onto its handle when length is stated', () => {
    const p = params({ length_m: 0.1, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.tuning_goal_hz.value).toBeGreaterThan(0);
    expect(p.tuning_goal_hz.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites a stated value, even when the other member is also stated', () => {
    const p = params({ tuning_goal_hz: 35, length_m: 111111, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBe(111111);
    expect(p.length_m.entered).toBe(true);
    expect(issues).toEqual([]);
  });

  it('leaves the blocked target not-available and reports the missing geometry', () => {
    const p = params({ tuning_goal_hz: 35 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'length_m' });
  });

  it('reports no issue when no target is stated — no target chosen yet', () => {
    const p = params({ Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeNull();
    expect(p.tuning_goal_hz.value).toBeNull();
    expect(issues).toEqual([]);
  });
});

describe('Engine.solvePr — handle solve, values written onto the params (T10/T11)', () => {
  function params(p: {
    addedMass_kg?: number; tuning_goal_hz?: number; Vb_m3?: number; prMmd_kg?: number;
    prSd_m2?: number; prCms_m_per_N?: number;
  }): { addedMass_kg: SolverField; tuning_goal_hz: SolverField; Vb_m3: SolverField; prMmd_kg: SolverField; prSd_m2: SolverField; prCms_m_per_N: SolverField; resonanceWithAddedMass_hz: SolverField; systemTuning_hz: SolverField } {
    return {
      addedMass_kg: fakeSolverField(p.addedMass_kg ?? null),
      tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null),
      Vb_m3: fakeSolverField(p.Vb_m3 ?? null),
      prMmd_kg: fakeSolverField(p.prMmd_kg ?? null),
      prSd_m2: fakeSolverField(p.prSd_m2 ?? null),
      prCms_m_per_N: fakeSolverField(p.prCms_m_per_N ?? null),
      resonanceWithAddedMass_hz: fakeSolverField<number>(null),
      systemTuning_hz: fakeSolverField<number>(null),
    };
  }

  it('writes the derived added mass onto its handle when tuning is stated and the geometry is complete', () => {
    const p = params({ tuning_goal_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
    const issues = engine.solvePr(p, AIR);
    expect(p.addedMass_kg.value).toBeGreaterThan(0);
    expect(p.addedMass_kg.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('writes the derived tuning onto its handle when added mass is stated and the geometry is complete', () => {
    const p = params({ addedMass_kg: 0.01, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
    const issues = engine.solvePr(p, AIR);
    expect(p.tuning_goal_hz.value).toBeGreaterThan(0);
    expect(p.tuning_goal_hz.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites a stated value, even when both targets are stated', () => {
    const p = params({ tuning_goal_hz: 30, addedMass_kg: 111111, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
    const issues = engine.solvePr(p, AIR);
    expect(p.addedMass_kg.value).toBe(111111);
    expect(p.addedMass_kg.entered).toBe(true);
    expect(p.tuning_goal_hz.entered).toBe(true);
    expect(issues).toEqual([]);
  });

  it('leaves the blocked target not-available and reports the missing geometry', () => {
    const p = params({ tuning_goal_hz: 30 });
    const issues = engine.solvePr(p, AIR);
    expect(p.addedMass_kg.value).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
  });
});

describe('checkPrConsistency (S2-10: a test-only bag wrapper over Engine.solvePr) — missing-dependencies', () => {
  it('returns no issues once tuning_goal_hz solves from a complete PR geometry', () => {
    const solved = solvePrConsistencyGroup({
      tuning_goal_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
    }, AIR);
    expect(checkPrConsistency(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for addedMass_kg when tuning_goal_hz is stated but the geometry is not', () => {
    const solved = solvePrConsistencyGroup({ tuning_goal_hz: 30 }, AIR);
    const issues = checkPrConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
  });

  it('reports no issue when nothing that implies a target is stated', () => {
    const solved = solvePrConsistencyGroup({}, AIR);
    expect(checkPrConsistency(solved)).toEqual([]);
  });

  it('reports target-unreachable when the entered tuning needs negative added mass', () => {
    const issues = checkPrConsistency({
      tuning_goal_hz: 1000, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
    }, AIR);
    expect(issues.some(i => i.kind === 'target-unreachable' && i.target === 'addedMass_kg')).toBe(true);
  });

  it('reports an inconsistent-inputs issue for a non-positive tuning frequency', () => {
    const issues = checkPrConsistency({ tuning_goal_hz: -5 });
    expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.target === 'tuning_goal_hz')).toBe(true);
  });
});
