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

describe('transmission-line port model', () => {
  describe('transmission-line port model (WinISD Advanced: TLPorts)', () => {
    const F_PIPE = engine.environment.solve({}).values.c / (2 * LEFF);   // half-wave fundamental of the duct — the same figure the
                                     // the UI already reports as "1st port resonance"

    it('changes the system output around the pipe resonance — the toggle is not cosmetic', () => {
      // The collapsed port impedance dumps volume velocity through the duct, so the port air
      // velocity is where the difference is unmistakable; the far-field SPL effect is smaller
      // because the driver dominates the total output that far above the passband.
      // `tlPortModel` only applies to the lossless form (Ql and Qa at the limit) — WinISD's lossy
      // model is always lumped (circuit.ts, BUG_20260927_vented-box-losses-not-winisd-form.md).
      const CONV = { ...VENTED, Ql: 1e6, Qa: 1e6 };
      const lumped = engine.simulation.sweep(DRV, LE_H, 'vented', { ...CONV, tlPortModel: false }).values!;
      const tl     = engine.simulation.sweep(DRV, LE_H, 'vented', { ...CONV, tlPortModel: true  }).values!;
      let worstSpl = 0, worstPv = 0;
      for (let i = 0; i < lumped.fs.length; i++)
        if (lumped.fs[i] > F_PIPE * 0.6 && lumped.fs[i] < F_PIPE * 1.6) {
          worstSpl = Math.max(worstSpl, Math.abs(tl.spl[i] - lumped.spl[i]));
          worstPv  = Math.max(worstPv, tl.pv[i] / Math.max(lumped.pv[i], 1e-12));
        }
      assert.ok(worstPv > 10, `TL port air velocity should exceed the lumped model 10-fold near ` +
        `${F_PIPE.toFixed(0)} Hz, got ${worstPv.toFixed(1)}×`);
      assert.ok(worstSpl > 0.5, `TL and lumped SPL should diverge by more than 0.5 dB near ` +
        `${F_PIPE.toFixed(0)} Hz, got ${worstSpl.toFixed(3)} dB`);
    });

    it('is off by default — an unspecified flag reproduces the lumped model exactly', () => {
      const dflt   = engine.simulation.sweep(DRV, LE_H, 'vented', VENTED).values!;
      const lumped = engine.simulation.sweep(DRV, LE_H, 'vented', { ...VENTED, tlPortModel: false }).values!;
      for (let i = 0; i < dflt.fs.length; i++)
        assert.equal(dflt.spl[i], lumped.spl[i], `spl[${i}] default must equal tlPortModel:false`);
    });
  });

  /**
   * `cTanh` (engine/complex.ts) has a saturation guard: past |2·re| = 40 it returns ±1 directly
   * instead of evaluating sinh/cosh, because sinh/cosh both overflow to Infinity there and
   * Infinity/Infinity is NaN. The only caller is the transmission-line port model
   * (circuit.ts `portImpedance`), reached from `Engine.sweep` with `tlPortModel: true`. A port
   * with a very low Qp (heavily damped line) drives cTanh's argument past the guard at every
   * swept frequency — this proves the guard keeps the sweep finite instead of NaN.
   */
  describe('transmission-line port model — tanh saturation guard', () => {
    const engine = createEngine();
    const DRV = sweepDriver(solveConsistencyGroup({
      Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
      Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
    }));
    const LE_H = 0.70e-3;
    const SP   = Math.PI * (0.05 / 2) ** 2;
    const LEFF = 0.30 + 0.732 * 0.05;
    // Qp far below any realistic port loss (typically ~10-100) — chosen only to push
    // k·Leff/Qp past the guard's threshold at every frequency in the sweep, not as a
    // physically meaningful port.
    // `tlPortModel` is a lossless-form-only option (WinISD's lossy model is always lumped —
    // circuit.ts, BUG_20260927_vented-box-losses-not-winisd-form.md) — this test is about the TL
    // model itself, so it must ask for the branch that has one.
    const HEAVILY_DAMPED: SweepParams = {
      Vb: 0.030, eg: 2.83, Sp: SP, Leff: LEFF, Qp: 0.001, tlPortModel: true,
      Ql: 1e6, Qa: 1e6, fmin: 10, fmax: 1000, N: 20,
    };

    it('stays finite across the whole sweep once the line is heavily damped enough to saturate tanh', () => {
      const sw = engine.simulation.sweep(DRV, LE_H, 'vented', HEAVILY_DAMPED).values!;
      assert.ok(sw, 'a heavily-damped TL port must still produce a sweep');
      for (let i = 0; i < sw.fs.length; i++) {
        assert.ok(Number.isFinite(sw.zmag[i]), `zmag[${i}] must be finite at ${sw.fs[i]} Hz`);
        assert.ok(Number.isFinite(sw.zph[i]),  `zph[${i}] must be finite at ${sw.fs[i]} Hz`);
        assert.ok(Number.isFinite(sw.spl[i]),  `spl[${i}] must be finite at ${sw.fs[i]} Hz`);
        assert.ok(Number.isFinite(sw.pv[i]),   `pv[${i}] must be finite at ${sw.fs[i]} Hz`);
      }
    });
  });
});
