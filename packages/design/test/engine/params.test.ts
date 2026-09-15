import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.checkBoxParams — BoxParamsIssue-shaped enclosure precondition', () => {
  it('returns no issues for a sealed box with a usable Vb', () => {
    const issues = engine.checkBoxParams('sealed', { Vb: 0.03 });
    expect(issues).toEqual([]);
  });

  it('reports a missing-dependencies issue naming Vb when a sealed box has no volume', () => {
    const issues = engine.checkBoxParams('sealed', {});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'Vb' });
  });

  it('reports one issue per missing field for a vented box missing both Vb and Sp', () => {
    const issues = engine.checkBoxParams('vented', {});
    expect(issues.map(i => i.target).sort()).toEqual(['Sp', 'Vb']);
  });

  it('reports every passive-radiator field the circuit divides by', () => {
    const issues = engine.checkBoxParams('box-passive-radiator', { Vb: 0.02 });
    expect(issues.map(i => i.target).sort()).toEqual(['prCms', 'prMmd', 'prSd']);
  });

  it('returns no issues for a topology the engine has no circuit model for', () => {
    const issues = engine.checkBoxParams('bandpass6', {});
    expect(issues).toEqual([]);
  });

  it('reports the same set of blocked fields validateParams() already reports, just DriverIssue-shaped', () => {
    const legacy = engine.validateParams('vented', {});
    const unified = engine.checkBoxParams('vented', {});
    expect(unified.map(i => i.target).sort()).toEqual(legacy.map(e => e.field).sort());
  });
});
