import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.7e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// Sealed box — lossless, 30 L
const BOX = 'sealed';

const VB_M3 = 0.030;

const QL_LOSSLESS = 1e6;

// 2.83 V — IEC 60268-5 sensitivity reference
const EG_STANDARD = 2.83;

describe('maxCurves', () => {
  describe('maxCurves — one limit absent falls back to the other (never poisons the curve)', () => {
    it('driver without Pe → curve is Xmax-limited and finite (no thermal limit, no fabricated default)', () => {
      // Pe absent → vPe = Infinity; the excursion (Xmax) limit alone bounds the curve.
      const drvNoPe = solveConsistencyGroup({
        Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
        Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.005,
      });

      const { fs, maxspl } = engine.simulation.maxCurves(sweepDriver(drvNoPe), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
      }).values!;

      assert(fs.length > 0, 'maxCurves must return non-empty fs array');
      assert(maxspl.every(v => isFinite(v)),
        'every maxspl value must be finite when Pe is absent (Xmax-limited)');

      // Physically plausible passband range.
      const passband = maxspl.find((_, i) => fs[i] > 200);  // well above Fs=37
      assert(passband !== undefined && passband > 60 && passband < 160,
        `passband maxspl must be in [60, 160] dB, got ${passband} dB`);
    });

    it('driver with Xmax=0 but Pe present → curve is Pe-limited and finite, not -Infinity', () => {
      // Regression: Xmax=0 used to make vXmax=0 → vUse=0 → maxspl=-Infinity, maxpwr=0
      // (blank Max-SPL/Max-power charts). Xmax=0 must be treated as "no excursion limit"
      // so the Pe (thermal) limit alone bounds the curve.
      const drvXmax0 = solveConsistencyGroup({
        Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
        Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Pe_W: 60, Xmax_m: 0,
      });

      const { maxspl, maxpwr } = engine.simulation.maxCurves(sweepDriver(drvXmax0), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
      }).values!;

      assert(maxspl.every(Number.isFinite),
        'Xmax=0 must not poison Max-SPL with -Infinity — Pe limit must apply');
      assert(maxpwr.every(v => Number.isFinite(v) && v > 0),
        'Max-power must be finite and positive (Pe-limited), not 0');
    });

    it('neither Pe nor Xmax stated → maxspl/maxpwr are genuinely unbounded, reported as a '
     + "driverPrerequisites advisory naming both fields — never as a blocking issue (QO143: "
     + "Infinity here is a correct answer, not a gap)", () => {
      const drvNeither = solveConsistencyGroup({
        Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
        Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6,
      });

      const result = engine.simulation.maxCurves(sweepDriver(drvNeither), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
      });

      assert.equal(result.issues.length, 0, 'unbounded is a valid answer, not a blocking issue');
      assert(result.values!.maxspl.every(v => v === Infinity), 'maxspl is genuinely unbounded');
      assert(result.values!.maxpwr.every(v => v === Infinity), 'maxpwr is genuinely unbounded');
      assert.deepEqual(result.driverPrerequisites, [
        { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] },
        { output: 'maxpwr', missing: ['Pe_W', 'Xmax_m'] },
      ]);
    });

    it('Xmax stated but Pe absent → bounded by Xmax alone, no driverPrerequisites advisory', () => {
      const drvXmaxOnly = solveConsistencyGroup({
        Fs_hz: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
        Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.005,
      });

      const result = engine.simulation.maxCurves(sweepDriver(drvXmaxOnly), LE_H, BOX, {
        Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
      });

      assert.deepEqual(result.driverPrerequisites, []);
    });
  });
});
