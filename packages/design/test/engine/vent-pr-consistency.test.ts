import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { VentSolverQuantities, PrSolverQuantities, SolverField } from '../../engine/index.js';
import { fakeSolverField } from './testSolver.js';

const engine = new Engine();
const AIR = engine.airFor({});

describe('Engine.checkVentConsistency — missing-dependencies', () => {
  it('returns no issues once tuning_hz solves from a complete vent geometry', () => {
    const solved = engine.solveVentConsistencyGroup({ tuning_hz: 35, Vb_m3: 0.03, area_m2: 0.002 }, AIR);
    expect(engine.checkVentConsistency(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for length_m when tuning_hz is stated but the geometry is not', () => {
    const solved = engine.solveVentConsistencyGroup({ tuning_hz: 35 }, AIR);
    const issues = engine.checkVentConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'length_m' });
    if (issues[0].kind === 'missing-dependencies') {
      expect([...issues[0].routes[0].missing].sort()).toEqual(['Vb_m3', 'area_m2']);
    }
  });

  it('reports a missing-dependencies issue for tuning_hz when length_m is stated but the geometry is not', () => {
    const solved = engine.solveVentConsistencyGroup({ length_m: 0.1 }, AIR);
    const issues = engine.checkVentConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'tuning_hz' });
  });

  it('reports no issue when neither tuning_hz nor length_m is stated — no target chosen yet', () => {
    const solved = engine.solveVentConsistencyGroup({}, AIR);
    expect(engine.checkVentConsistency(solved)).toEqual([]);
  });

  it('still reports the existing inconsistent-inputs case for a non-positive tuning frequency', () => {
    const issues = engine.checkVentConsistency({ tuning_hz: -5 } as VentSolverQuantities);
    expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.target === 'tuning_hz')).toBe(true);
  });
});

describe('Engine.solveVent — handle solve, values written onto the params (T10/T11)', () => {
  function params(p: {
    tuning_hz?: number; length_m?: number; Vb_m3?: number; area_m2?: number; endCorrection_m?: number;
  }): { tuning_hz: SolverField; length_m: SolverField; Vb_m3: SolverField; area_m2: SolverField; endCorrection_m: SolverField } {
    return {
      tuning_hz: fakeSolverField(p.tuning_hz ?? null),
      length_m: fakeSolverField(p.length_m ?? null),
      Vb_m3: fakeSolverField(p.Vb_m3 ?? null),
      area_m2: fakeSolverField(p.area_m2 ?? null),
      endCorrection_m: fakeSolverField(p.endCorrection_m ?? null),
    };
  }

  it('writes the derived length onto its handle when tuning is stated and the geometry is complete', () => {
    const p = params({ tuning_hz: 35, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeGreaterThan(0);
    expect(p.length_m.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('writes the derived tuning onto its handle when length is stated', () => {
    const p = params({ length_m: 0.1, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.tuning_hz.value).toBeGreaterThan(0);
    expect(p.tuning_hz.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites a stated value, even when the other member is also stated', () => {
    const p = params({ tuning_hz: 35, length_m: 111111, Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBe(111111);
    expect(p.length_m.entered).toBe(true);
    expect(issues).toEqual([]);
  });

  it('leaves the blocked target not-available and reports the missing geometry', () => {
    const p = params({ tuning_hz: 35 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeNull();
    expect(p.length_m.notAvailable).toBe(true);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'length_m' });
  });

  it('reports no issue when no target is stated — no target chosen yet', () => {
    const p = params({ Vb_m3: 0.03, area_m2: 0.002 });
    const issues = engine.solveVent(p, AIR);
    expect(p.length_m.value).toBeNull();
    expect(p.tuning_hz.value).toBeNull();
    expect(issues).toEqual([]);
  });
});

describe('Engine.solvePr — the unified { values, issues } bundle (C5)', () => {
  it('solves the missing PR member and reports the issues in one call', () => {
    const result = engine.solvePr({
      tuning_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
    }, AIR);
    expect(result.values.addedMass_kg).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });

  it('solves tuning_hz when addedMass_kg is stated and the geometry is complete', () => {
    const result = engine.solvePr({
      addedMass_kg: 0.01, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
    }, AIR);
    expect(result.values.tuning_hz).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });

  it('reports a missing dependency for addedMass_kg when tuning_hz is stated but the geometry is not', () => {
    const result = engine.solvePr({ tuning_hz: 30 }, AIR);
    expect(result.values.addedMass_kg).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
  });
});

describe('Engine.checkPrConsistency — missing-dependencies', () => {
  it('returns no issues once tuning_hz solves from a complete PR geometry', () => {
    const solved = engine.solvePrConsistencyGroup({
      tuning_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
    }, AIR);
    expect(engine.checkPrConsistency(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for addedMass_kg when tuning_hz is stated but the geometry is not', () => {
    const solved = engine.solvePrConsistencyGroup({ tuning_hz: 30 }, AIR);
    const issues = engine.checkPrConsistency(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
  });

  it('reports no issue when nothing that implies a target is stated', () => {
    const solved = engine.solvePrConsistencyGroup({}, AIR);
    expect(engine.checkPrConsistency(solved)).toEqual([]);
  });

  it('still reports the existing inconsistent-inputs case for a negative added mass', () => {
    const issues = engine.checkPrConsistency({ addedMass_kg: -0.01 } as PrSolverQuantities);
    expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.target === 'addedMass_kg')).toBe(true);
  });
});
