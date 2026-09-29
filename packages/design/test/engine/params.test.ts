import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';

const engine = createEngine();

describe('Engine.solveBoxParams — {values, issues} enclosure precondition (T9)', () => {
  it('returns the same params as values, and no issues, for a sealed box with a usable Vb', () => {
    const P = { Vb: 0.03 };
    const result = engine.simulation.solveBoxParams('sealed', P);
    expect(result.values).toBe(P);
    expect(result.issues).toEqual([]);
  });

  it('reports a missing-dependencies issue naming Vb, and null values, when a sealed box has no volume', () => {
    const result = engine.simulation.solveBoxParams('sealed', {});
    expect(result.values).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb' });
  });

  it('reports one issue per missing field for a vented box missing both Vb and Sp', () => {
    const result = engine.simulation.solveBoxParams('vented', {});
    expect(result.values).toBeNull();
    expect(result.issues.map(i => i.target).sort()).toEqual(['Sp', 'Vb']);
  });

  it('reports every passive-radiator field the circuit divides by', () => {
    const result = engine.simulation.solveBoxParams('box-passive-radiator', { Vb: 0.02 });
    expect(result.values).toBeNull();
    expect(result.issues.map(i => i.target).sort()).toEqual(['prCms', 'prMmd', 'prSd']);
  });

  it('reports one issue per missing field for a bandpass6/abc box missing both Vb and Vf', () => {
    for (const box of ['bandpass6', 'abc'] as const) {
      const result = engine.simulation.solveBoxParams(box, {});
      expect(result.values).toBeNull();
      expect(result.issues.map(i => i.target).sort()).toEqual(['Vb', 'Vf']);
    }
  });
});
