import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {driverParams, fakeSolverField} from './testSolver.js';

const engine = createEngine();
const AIR = engine.environment.solve({}).values;

/** Qts = Qes·Qms/(Qes+Qms); its half-width is each input's half-width times |∂Qts/∂input|. The
 *  solve bumps each input by its full half-width rather than differentiating, so it lands within
 *  1% of this. */
function qtsHalfWidth(qes: number, dQes: number, qms: number, dQms: number): number {
  const s = (qes + qms) ** 2;
  return (qms * qms / s) * dQes + (qes * qes / s) * dQms;
}

describe('DriverEngine.solve — a calculated value carries the precision its inputs give it', () => {
  it('Qts from Qes ±0.005 and Qms ±0.05 is known to about ±0.0046', () => {
    const p = driverParams({});
    p.Qes = fakeSolverField(0.45, 0.005);
    p.Qms = fakeSolverField(3.2, 0.05);
    engine.driver.solve(p, AIR);
    expect(p.Qts.calculated).toBe(true);
    expect(p.Qts.precision).toBeCloseTo(qtsHalfWidth(0.45, 0.005, 3.2, 0.05), 4);
  });

  it('tighter inputs give a tighter calculated value', () => {
    const p = driverParams({});
    p.Qes = fakeSolverField(0.45, 0.00005);
    p.Qms = fakeSolverField(3.2, 0.0005);
    engine.driver.solve(p, AIR);
    expect(p.Qts.precision).toBeCloseTo(qtsHalfWidth(0.45, 0.00005, 3.2, 0.0005), 6);
  });

  it('a value calculated from no entered input carries no precision', () => {
    const p = driverParams({});
    engine.driver.solve(p, AIR);
    expect(p.c_m_per_s.calculated).toBe(true);
    expect(p.c_m_per_s.precision).toBeNull();
  });
});
