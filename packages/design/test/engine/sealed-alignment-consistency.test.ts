import {describe, expect, it} from 'vitest';
import type {SolverField} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {checkSealedAlignment, fakeSolverField, solveSealedAlignmentGroup} from './testSolver.js';

const engine = new Engine();

describe('solveSealedAlignmentGroup (S2-10: a test-only bag wrapper over Engine.solveSealedAlignment)', () => {
  it('solves Vb from Qts, Vas, and a target Qtc', () => {
    const solved = solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707 });
    expect(solved.Vb_m3).not.toBeUndefined();
    expect(solved.Vb_m3!).toBeGreaterThan(0);
  });

  it('solves Qtc from Qts, Vas, and a stated Vb', () => {
    const solved = solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Vb_m3: 0.02 });
    expect(solved.Qtc).not.toBeUndefined();
    expect(solved.Qtc!).toBeGreaterThan(0.4);
  });

  it('does not overwrite an already-stated Vb even when Qtc is also stated', () => {
    const solved = solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707, Vb_m3: 0.099 });
    expect(solved.Vb_m3).toBe(0.099);
  });
});

describe('checkSealedAlignment (S2-10: a test-only bag wrapper over Engine.solveSealedAlignment)', () => {
  it('returns no issues once Vb solves from a complete input set', () => {
    const solved = solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707 });
    expect(checkSealedAlignment(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for Vb_m3 when Qtc is stated but Qts/Vas are not', () => {
    const solved = solveSealedAlignmentGroup({ Qtc: 0.707 });
    const issues = checkSealedAlignment(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb_m3' });
    if (issues[0].kind === 'missing-dependencies') {
      expect([...issues[0].routes[0].missing].sort()).toEqual(['Qts', 'Vas_m3']);
    }
  });

  it('reports a missing-dependencies issue for Qtc when Vb is stated but Qts/Vas are not', () => {
    const solved = solveSealedAlignmentGroup({ Vb_m3: 0.02 });
    const issues = checkSealedAlignment(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Qtc' });
  });

  it('reports no issue when neither Qtc nor Vb is stated — no target chosen yet', () => {
    const solved = solveSealedAlignmentGroup({});
    expect(checkSealedAlignment(solved)).toEqual([]);
  });
});

describe('Engine.solveSealedAlignment — handle solve, values written onto the params (T10/T11)', () => {
  function params(p: { Qts?: number; Vas_m3?: number; Qtc?: number; Vb_m3?: number }): {
    Qts: SolverField; Vas_m3: SolverField; Qtc: SolverField; Vb_m3: SolverField;
  } {
    return {
      Qts: fakeSolverField(p.Qts ?? null),
      Vas_m3: fakeSolverField(p.Vas_m3 ?? null),
      Qtc: fakeSolverField(p.Qtc ?? null),
      Vb_m3: fakeSolverField(p.Vb_m3 ?? null),
    };
  }

  it('writes the derived Vb onto its handle when Qtc is stated and Qts/Vas are complete', () => {
    const p = params({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707 });
    const issues = engine.solveSealedAlignment(p);
    expect(p.Vb_m3.value).toBeGreaterThan(0);
    expect(p.Vb_m3.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('writes the derived Qtc onto its handle when Vb is stated', () => {
    const p = params({ Qts: 0.4, Vas_m3: 0.03, Vb_m3: 0.02 });
    const issues = engine.solveSealedAlignment(p);
    expect(p.Qtc.value).toBeGreaterThan(0.4);
    expect(p.Qtc.calculated).toBe(true);
    expect(issues).toEqual([]);
  });

  it('never overwrites a stated value, even when the other member is also stated', () => {
    const p = params({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707, Vb_m3: 0.099 });
    const issues = engine.solveSealedAlignment(p);
    expect(p.Vb_m3.value).toBe(0.099);
    expect(p.Vb_m3.entered).toBe(true);
    expect(issues).toEqual([]);
  });

  it('leaves the blocked target not-available and reports the missing driver quantities', () => {
    const p = params({ Qtc: 0.707 });
    const issues = engine.solveSealedAlignment(p);
    expect(p.Vb_m3.value).toBeNull();
    expect(p.Vb_m3.notAvailable).toBe(true);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb_m3' });
  });

  it('reports no issue when no target is stated — no target chosen yet', () => {
    const p = params({ Qts: 0.4, Vas_m3: 0.03 });
    const issues = engine.solveSealedAlignment(p);
    expect(p.Qtc.value).toBeNull();
    expect(p.Vb_m3.value).toBeNull();
    expect(issues).toEqual([]);
  });
});
