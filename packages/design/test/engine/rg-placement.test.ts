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

describe('Rg placement', () => {
  describe("Rg placement — 'Rg is at driver side' (WinISD Advanced)", () => {
    const base = (over: Partial<SweepParams>): SweepParams =>
      ({ Vb: 0.030, eg: 2.83, Rs: 1.0, fmin: 20, fmax: 200, N: 16, ...over });

    it('leaves SPL unchanged for a single driver — one Rg in series is one Rg in series', () => {
      const atDriver = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: true })).values!;
      const atAmp    = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: false })).values!;
      for (let i = 0; i < atDriver.fs.length; i++)
        assert.equal(atDriver.spl[i], atAmp.spl[i], `spl[${i}] must be bit-identical at nDrivers=1`);
    });

    // Regression for bugs/archive/BUG_20260926*.md
    it('impedance includes Rg only at the driver side: driver-side Z = amp-side Z + Rg', () => {
      // WinISD 0.7.0.950, debugger capture over 2086 points: with "Rg is at driver side" off, Rg
      // does not appear in the impedance; with it on, Z = Z(off) + Rg exactly, as a complex sum.
      const atDriver = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: true })).values!;
      const atAmp    = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: false })).values!;
      const Rg = 1.0;
      for (let i = 0; i < atDriver.fs.length; i++) {
        const ph = atAmp.zph[i] * Math.PI / 180;
        const re = atAmp.zmag[i] * Math.cos(ph) + Rg, im = atAmp.zmag[i] * Math.sin(ph);
        assert.ok(Math.abs(Math.hypot(re, im) - atDriver.zmag[i]) < 1e-9,
          `at ${atDriver.fs[i].toFixed(1)} Hz: amp-side |Z|+Rg ${Math.hypot(re, im)} vs driver-side ${atDriver.zmag[i]}`);
      }
    });

    it('two drivers: the per-driver impedance bug switch moves the impedance only, never the SPL (John, 2026-10-05)', () => {
      // WinISD simulates each of N drivers alone in Vb/N fed P/N; OpenISD keeps that for SPL,
      // excursion, VA and maximum power. Only the impedance chart differs: the array the amplifier
      // drives (unticked) or one driver's (WinISD's bug, ticked).
      for (const rgAtDriverSide of [true, false]) {
        const P = { nDrivers: 2, wiring: 'parallel' as const, rgAtDriverSide };
        const fixed = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ ...P, winisdDriverCountModel: false })).values!;
        const bug   = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ ...P, winisdDriverCountModel: true })).values!;
        for (let i = 0; i < fixed.fs.length; i++) {
          assert.equal(fixed.spl[i], bug.spl[i], `spl[${i}]`);
          assert.ok(Math.abs(fixed.zmag[i] - bug.zmag[i] / 2) < 1e-12, `zmag[${i}]`);
        }
      }
    });

    it('defaults to the driver side when unspecified (backward compatible)', () => {
      const dflt    = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 2 })).values!;
      const explicit = engine.simulation.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 2, rgAtDriverSide: true })).values!;
      for (let i = 0; i < dflt.fs.length; i++)
        assert.equal(dflt.spl[i], explicit.spl[i], `spl[${i}] default must equal rgAtDriverSide:true`);
    });
  });
});
