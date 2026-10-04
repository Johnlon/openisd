import type {TestSolverQuantities} from './testSolver.js';
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

// No environment reaches these test's own reimplementation of the formula under test, so ρ/c
// are computed live at the reference environment — matching production (no stored constant).
const refRho = (): number => engine.environment.solve({}).values.rho;

const refC = (): number => engine.environment.solve({}).values.c;

// ---------------------------------------------------------------------------
// Reference test driver — a synthetic 6.5" mid-woofer, 8 Ω nominal.
// Values chosen to be representative of a real driver without depending on
// any specific commercial product.  All parameters are in SI units.
// ---------------------------------------------------------------------------
const REF_DRIVER: TestSolverQuantities = {
  Fs_hz:   37,      // Hz  — free-air resonance
  Qts:  0.38,    // —   — total Q at Fs
  Qes:  0.40,    // —   — electrical Q at Fs
  Qms:  7.0,     // —   — mechanical Q at Fs
  Vas_m3:  0.030,   // m³  — equivalent compliance volume (= 30 L)
  Sd_m2:   0.0133,  // m²  — effective piston area (~130 cm²)
  Re_ohm:   5.6,     // Ω   — voice-coil DC resistance
  Le_H:   0.7e-3,  // H   — voice-coil inductance
  Xmax_m: 0.005,   // m   — maximum linear one-way excursion (= 5 mm)
  Pe_W:   60,      // W   — rated power
  Znom_ohm:    8,       // Ω   — nominal impedance
};

// 0.5 Hz: tuning frequency tolerance for auto-mass calculations.
const TUNING_FREQ_TOLERANCE_HZ = 0.5;

// 1e-9: floating-point round-trip tolerance (effectively exact).
const ROUNDTRIP_TOLERANCE = 1e-9;

describe('passive radiator simulation', () => {
  describe('Passive radiator box simulation', () => {

    // Fr is the box's own tuning (winisd-lossy's Ral/Raa, BUG_20260927_passive-radiator-losses-
    // not-winisd-form.md) — computed by the same `prTuning` formula the test below already used
    // for Fp, or an absent Fr poisons Ral/Raa with NaN and every chart collapses to the -200 dB
    // silence sentinel.
    const PR_BOX = {Vb: 0.02, prMmd: 0.010, prMadd: 0.020, prSd: 0.0133, prCms: 0.0008, prNum: 1};
    const PR_PARAMS: SweepParams = {
      ...PR_BOX,
      Ql:     7,      // —  — box leakage Q (same as vented default)
      eg:     2.83,   // V  — IEC 60268-5 reference voltage
      prRms:  1.0,    // kg/s — PR mechanical damping
      prXmax: 0.012,  // m  — PR linear excursion limit (12 mm)
      fmin: 10, fmax: 1000, N: 300,
      Fr: engine.pr.tuning(PR_BOX, engine.environment.solve({}).values),
    };
    const d = solveConsistencyGroup(REF_DRIVER);
    const sw = engine.simulation.sweep(sweepDriver(d), LE_H, 'box-passive-radiator', PR_PARAMS).values!;

    it('produces a non-zero excursion curve for the PR cone alongside the main driver curve', () => {
      // The PR is acoustically coupled to the box; at resonance it moves significantly.
      assert.equal(sw.excPR.length, sw.fs.length,
        'PR excursion array length should match frequency array length');
      assert.ok(Math.max(...sw.excPR) > 0,
        'PR peak excursion should be positive (PR is moving)');
    });

    it('the theoretical Fp (from prTuning formula) sits between the two impedance peaks', () => {
      // Like a vented box, the PR system shows two impedance peaks straddling the tuning freq Fp.
      // Ref: Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
      //   https://aes.org/e-lib/browse.cfm?elib=2223
      const Re = d.Re_ohm!;
      const peaks = [];
      for (let i = 1; i < sw.zmag.length - 1; i++) {
        if (sw.zmag[i] > sw.zmag[i - 1] && sw.zmag[i] > sw.zmag[i + 1] && sw.zmag[i] > Re * 1.5) {
          peaks.push(sw.fs[i]);
        }
      }
      const Fp = engine.pr.tuning(PR_BOX, engine.environment.solve({}).values);
      assert.equal(peaks.length, 2,
        `expected 2 impedance peaks, found ${peaks.length}`);
      assert.ok(Fp > peaks[0] && Fp < peaks[1],
        `Fp ${Fp.toFixed(1)} Hz should sit between peaks ${peaks[0].toFixed(1)} and ${peaks[1].toFixed(1)} Hz`);
    });

    it('auto-tune computes added mass that achieves the target Fp to within 0.5 Hz', () => {
      // engine.pr.massForFp() inverts the Fp formula.  We verify the inversion is accurate.
      const TARGET_FP_HZ = 42; // Hz — a typical low bass tuning
      const totalMass    = engine.pr.massForFp(PR_BOX, TARGET_FP_HZ, engine.environment.solve({}).values);
      const addedMass    = totalMass - PR_BOX.prMmd;
      const achievedFp   = engine.pr.tuning({ ...PR_BOX, prMadd: addedMass }, engine.environment.solve({}).values);
      assert.ok(Math.abs(achievedFp - TARGET_FP_HZ) < TUNING_FREQ_TOLERANCE_HZ,
        `target ${TARGET_FP_HZ} Hz → added ${(addedMass * 1000).toFixed(1)} g → Fp ${achievedFp.toFixed(2)} Hz ` +
        `(limit ±${TUNING_FREQ_TOLERANCE_HZ} Hz)`);
    });

  });

  describe('Passive radiator — WinISD <-> T/S parameter round-trip', () => {

    // WinISD lets users enter PR parameters as (Fs, Qms, Vas) — the same format
    // as a driver.  Internally these map to (Mms, Cms, Rms) via standard T/S relations.
    // The UI must convert in both directions without drift.
    // Ref: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters

    const EXAMPLE_PR = {
      Fs_Hz:  25,     // Hz — free-air resonance of the PR
      Qms:    7,      // —  — mechanical Q
      Vas_L:  18,     // L  — equivalent compliance volume
      Sd_m2:  0.0133, // m² — piston area
    };

    it('WinISD Fs/Qms/Vas converts to Mms/Cms/Rms and back to the exact same Fs/Qms/Vas', () => {
      // Forward: Cms = Vas/(Sd²·rho·c²),  Mms = 1/(ws²·Cms),  Rms = sqrt(Mms/Cms)/Qms
      const Cms   = (EXAMPLE_PR.Vas_L / 1000) / (EXAMPLE_PR.Sd_m2 ** 2 * refRho() * refC() * refC());
      const Mms   = 1 / ((2 * Math.PI * EXAMPLE_PR.Fs_Hz) ** 2 * Cms);
      const Rms   = Math.sqrt(Mms / Cms) / EXAMPLE_PR.Qms;
      // Inverse: Fs = 1/(2pi·sqrt(Mms·Cms)),  Qms = sqrt(Mms/Cms)/Rms,  Vas = Cms·Sd²·rho·c²·1000
      const Fs_rt  = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));
      const Qms_rt = Math.sqrt(Mms / Cms) / Rms;
      const Vas_rt = Cms * EXAMPLE_PR.Sd_m2 ** 2 * refRho() * refC() * refC() * 1000;

      assert.ok(Math.abs(Fs_rt  - EXAMPLE_PR.Fs_Hz) < ROUNDTRIP_TOLERANCE,
        `Fs: ${EXAMPLE_PR.Fs_Hz} Hz → Mms/Cms/Rms → ${Fs_rt.toFixed(9)} Hz`);
      assert.ok(Math.abs(Qms_rt - EXAMPLE_PR.Qms)   < ROUNDTRIP_TOLERANCE,
        `Qms: ${EXAMPLE_PR.Qms} → T/S → ${Qms_rt.toFixed(9)}`);
      assert.ok(Math.abs(Vas_rt - EXAMPLE_PR.Vas_L)  < ROUNDTRIP_TOLERANCE,
        `Vas: ${EXAMPLE_PR.Vas_L} L → T/S → ${Vas_rt.toFixed(9)} L`);
    });

  });
});
