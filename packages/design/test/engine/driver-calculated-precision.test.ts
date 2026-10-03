import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {knownDecimals} from '../../fields/precision.js';
import {driverParams, fakeSolverField} from './testSolver.js';

const engine = createEngine();
const AIR = engine.environment.solve({}).values;

/** Qts = Qes·Qms/(Qes+Qms); its half-width is Σ |∂Qts/∂input| · input half-width. */
function qtsHalfWidth(qes: number, dQes: number, qms: number, dQms: number): number {
  const s = (qes + qms) ** 2;
  return (qms * qms / s) * dQes + (qes * qes / s) * dQms;
}

// A calculated value's half-width is the guaranteed first-order bound its entered inputs give
// it: Σ |∂f/∂x|·d(x) — winisd_tools' former lib/precision.py, CALCULATIONS.md §1.3.
describe('DriverEngine.solve — a calculated value carries the precision its inputs give it', () => {
  it('Qts from Qes 0.45 (±0.005) and Qms 3.2 (±0.05)', () => {
    const p = driverParams({});
    p.Qes = fakeSolverField(0.45, 0.005);
    p.Qms = fakeSolverField(3.2, 0.05);
    engine.driver.solve(p, AIR);
    expect(p.Qts.calculated).toBe(true);
    expect(p.Qts.precision).toBeCloseTo(qtsHalfWidth(0.45, 0.005, 3.2, 0.05), 9);
  });

  it('Vd = Sd 0.2 × Xmax 0.030 shows 0.006', () => {
    const p = driverParams({});
    p.Sd_m2 = fakeSolverField(0.2, 0.05);
    p.Xmax_m = fakeSolverField(0.03, 0.0005);
    engine.driver.solve(p, AIR);
    const vd = p.Vd_m3.value!;
    expect(vd.toFixed(knownDecimals(p.Vd_m3.precision!, vd))).toBe('0.006');
  });

  it('Vd = Sd 0.20 × Xmax 0.0300 shows 0.0060', () => {
    const p = driverParams({});
    p.Sd_m2 = fakeSolverField(0.2, 0.005);
    p.Xmax_m = fakeSolverField(0.03, 0.00005);
    engine.driver.solve(p, AIR);
    const vd = p.Vd_m3.value!;
    expect(vd.toFixed(knownDecimals(p.Vd_m3.precision!, vd))).toBe('0.0060');
  });

  it('a value calculated from no entered input carries no precision', () => {
    const p = driverParams({});
    engine.driver.solve(p, AIR);
    expect(p.c_m_per_s.calculated).toBe(true);
    expect(p.c_m_per_s.precision).toBeNull();
  });
});
