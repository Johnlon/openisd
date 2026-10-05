/**
 * `createSimulationEngine()` is the simulation area on its own, for a thread that only sweeps (the
 * sweep worker). It answers exactly as the whole engine's `simulation` area does.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine, createSimulationEngine} from '../../engine/index.js';
import type {SweepParams} from '../../engine/index.js';
import {ProjectBuilder} from '../../domain/index.js';

const engine = createEngine();
const LE_H = 0.70e-3;
const SP: SweepParams = {Vb: 0.030, eg: 2.83, fmin: 10, fmax: 2000, N: 50, filters: []};

function solvedDriver() {
  const specs = ProjectBuilder.empty(engine).driver.specs;
  specs.Fs_hz.set(37); specs.Qts.set(0.378); specs.Qes.set(0.40); specs.Qms.set(7.0);
  specs.Vas_m3.set(0.0300); specs.Sd_m2.set(0.0133); specs.Re_ohm.set(5.6); specs.Le_H.set(LE_H);
  specs.Xmax_m.set(0.005); specs.Pe_W.set(60); specs.Znom_ohm.set(8);
  return specs.sweepDriver();
}

describe('createSimulationEngine', () => {
  it('sweeps exactly as the whole engine\'s simulation area does', () => {
    const drv = solvedDriver();
    const alone = createSimulationEngine().sweep(drv, LE_H, 'sealed', SP);
    const whole = engine.simulation.sweep(drv, LE_H, 'sealed', SP);
    const values = alone.values;
    assert.ok(values !== null && values.fs.length > 0, 'a sweep with values');
    assert.deepEqual(alone.values, whole.values);
  });
});
