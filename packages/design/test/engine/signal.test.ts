import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { SignalSolverQuantities } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.solveSignal', () => {
  it('resolves drive_V from the established 1 W reference when neither power nor voltage is stated', () => {
    const input: SignalSolverQuantities = { Re_ohm: 6.4 };
    const result = engine.solveSignal(input);
    expect(result.issues).toEqual([]);
    expect(result.values.drive_V).toBeCloseTo(Math.sqrt(1 * 6.4), 9);
  });

  it('resolves drive_V from stated power and Re', () => {
    const input: SignalSolverQuantities = { power_W: 100, Re_ohm: 6.4 };
    const result = engine.solveSignal(input);
    expect(result.issues).toEqual([]);
    expect(result.values.drive_V).toBeCloseTo(Math.sqrt(100 * 6.4), 9);
  });

  it('resolves drive_V directly from stated voltage, with no Re needed', () => {
    const input: SignalSolverQuantities = { voltage_V: 20 };
    const result = engine.solveSignal(input);
    expect(result.issues).toEqual([]);
    expect(result.values.drive_V).toBe(20);
  });

  it('reports a missing-dependencies issue for drive_V when no power, voltage, or Re is stated', () => {
    const result = engine.solveSignal({});
    expect(result.values.drive_V).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'drive_V' });
  });

  it('reports an inconsistent-inputs issue when stated power/voltage/Re disagree', () => {
    // sqrt(100 * 6.4) = 25.298..., not 20.
    const input: SignalSolverQuantities = { power_W: 100, voltage_V: 20, Re_ohm: 6.4 };
    const result = engine.solveSignal(input);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'inconsistent-inputs', target: 'voltage_V', actual: 20 });
  });

  it('reports no issue when stated power/voltage/Re agree', () => {
    const input: SignalSolverQuantities = { power_W: 100, voltage_V: Math.sqrt(100 * 6.4), Re_ohm: 6.4 };
    const result = engine.solveSignal(input);
    expect(result.issues).toEqual([]);
  });

  it('carries driverCount/wiring/seriesResistance_ohm through unchanged, untouched by the drive resolution', () => {
    const input: SignalSolverQuantities = { Re_ohm: 6.4, driverCount: 2, wiring: 'series', seriesResistance_ohm: 0.1 };
    const result = engine.solveSignal(input);
    expect(result.values.driverCount).toBe(2);
    expect(result.values.wiring).toBe('series');
    expect(result.values.seriesResistance_ohm).toBe(0.1);
  });
});
