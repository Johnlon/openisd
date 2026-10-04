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

describe('rolloffFreq', () => {
  /**
   * Architecture & Encapsulation Contract:
   * The cutoff frequency derivation (rolloffFreq) must reside 100% inside the engine, completely
   * decoupled from UI presentation code. UI components and series builders consume pre-calculated
   * engine data directly.
   *
   * Specification: docs/spec/SPEC_ENGINE.md §3.2
   */
  describe('rolloffFreq — Encapsulated Engine Physics Calculations', () => {
    const P: SweepParams = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 2.83, fmin: 10, fmax: 1000, N: 100 };

    /**
     * Spec Link: docs/spec/SPEC_ENGINE.md §3.2 "Cutoff Frequency Readouts (F3, F6, F10)"
     */
    it('rolloffFreq derives F3 (-3 dB), F6 (-6 dB), and F10 (-10 dB) cutoff frequencies inside engine', () => {
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, P).values!;
      const f3 = engine.simulation.rolloffFreq(sw, 3);
      const f6 = engine.simulation.rolloffFreq(sw, 6);
      const f10 = engine.simulation.rolloffFreq(sw, 10);

      assert.ok(f3 !== null && f3 > 0, 'F3 (-3 dB) cutoff frequency is derived');
      assert.ok(f6 !== null && f6 > 0, 'F6 (-6 dB) cutoff frequency is derived');
      assert.ok(f10 !== null && f10 > 0, 'F10 (-10 dB) cutoff frequency is derived');
      assert.ok(f10 < f6 && f6 < f3, 'F10 < F6 < F3 frequency ordering holds for highpass roll-off');
    });

    it('returns null when no frequency ever reaches within dropDb of the passband reference (an all-silent sweep)', () => {
      // eg=0 → spl is -200 dB everywhere, so passbandRef falls back to its own 0 dB sentinel and
      // even a 3 dB drop is never satisfied by -200 >= 0 - 3.
      const sw = engine.simulation.sweep(sweepDriver(DRV), LE_H, BOX, { ...P, eg: 0 }).values!;
      assert.equal(engine.simulation.rolloffFreq(sw, 3), null, 'an all-silent sweep has no rolloff frequency to report');
    });
  });
});
