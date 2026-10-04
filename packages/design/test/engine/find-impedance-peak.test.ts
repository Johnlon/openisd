import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {SweepParams} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import type {TestSolverQuantities} from './testSolver.js';
import {sweepDriver} from './testSolver.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = undefined;

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// ---------------------------------------------------------------------------
// Test driver: a typical 6.5" mid-woofer — same parameters used throughout
// the test suite so results are comparable.  All SI units.
// ---------------------------------------------------------------------------
const DRIVER = {
  Fs:  37,     // Hz
  Qts: 0.38,   // —
  Qes: 0.40,   // —
  Qms: 7.0,    // —
  Vas: 0.030,  // m³  (30 L)
  Sd:  0.0133, // m²
  Re:  5.6,    // Ω
};

describe('findImpedancePeak', () => {
  describe('Lossy sealed box resonance and Q from sweep (findImpedancePeak)', () => {
    it('calculates lossy Fsc and Qtc from the impedance curve peak', () => {
      // Stated in full, so no relation has to run — but the TERMINAL Re and BL still have to be
      // derived beside the stated per-coil values, because that pair is what `sweep` reads. One
      // coil here, so terminal equals per-coil.
      const drv: TestSolverQuantities = {
        Fs_hz: 40,
        Vas_m3: 0.010,
        Qts: 0.4,
        Qes: 0.444,
        Qms: 4.0,
        Re_ohm: 6.0,
        Sd_m2: 0.010,
        Mms_kg: 0.026,
        Cms_m_per_N: 0.0006,
        Rms_kg_per_s: 1.5,
        BL_Tm: 10.0,
        Pe_W: 100,
        Re_terminal_ohm: engine.driver.terminalRe_ohm(6.0, 1, undefined),
        BL_terminal_Tm: engine.driver.terminalBL_Tm(10.0, 1, undefined),
      };
      const P: SweepParams = {
        Vb: 0.010,
        Ql: 10,
        Qa: 100,
        Qp: 100,
        eg: 2.83,
        Rs: 0,
        wiring: 'parallel' as const,
        nDrivers: 1,
        fmin: 10,
        fmax: 200,
        N: 2000,
      };
      const result = engine.simulation.sweep(sweepDriver(drv), LE_H, 'sealed', P).values!;
      const peak = engine.driver.findImpedancePeak(result, drv.Re_ohm!);
      assert.ok(peak !== null);
      // Assert peak frequency is near 54.81 Hz
      assert.ok(Math.abs(peak.Fsc - 54.81) < 0.1, `Expected Fsc near 54.81 Hz, got ${peak.Fsc}`);
      // Assert Qtc is near 0.481
      assert.ok(Math.abs(peak.Qtc - 0.481) < 0.01, `Expected Qtc near 0.481, got ${peak.Qtc}`);
    });

    it('returns null when there is no sweep result to search', () => {
      assert.equal(engine.driver.findImpedancePeak(null, DRIVER.Re), null);
    });

    it('returns null when the sweep never rises above Re — no resonance peak to find', () => {
      const drv: TestSolverQuantities = {
        Fs_hz: 40,
        Vas_m3: 0.010,
        Qts: 0.4,
        Qes: 0.444,
        Qms: 4.0,
        Re_ohm: 6.0,
        Sd_m2: 0.010,
        Mms_kg: 0.026,
        Cms_m_per_N: 0.0006,
        Rms_kg_per_s: 1.5,
        BL_Tm: 10.0,
        Pe_W: 100,
        Re_terminal_ohm: engine.driver.terminalRe_ohm(6.0, 1, undefined),
        BL_terminal_Tm: engine.driver.terminalBL_Tm(10.0, 1, undefined),
      };
      const result = engine.simulation.sweep(sweepDriver(drv), LE_H, 'sealed', {
        Vb: 0.010, Ql: 10, Qa: 100, Qp: 100, eg: 2.83, Rs: 0,
        wiring: 'parallel' as const, nDrivers: 1, fmin: 10, fmax: 200, N: 200,
      }).values!;
      // Every real impedance sample sits above 0 Ω — a Re past the actual peak means the sweep
      // "never rises above Re", so there is no resonance bump for this function to characterise.
      const hugeRe = Math.max(...result.zmag) + 1;
      assert.equal(engine.driver.findImpedancePeak(result, hugeRe), null,
        'when nothing in the sweep exceeds Re there is no peak to report');
    });

    it('reports Qtc=0 when the resonance sits at the very edge of the sweep (half-power point unreachable below it)', () => {
      // The half-power search below the peak walks from the peak index down to index 0. Put the
      // peak AT index 0: the search only ever looks at the peak sample itself (which is above the
      // half-power target by construction), never finds a point at or below it, and gives up
      // (f1 stays -1) — exactly the same "no bandwidth to measure" case the code already reports
      // as Qtc=0 when the sweep is too coarse to bracket the resonance.
      const drv: TestSolverQuantities = {
        Fs_hz: 40,
        Vas_m3: 0.010,
        Qts: 0.4,
        Qes: 0.444,
        Qms: 4.0,
        Re_ohm: 6.0,
        Sd_m2: 0.010,
        Mms_kg: 0.026,
        Cms_m_per_N: 0.0006,
        Rms_kg_per_s: 1.5,
        BL_Tm: 10.0,
        Pe_W: 100,
        Re_terminal_ohm: engine.driver.terminalRe_ohm(6.0, 1, undefined),
        BL_terminal_Tm: engine.driver.terminalBL_Tm(10.0, 1, undefined),
      };
      const result = engine.simulation.sweep(sweepDriver(drv), LE_H, 'sealed', {
        Vb: 0.010, Ql: 10, Qa: 100, Qp: 100, eg: 2.83, Rs: 0,
        wiring: 'parallel' as const, nDrivers: 1, fmin: 10, fmax: 200, N: 200,
      }).values!;
      // Force the peak to be the curve's first sample by making it artificially the largest.
      const rigged = { ...result, zmag: [...result.zmag] };
      rigged.zmag[0] = Math.max(...result.zmag) + 1;
      const peak = engine.driver.findImpedancePeak(rigged, drv.Re_ohm!);
      assert.ok(peak !== null);
      assert.equal(peak.Fsc, rigged.fs[0], 'Fsc must be the frequency of the rigged edge peak');
      assert.equal(peak.Qtc, 0, 'with no half-power point below the peak, Qtc must fall back to 0');
    });
  });
});
