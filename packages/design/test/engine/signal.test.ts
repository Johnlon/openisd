import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { SignalSolverQuantities } from '../../engine/index.js';

const engine = new Engine();

describe('Engine.solveSignal', () => {
  it('resolves drive_V from the established 1 W reference when no power is stated', () => {
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

  it('reports a missing-dependencies issue for drive_V when no power or Re is stated (T5)', () => {
    const result = engine.solveSignal({});
    expect(result.values.drive_V).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'drive_V' });
  });

  it('reports the same missing-dependencies issue for drive_V when power is stated but Re is not (T5)', () => {
    const result = engine.solveSignal({ power_W: 100 });
    expect(result.values.drive_V).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'drive_V' });
  });

  it('carries driverCount/wiring/seriesResistance_ohm through unchanged, untouched by the drive resolution', () => {
    const input: SignalSolverQuantities = { Re_ohm: 6.4, driverCount: 2, wiring: 'series', seriesResistance_ohm: 0.1 };
    const result = engine.solveSignal(input);
    expect(result.values.driverCount).toBe(2);
    expect(result.values.wiring).toBe('series');
    expect(result.values.seriesResistance_ohm).toBe(0.1);
  });
});
