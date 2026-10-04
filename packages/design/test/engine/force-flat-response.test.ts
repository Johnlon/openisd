import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.7e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

const DRV = solveConsistencyGroup({
  Fs_hz:   37,      // Hz
  Qts:  0.38,
  Qes:  0.40,
  Qms:  7.0,
  Vas_m3:  0.030,   // m³
  Sd_m2:   0.0133,  // m²
  Re_ohm:   5.6,     // Ω  // H
  Xmax_m: 0.005,   // m
  Pe_W:   60,      // W
  Znom_ohm:    8,       // Ω
});

// Sealed box — lossless, 30 L
const BOX = 'sealed';

const VB_M3 = 0.030;

const QL_LOSSLESS = 1e6;

// 2.83 V — IEC 60268-5 sensitivity reference
const EG_STANDARD = 2.83;

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

const DRV_B = derive(RAW);

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

describe('force-flat response', () => {
  /**
   * classifyFlatClamp (sweep.ts) — the frequency in its message is formatted with .toFixed(0)
   * at/above 100 Hz and .toFixed(1) below, the same split classifyArrays uses for its own
   * singularity list. advanced-options.test.ts already covers a clamp binding below 100 Hz;
   * this covers the >=100 Hz arm.
   */
  describe('classifyFlatClamp — clamp-bound frequency formatting at/above 100 Hz', () => {
    it('formats a clamp bound at or above 100 Hz with .toFixed(0) (no decimal place)', () => {
      // fmin itself is 100 Hz and a highpass filter at 300 Hz still rolls off heavily there,
      // so the very first (lowest, and only >=100 Hz) point needs far more than the 6 dB clamp.
      const P: SweepParams = {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 100, fmax: 2000, N: 50,
        forceFlatResponse: true, winisdFlatModel: false, flatMaxBoostDb: 6,
        filters: [{ type: 'highpass', family: 'sos', order: 2, enabled: true, fc: 300, Q: Math.SQRT1_2 }],
      };
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      assert.ok(sw.flatClamped !== null && sw.flatClamped >= 100, 'fixture must clamp at/above 100 Hz');
      const issue = engine.simulation.classifyFlatClamp(sw);
      assert.ok(issue, 'a bound clamp must surface an issue');
      assert.match(issue!.message, new RegExp(`below ${sw.flatClamped!.toFixed(0)} Hz`), 'a >=100 Hz clamp frequency must format with no decimal place');
    });
  });

  /**
   * Force-flat response (sweep.ts L296-312) skips silent points ("no gain resurrects silence")
   * — the continue at L300. Reached only when force-flat is on AND some point is the -200 dB
   * sentinel (or already non-finite), which advanced-options.test.ts's fixtures never produce.
   */
  describe('force-flat response — silent (-200 dB) points are never resurrected by the EQ', () => {
    it('an all-silent sweep (eg=0) stays all-silent under forceFlatResponse — no clamp, no gain applied', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0, fmin: 10, fmax: 1000, N: 50, forceFlatResponse: true,
      }).values!;
      assert.ok(sw.spl.every(v => v === -200), 'silence must not be boosted just because force-flat is on');
      assert.equal(sw.flatClamped, null, 'a curve with nothing to flatten never binds the clamp');
    });
  });

  describe('force flat response, conventional capped variant (winisdFlatModel false)', () => {
    const FLAT: SweepParams = { ...VENTED, forceFlatResponse: true, winisdFlatModel: false, flatMaxBoostDb: 60 };

    it('flattens the SPL curve to the passband reference wherever the clamp does not bind', () => {
      const flat = engine.simulation.sweep(DRV_B, LE_H, 'vented', FLAT).values!;
      const ref  = engine.simulation.passbandRef(engine.simulation.sweep(DRV_B, LE_H, 'vented', VENTED).values!.spl);
      for (let i = 0; i < flat.fs.length; i++)
        assert.ok(Math.abs(flat.spl[i] - ref) < 1e-9,
          `at ${flat.fs[i].toFixed(1)} Hz: SPL ${flat.spl[i]} should equal the reference ${ref}`);
    });

    it('charges the EQ boost to the excursion — flattening a rolloff is not free', () => {
      const plain = engine.simulation.sweep(DRV_B, LE_H, 'vented', VENTED).values!;
      const flat  = engine.simulation.sweep(DRV_B, LE_H, 'vented', FLAT).values!;
      let boosted = 0;
      for (let i = 0; i < plain.fs.length; i++) {
        assert.ok(flat.exc[i] >= plain.exc[i] - 1e-12,
          `at ${plain.fs[i].toFixed(1)} Hz: excursion must not fall below the un-EQ'd ${plain.exc[i]}`);
        if (flat.exc[i] > plain.exc[i] * 1.01) boosted++;
      }
      assert.ok(boosted > 0, 'at least one frequency should show a materially higher excursion');
    });

    it('leaves the electrical impedance untouched — the EQ is line-level, upstream of the amp', () => {
      const plain = engine.simulation.sweep(DRV_B, LE_H, 'vented', VENTED).values!;
      const flat  = engine.simulation.sweep(DRV_B, LE_H, 'vented', FLAT).values!;
      for (let i = 0; i < plain.fs.length; i++)
        assert.equal(flat.zmag[i], plain.zmag[i], `zmag[${i}] must be unchanged by a line-level gain`);
    });

    it('clamps the boost and reports the frequency where the clamp binds', () => {
      const clamped = engine.simulation.sweep(DRV_B, LE_H, 'vented', { ...VENTED, forceFlatResponse: true, winisdFlatModel: false, flatMaxBoostDb: 6 }).values!;
      const plain   = engine.simulation.sweep(DRV_B, LE_H, 'vented', VENTED).values!;
      const ref     = engine.simulation.passbandRef(plain.spl);
      for (let i = 0; i < clamped.fs.length; i++)
        assert.ok(clamped.spl[i] <= plain.spl[i] + 6 + 1e-9,
          `at ${clamped.fs[i].toFixed(1)} Hz: boost ${clamped.spl[i] - plain.spl[i]} exceeds the 6 dB clamp`);
      assert.ok(clamped.flatClamped != null, 'the clamp bound, so flatClamped must name a frequency');
      assert.ok(clamped.spl[0] < ref - 1e-9, 'the deep rolloff cannot reach the reference under a 6 dB clamp');
      const issue = engine.simulation.classifyFlatClamp(clamped);
      assert.ok(issue && issue.level === 'warn', 'a bound clamp must surface a warn, never silently');
    });

    it('is off by default — an unspecified flag changes nothing', () => {
      const dflt  = engine.simulation.sweep(DRV_B, LE_H, 'vented', VENTED).values!;
      const plain = engine.simulation.sweep(DRV_B, LE_H, 'vented', { ...VENTED, forceFlatResponse: false }).values!;
      for (let i = 0; i < dflt.fs.length; i++)
        assert.equal(dflt.spl[i], plain.spl[i], `spl[${i}] default must equal forceFlatResponse:false`);
      assert.equal(dflt.flatClamped, null, 'no clamp without the flag');
      assert.equal(engine.simulation.classifyFlatClamp(dflt), null);
    });
  });
});
