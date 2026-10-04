import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
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

// 3 dB/oct: rolloff slope tolerance. The 24 dB/oct theoretical slope is for an ideal
// system; discrete frequency sampling and finite Ql introduce small deviations.
const ROLLOFF_SLOPE_TOLERANCE_DB_OCT = 3;

/** Index of the first frequency >= f in a sweep fs array */
const idxGe = (fs: number[], f: number) => fs.findIndex(x => x >= f);

describe('vented box simulation', () => {
  describe('Vented (bass-reflex) box simulation', () => {

    // Build a vented design tuned to Fb = 30 Hz.  Sp and Leff derived from the
    // Helmholtz formula: Map = rho·Leff/Sp,  Cab = Vb/(rho·c²),  fb = 1/(2pi·sqrt(Map·Cab)).
    // Ref: https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
    const Vb_m3 = 0.020;
    const Fb_Hz  = 30;
    const Sp_m2  = Math.PI * 0.025 ** 2; // pi·r² for a 50 mm diameter port
    const Cab    = Vb_m3 / (refRho() * refC() * refC());
    const wb     = 2 * Math.PI * Fb_Hz;
    const Map    = 1 / (wb * wb * Cab); // acoustic mass for Fb
    const Leff   = Map * Sp_m2 / refRho();  // effective duct length (including end correction)
    const d = solveConsistencyGroup(REF_DRIVER);
    const { fs, spl, zmag } = engine.simulation.sweep(sweepDriver(d), LE_H, 'vented', {
      Vb: Vb_m3, Ql: 7, Sp: Sp_m2, Leff, Fb: Fb_Hz, eg: 2.83, fmin: 10, fmax: 1000, N: 300,
    }).values!;

    it('rolls off at approximately 24 dB/octave below tuning — the 4th-order Butterworth slope', () => {
      // Theory: below Fb, a vented box is a 4th-order high-pass with 24 dB/oct rolloff.
      // We measure the slope between 12 and 15 Hz (well below Fb = 30 Hz).
      // Ref: Thiele, A.N. "Loudspeakers in Vented Boxes, Part I." JAES 19(5) 1971.
      //   https://aes.org/e-lib/browse.cfm?elib=1967
      const f1 = 12, f2 = 15; // Hz — two points well below Fb
      const slope = (spl[idxGe(fs, f2)] - spl[idxGe(fs, f1)]) / Math.log2(f2 / f1);
      assert.ok(Math.abs(slope - 24) < ROLLOFF_SLOPE_TOLERANCE_DB_OCT,
        `rolloff slope ${slope.toFixed(1)} dB/oct — expected 24 ±${ROLLOFF_SLOPE_TOLERANCE_DB_OCT} dB/oct`);
    });

    it('shows exactly two impedance peaks straddling the box tuning frequency Fb', () => {
      // At resonance the vented box splits the single sealed-box peak into two peaks —
      // one below and one above Fb.  This is the acoustic signature of a tuned reflex cabinet.
      // Ref: Small, R.H. "Vented-Box Loudspeaker Systems — Part I." JAES 21(5) 1973.
      //   https://aes.org/e-lib/browse.cfm?elib=2149
      const Re = d.Re_ohm!; // driver DC resistance — peaks must be well above this
      const peaks = [];
      for (let i = 1; i < zmag.length - 1; i++) {
        if (zmag[i] > zmag[i - 1] && zmag[i] > zmag[i + 1] && zmag[i] > Re * 1.5) {
          peaks.push(+fs[i].toFixed(1));
        }
      }
      assert.equal(peaks.length, 2,
        `expected 2 impedance peaks, found ${peaks.length}: ${JSON.stringify(peaks)}`);
      assert.ok(peaks[0] < Fb_Hz,
        `lower peak ${peaks[0]} Hz should be below Fb (${Fb_Hz} Hz)`);
      assert.ok(peaks[1] > Fb_Hz,
        `upper peak ${peaks[1]} Hz should be above Fb (${Fb_Hz} Hz)`);
    });

  });
});
