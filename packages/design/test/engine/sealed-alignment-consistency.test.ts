import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.solveSealedAlignmentGroup', () => {
  it('solves Vb from Qts, Vas, and a target Qtc', () => {
    const solved = engine.solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707 });
    expect(solved.Vb_m3).not.toBeUndefined();
    expect(solved.Vb_m3!).toBeGreaterThan(0);
  });

  it('solves Qtc from Qts, Vas, and a stated Vb', () => {
    const solved = engine.solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Vb_m3: 0.02 });
    expect(solved.Qtc).not.toBeUndefined();
    expect(solved.Qtc!).toBeGreaterThan(0.4);
  });

  it('does not overwrite an already-stated Vb even when Qtc is also stated', () => {
    const solved = engine.solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707, Vb_m3: 0.099 });
    expect(solved.Vb_m3).toBe(0.099);
  });
});

describe('Engine.checkSealedAlignment', () => {
  it('returns no issues once Vb solves from a complete input set', () => {
    const solved = engine.solveSealedAlignmentGroup({ Qts: 0.4, Vas_m3: 0.03, Qtc: 0.707 });
    expect(engine.checkSealedAlignment(solved)).toEqual([]);
  });

  it('reports a missing-dependencies issue for Vb_m3 when Qtc is stated but Qts/Vas are not', () => {
    const solved = engine.solveSealedAlignmentGroup({ Qtc: 0.707 });
    const issues = engine.checkSealedAlignment(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb_m3' });
    if (issues[0].kind === 'missing-dependencies') {
      expect([...issues[0].routes[0].missing].sort()).toEqual(['Qts', 'Vas_m3']);
    }
  });

  it('reports a missing-dependencies issue for Qtc when Vb is stated but Qts/Vas are not', () => {
    const solved = engine.solveSealedAlignmentGroup({ Vb_m3: 0.02 });
    const issues = engine.checkSealedAlignment(solved);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Qtc' });
  });

  it('reports no issue when neither Qtc nor Vb is stated — no target chosen yet', () => {
    const solved = engine.solveSealedAlignmentGroup({});
    expect(engine.checkSealedAlignment(solved)).toEqual([]);
  });
});
