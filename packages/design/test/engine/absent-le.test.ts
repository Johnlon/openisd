import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// Reference driver — the demo 6.5" woofer (store.DEFAULT_DRIVER), which every other
// engine test also uses, so a failure here is about the option under test, not the driver.
const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};

/** The solver never refuses — an underdetermined driver simply has fewer known values, and
 *  `sweep` is what reports that it cannot be simulated. */
const derive = (raw: Record<string, number>) => sweepDriver(solveConsistencyGroup({
  Fs_hz: raw.Fs, Qts: raw.Qts, Qes: raw.Qes, Qms: raw.Qms, Vas_m3: raw.Vas,
  Sd_m2: raw.Sd, Re_ohm: raw.Re, Xmax_m: raw.Xmax, Pe_W: raw.Pe, Znom_ohm: raw.Znom,
}));

describe('absent Le', () => {
  describe('absent Le — the impedance plot must stay finite (BUG)', () => {
    // Before the fix: circuit.ts evaluated `w * drv.Le!` with Le === undefined, so Zcoil
    // and therefore Zel were NaN at every frequency, and classifyFinite reported the
    // misleading "check the box volume and driver parameters" error.
    const rawNoLe = { ...RAW };
    delete rawNoLe.Le;

    it('a driver with no Le still simulates — Le is optional, not required', () => {
      // `sweep` is where this is answered. There is no separate derive-and-validate step: the
      // validation lives in the method that does the work, so the sweep's own Result says both
      // whether a curve came out and what stopped it if none did.
      const { values, issues } = engine.simulation.sweep(
        derive(rawNoLe), undefined, 'sealed', { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 });
      assert.ok(values, 'driver with no Le should still sweep');
      assert.equal(issues.length, 0);
    });

    it('sweep produces a finite impedance curve when Le is absent', () => {
      const sw = engine.simulation.sweep(derive(rawNoLe), undefined, 'sealed', { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 }).values!;
      for (let i = 0; i < sw.fs.length; i++) {
        assert.ok(Number.isFinite(sw.zmag[i]), `zmag[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zmag[i]}`);
        assert.ok(Number.isFinite(sw.zph[i]),  `zph[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zph[i]}`);
      }
    });

    it('absent Le is exactly equivalent to Le = 0 (it is a missing inductor, not a missing driver)', () => {
      const P: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 };
      const noLe   = engine.simulation.sweep(derive(rawNoLe), undefined, 'sealed', P).values!;
      const zeroLe = engine.simulation.sweep(derive(RAW), 0, 'sealed', P).values!;
      for (let i = 0; i < noLe.fs.length; i++)
        assert.equal(noLe.zmag[i], zeroLe.zmag[i], `zmag[${i}] must match the explicit Le=0 driver`);
    });
  });
});
