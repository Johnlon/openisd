import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.70e-3;

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

const DRV = derive(RAW);

// A vented box tuned near the driver's Fs, with a long-ish port so its pipe
// resonance c/(2·Leff) lands inside the sweep range and the TL model has something to show.
const SP   = Math.PI * (0.05 / 2) ** 2;          // 50 mm round port

const LEFF = 0.30 + 0.732 * 0.05;                // 300 mm cut length + one-flanged end correction

// The tuning this Sp/Leff/Vb already amounts to (Helmholtz, inverted) — winisd-lossy's own Map
// comes from Fb directly (circuit.ts), so it must agree with the geometry the tests below reason
// about, rather than being left absent (BUG_20260927_vented-box-losses-not-winisd-form.md).
const VB = 0.030;

const {c: refC} = engine.environment.solve({}).values;

const FB = refC * Math.sqrt(SP / (LEFF * VB)) / (2 * Math.PI);

const VENTED: SweepParams = { Vb: VB, eg: 2.83, Sp: SP, Leff: LEFF, Fb: FB, fmin: 10, fmax: 2000, N: 400 };

describe('Xmax-limited SPL', () => {
  describe('Xmax-limited SPL (WinISD Advanced: SPL graph is Xmax limited)', () => {
    it('equals the plain SPL when the drive never reaches Xmax', () => {
      const quiet = engine.simulation.sweep(DRV, LE_H, 'vented', { ...VENTED, eg: 0.01 }).values!;
      for (let i = 0; i < quiet.fs.length; i++) {
        assert.equal(quiet.splXlimCurve[i], quiet.spl[i], `splXlim[${i}] must equal spl[${i}] below Xmax`);
        assert.equal(quiet.xlimited[i], false, `xlimited[${i}] must be false below Xmax`);
      }
    });

    it('clamps exactly to the excursion overshoot where Xmax is exceeded', () => {
      const loud = engine.simulation.sweep(DRV, LE_H, 'vented', { ...VENTED, eg: 40 }).values!;
      let clamped = 0;
      for (let i = 0; i < loud.fs.length; i++) {
        const xPeak = loud.exc[i] / 1000;                 // exc is mm, Xmax is m
        if (xPeak > DRV.values.Xmax_m!) {
          clamped++;
          assert.equal(loud.xlimited[i], true, `xlimited[${i}] must be true at ${loud.fs[i].toFixed(1)} Hz`);
          const expected = loud.spl[i] + 20 * Math.log10(DRV.values.Xmax_m! / xPeak);
          assert.ok(Math.abs(loud.splXlimCurve[i] - expected) < 1e-9,
            `at ${loud.fs[i].toFixed(1)} Hz: splXlim ${loud.splXlimCurve[i]} should be ${expected}`);
          assert.ok(loud.splXlimCurve[i] < loud.spl[i], 'a clamped point must sit below the unclamped SPL');
        } else {
          assert.equal(loud.splXlimCurve[i], loud.spl[i], `splXlim[${i}] must be untouched below Xmax`);
          assert.equal(loud.xlimited[i], false);
        }
      }
      assert.ok(clamped > 0, 'the 40 V drive should exceed Xmax somewhere in the sweep');
    });

    it('never limits a driver with no Xmax — an unknown limit is not a zero limit', () => {
      const noXmax = { ...RAW }; delete noXmax.Xmax;
      const sw = engine.simulation.sweep(derive(noXmax), LE_H, 'vented', { ...VENTED, eg: 40 }).values!;
      for (let i = 0; i < sw.fs.length; i++) {
        assert.equal(sw.splXlimCurve[i], sw.spl[i], `splXlim[${i}] must equal spl[${i}] with no Xmax`);
        assert.equal(sw.xlimited[i], false);
        assert.ok(Number.isFinite(sw.splXlimCurve[i]), `splXlim[${i}] must be finite, got ${sw.splXlimCurve[i]}`);
      }
    });
  });
});
