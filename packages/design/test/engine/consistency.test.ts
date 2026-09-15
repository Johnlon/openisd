import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { DriverSolverQuantities } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.checkConsistency', () => {
  it('returns no issues for a self-consistent driver', () => {
    const Qes = 0.4, Qms = 3.0;
    const Qts = (Qes * Qms) / (Qes + Qms);
    const issues = engine.checkConsistency({ Qts, Qes, Qms });
    expect(issues).toEqual([]);
  });

  it('reports an inconsistent-inputs issue when Qts contradicts Qes/Qms', () => {
    const Qes = 0.4, Qms = 3.0;
    const issues = engine.checkConsistency({ Qts: 7.5, Qes, Qms });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: 'inconsistent-inputs',
      target: 'Qts',
      fields: ['Qts', 'Qes', 'Qms'],
      actual: 7.5,
    });
  });

  it('reports a missing-dependencies issue for Qts when fewer than two of Qts/Qes/Qms are stated', () => {
    const issues = engine.checkConsistency({ Qes: 0.4 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: 'missing-dependencies',
      target: 'Qts',
    });
    if (issues[0].kind === 'missing-dependencies') {
      expect(issues[0].routes).toEqual([
        { formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] },
      ]);
    }
  });
});

describe('Engine.solveDriver', () => {
  it('returns solved values and no issues for a complete, consistent driver', () => {
    const Qes = 0.4, Qms = 3.0;
    const Qts = (Qes * Qms) / (Qes + Qms);
    const result = engine.solveDriver({ Qts, Qes, Qms });
    expect(result.issues).toEqual([]);
    expect(result.values.Qts).toBeCloseTo(Qts, 12);
  });

  it('returns the same values solveConsistencyGroup would, plus the same issues checkConsistency would', () => {
    const input: DriverSolverQuantities = { Qes: 0.4 };
    const result = engine.solveDriver(input);
    expect(result.values).toEqual(engine.solveConsistencyGroup(input));
    expect(result.issues).toEqual(engine.checkConsistency(input));
  });
});
