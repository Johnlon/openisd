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

// Default parameter values from sweep.js line 53
const DEFAULT_FMIN_HZ = 10;

const DEFAULT_FMAX_HZ = 1000;

const DEFAULT_N = 400;       // number of frequency steps → N+1 = 401 points

// 2.83 V — IEC 60268-5 sensitivity reference
const EG_STANDARD = 2.83;

describe('sweep', () => {
  describe('sweep — parameter defaults when fmin / fmax / N are absent', () => {
    it('uses fmin=10 Hz, fmax=1000 Hz, N=400 when those parameters are not supplied — '
     + 'verifies P.fmin||10, P.fmax||1000, P.N||400 fallbacks', () => {
      // Call sweep without fmin, fmax, or N.  The returned fs array must span 10–1000 Hz
      // with 401 points (steps 0…400 inclusive).
      const { fs } = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD }).values!;

      // N+1 = 401 points
      assert.equal(fs.length, DEFAULT_N + 1,
        `expected ${DEFAULT_N + 1} frequency points (N=${DEFAULT_N} steps + 1), got ${fs.length}`);

      // First frequency must equal fmin exactly (no log-space rounding at i=0)
      assert.equal(fs[0], DEFAULT_FMIN_HZ,
        `first frequency must be fmin=${DEFAULT_FMIN_HZ} Hz, got ${fs[0]}`);

      // Last frequency must equal fmax exactly (at i=N: f0*(f1/f0)^1 = f1)
      assert.equal(fs[fs.length - 1], DEFAULT_FMAX_HZ,
        `last frequency must be fmax=${DEFAULT_FMAX_HZ} Hz, got ${fs[fs.length - 1]}`);
    });
  });

  describe('sweep — zero-excitation (eg=0) produces -200 dB SPL for all frequencies', () => {
    it('when eg=0 there is no acoustic output; spl fallback (-200 dB) applies at every point', () => {
      // With eg=0: pg = cx(0·Bl, 0) = cx(0,0) → UD = 0 → U0 = 0 → pm = |Hc| = 0.
      // The guard `pm > 0 ? 20·log10(pm/P0) : -200` takes the -200 branch.
      const SPL_SILENCE_DB = -200;  // sentinel value for zero-excitation, defined in sweep.js
      const { spl } = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0 }).values!;
      assert(spl.length > 0, 'spl array must be non-empty');
      for (let i = 0; i < spl.length; i++) {
        assert.equal(spl[i], SPL_SILENCE_DB,
          `spl[${i}] must be ${SPL_SILENCE_DB} dB with eg=0, got ${spl[i]}`);
      }
    });
  });

  /**
   * BUG_20260927_spl-maps-nan-to-silence: `pm > 0 ? … : -200` sent NaN pressure down the
   * same branch as |p| = 0, so a genuinely broken sweep drew as silence instead of reaching
   * `classifyFinite`. The guard must distinguish "exactly zero" (a real silence sentinel) from
   * "not a number" (a breakdown that must be reported) — the fix is `pm === 0`, not `pm > 0`.
   */
  describe('sweep — a NaN pressure is reported, never drawn as -200 dB silence', () => {
    it('eg=NaN poisons the acoustic pressure; spl carries NaN, not the -200 dB sentinel', () => {
      const { spl } = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: NaN }).values!;
      assert.ok(spl.length > 0, 'spl array must be non-empty');
      for (let i = 0; i < spl.length; i++) {
        assert.ok(Number.isNaN(spl[i]), `spl[${i}] must be NaN (not -200) when the drive voltage is NaN, got ${spl[i]}`);
      }
    });

    it('classifyFinite names SPL specifically — before the fix only the OTHER poisoned arrays named it', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: NaN }).values!;
      const issue = engine.simulation.classifyFinite(sw);
      assert.ok(issue, 'a NaN pressure must never pass classifyFinite silently');
      assert.match(issue.message, /SPL/, `classifyFinite's message must name SPL; got: ${issue.message}`);
    });

    it('exact zero pressure (eg=0) is unaffected by the NaN fix — still the -200 dB sentinel', () => {
      const { spl } = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0 }).values!;
      assert.ok(spl.every(v => v === -200), 'pm === 0 exactly must still take the -200 dB branch');
    });
  });

  /**
   * Same guard, same bug, on the filter chain's own magnitude (sweep.ts fltMag). A staticGain
   * filter with gain=NaN poisons Hf uniformly, so fltAbs is NaN at every grid point.
   */
  describe('fltMag — a NaN filter-chain magnitude is reported, never drawn as -200 dB silence', () => {
    it('a NaN filter gain poisons |H|; fltMag carries NaN, not the -200 dB sentinel', () => {
      const P: SweepParams = {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 2,
        filters: [{ type: 'staticGain', enabled: true, gain: NaN }],
      };
      const { fltMag } = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      for (let i = 0; i < fltMag.length; i++) {
        assert.ok(Number.isNaN(fltMag[i]), `fltMag[${i}] must be NaN, got ${fltMag[i]}`);
      }
    });
    // The exact-|H|=0 counterpart lives in the "fltMag — an exact spectral null" describe
    // block below (a staticGain fixture — see BUG_20260927_peaking-cut-notch-nan for why the
    // peaking filter's own cut branch cannot stand in for "exact zero").
  });

  describe('sweep — fmin=fmax: every sample is the group delay at that one frequency', () => {
    it('a sweep collapsed onto 100 Hz reports the same, non-zero group delay as a normal sweep does at 100 Hz', () => {
      const FREQ_HZ = 100;
      const collapsed = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: FREQ_HZ, fmax: FREQ_HZ, N: 5,
      }).values!;
      const single = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: FREQ_HZ, fmax: FREQ_HZ * 1.5, N: 1,
      }).values!;
      assert.ok(single.gd[0] > 0, `group delay at ${FREQ_HZ} Hz must be positive, got ${single.gd[0]}`);
      for (let i = 0; i < collapsed.gd.length; i++) {
        assert.equal(collapsed.gd[i], single.gd[0], `gd[${i}] must be the group delay at ${FREQ_HZ} Hz`);
      }
    });
  });

  describe('sweep circuit diagnostics', () => {
    it('reports one missing-dependencies issue per missing circuit quantity, each naming exactly '
     + 'that field — never a combined message or a cross-field substitution suggestion', () => {
      const result = engine.simulation.sweep(sweepDriver({ Fs_hz: 111111 }), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
      });

      assert.equal(result.values, null);
      const targets = result.issues.map(i => i.kind === 'missing-dependencies' ? i.target : null).sort();
      assert.deepEqual(targets, [
        'BL_terminal_Tm', 'Cms_m_per_N', 'Mms_kg', 'Re_terminal_ohm', 'Rms_kg_per_s', 'Sd_m2',
      ].sort());
      for (const issue of result.issues) {
        assert.equal(issue.kind, 'missing-dependencies');
        if (issue.kind !== 'missing-dependencies') continue;
        assert.equal(issue.routes.length, 1, `${issue.target} must name exactly one route — itself`);
        assert.deepEqual(issue.routes[0].missing, [issue.target]);
      }
    });

    it('maxCurves() passes through the same null values and issues as sweep() when the circuit is missing fields', () => {
      const swept = engine.simulation.sweep(sweepDriver({ Fs_hz: 111111 }), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
      });
      const mx = engine.simulation.maxCurves(sweepDriver({ Fs_hz: 111111 }), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
      });
      assert.equal(mx.values, null);
      assert.deepEqual(mx.issues, swept.issues);
      assert.deepEqual(mx.driverPrerequisites, []);
    });
  });

  /**
   * The transfer function's 0 dB is the lossless circuit's high-frequency asymptote
   * (BUG_20260926_winisd-tf-reference), so a driver with no Fs/Vas/Qes still has one.
   */
  describe('tfMag — 0 dB is the lossless circuit\'s high-frequency asymptote', () => {
    it('a lossless sealed sweep without Le approaches 0 dB at 20 kHz', () => {
      const circuitOnly = sweepDriver({
        Sd_m2: 0.0133, Re_terminal_ohm: 5.6, BL_terminal_Tm: 7.0,
        Cms_m_per_N: 0.0008, Mms_kg: 0.012, Rms_kg_per_s: 1.5,
        Xmax_m: 0.005, Pe_W: 60,
      });
      const sw = engine.simulation.sweep(circuitOnly, undefined, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 20000, N: 50 }).values!;
      assert.ok(Math.abs(sw.tfMag[sw.tfMag.length - 1]) < 1e-3, `tfMag at 20 kHz is ${sw.tfMag[sw.tfMag.length - 1]} dB`);
    });
  });

  /**
   * fltMag (sweep.ts L265) — the filter chain's own dB magnitude, with the same -200 dB silence
   * sentinel as spl for the pathological |H|=0 case: a peaking EQ with gain -> -Infinity becomes
   * a true notch (its zero sits exactly on the real axis at its own centre frequency), and when
   * that centre frequency lands exactly on a sweep grid point, |H| is exactly 0, not merely small.
   */
  describe('fltMag — an exact spectral null lands the -200 dB silence sentinel, not a huge negative number', () => {
    it('a static-gain filter at -Infinity dB (|H|=0 exactly) reads -200 dB at every frequency', () => {
      // staticGain: V = 10^(gain/20) = 10^(-Infinity/20) = 0 exactly → Hf = cx(0,0), a genuine
      // |H| = 0, not a NaN dressed up as one (see BUG_20260927_peaking-cut-notch-nan: a peaking
      // filter's cut branch at gain=-Infinity computes 0·Infinity inside cDiv and lands on NaN,
      // not 0 — that filter can no longer stand in for "exact zero" once the sentinel guard
      // distinguishes NaN from zero, BUG_20260927_spl-maps-nan-to-silence).
      const P: SweepParams = {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 2,
        filters: [{ type: 'staticGain', enabled: true, gain: -Infinity }],
      };
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      assert.ok(sw.fltMag.every(v => v === -200), 'an exact |H|=0 must read the -200 dB silence sentinel at every point');
    });
  });

  /**
   * withAddedMass (solver.ts) returns the driver unchanged when `driverAddedMass > 0` but the
   * driver is missing one of the five fields the mass-shift needs (Mms/Cms/Rms/Re/Bl) — it must
   * not derive or invent the missing field just because a shift was requested.
   */
  describe('sweep — driverAddedMass > 0 on a driver missing a mass-shift input leaves the driver unchanged', () => {
    it('a driver missing Cms_m_per_N still reports Cms_m_per_N missing, not a mass-shifted circuit', () => {
      const partial = sweepDriver({ Fs_hz: 37, Re_ohm: 5.6, BL_Tm: 6, Mms_kg: 0.012, Rms_kg_per_s: 1.2 });
      const result = engine.simulation.sweep(partial, LE_H, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, driverAddedMass: 0.01 });
      assert.equal(result.values, null, 'the circuit cannot be built without Cms_m_per_N');
      assert.ok(
        result.issues.some(i => i.kind === 'missing-dependencies' && i.target === 'Cms_m_per_N'),
        'withAddedMass must leave the driver unchanged (never derive Cms) when a mass-shift input is absent',
      );
    });
  });
});
