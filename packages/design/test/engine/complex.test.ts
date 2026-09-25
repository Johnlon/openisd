import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {driverParams, solveConsistencyGroup} from './testSolver.js';

/**
 * `cTanh` (engine/complex.ts) has a saturation guard: past |2·re| = 40 it returns ±1 directly
 * instead of evaluating sinh/cosh, because sinh/cosh both overflow to Infinity there and
 * Infinity/Infinity is NaN. The only caller is the transmission-line port model
 * (circuit.ts `portImpedance`), reached from `Engine.sweep` with `tlPortModel: true`. A port
 * with a very low Qp (heavily damped line) drives cTanh's argument past the guard at every
 * swept frequency — this proves the guard keeps the sweep finite instead of NaN.
 */
describe('transmission-line port model — tanh saturation guard', () => {
  const engine = new Engine();
  const DRV = driverParams(solveConsistencyGroup({
    Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
    Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
  }));
  const LE_H = 0.70e-3;
  const SP   = Math.PI * (0.05 / 2) ** 2;
  const LEFF = 0.30 + 0.732 * 0.05;
  // Qp far below any realistic port loss (typically ~10-100) — chosen only to push
  // k·Leff/Qp past the guard's threshold at every frequency in the sweep, not as a
  // physically meaningful port.
  const HEAVILY_DAMPED: SweepParams =
    { Vb: 0.030, eg: 2.83, Sp: SP, Leff: LEFF, Qp: 0.001, tlPortModel: true, fmin: 10, fmax: 1000, N: 20 };

  it('stays finite across the whole sweep once the line is heavily damped enough to saturate tanh', () => {
    const sw = engine.sweep(DRV, LE_H, 'vented', HEAVILY_DAMPED).values!;
    assert.ok(sw, 'a heavily-damped TL port must still produce a sweep');
    for (let i = 0; i < sw.fs.length; i++) {
      assert.ok(Number.isFinite(sw.zmag[i]), `zmag[${i}] must be finite at ${sw.fs[i]} Hz`);
      assert.ok(Number.isFinite(sw.zph[i]),  `zph[${i}] must be finite at ${sw.fs[i]} Hz`);
      assert.ok(Number.isFinite(sw.spl[i]),  `spl[${i}] must be finite at ${sw.fs[i]} Hz`);
      assert.ok(Number.isFinite(sw.pv[i]),   `pv[${i}] must be finite at ${sw.fs[i]} Hz`);
    }
  });
});
