import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.solveBoxParams — {values, issues} enclosure precondition (T9)', () => {
  it('returns the same params as values, and no issues, for a sealed box with a usable Vb', () => {
    const P = { Vb: 0.03 };
    const result = engine.solveBoxParams('sealed', P);
    expect(result.values).toBe(P);
    expect(result.issues).toEqual([]);
  });

  it('reports a missing-dependencies issue naming Vb, and null values, when a sealed box has no volume', () => {
    const result = engine.solveBoxParams('sealed', {});
    expect(result.values).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb' });
  });

  it('reports one issue per missing field for a vented box missing both Vb and Sp', () => {
    const result = engine.solveBoxParams('vented', {});
    expect(result.values).toBeNull();
    expect(result.issues.map(i => i.target).sort()).toEqual(['Sp', 'Vb']);
  });

  it('reports every passive-radiator field the circuit divides by', () => {
    const result = engine.solveBoxParams('box-passive-radiator', { Vb: 0.02 });
    expect(result.values).toBeNull();
    expect(result.issues.map(i => i.target).sort()).toEqual(['prCms', 'prMmd', 'prSd']);
  });

  it('returns {values: null, issues: []} for a topology the engine has no circuit model for', () => {
    const result = engine.solveBoxParams('bandpass6', {});
    expect(result).toEqual({ values: null, issues: [] });
  });
});
