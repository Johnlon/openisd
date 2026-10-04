import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

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

// 1e-9: floating-point result that should be analytically exact.
const EXACT = 1e-9;

describe('EBP', () => {
  describe('Efficiency Bandwidth Product (EBP = Fs / Qes)', () => {

    it('calculates EBP = Fs / Qes for a typical vented-candidate driver', () => {
      // EBP = Fs / Qes is a quick screen:
      //   EBP < 50  → sealed preferred
      //   EBP > 100 → vented preferred
      //   50–100    → either works
      // Ref: [Wiki-TS]
      // For our test driver: Fs=37 Hz, Qes=0.40 → EBP = 92.5
      const EXPECTED_EBP = 37 / 0.40; // = 92.5
      assert.ok(Math.abs(engine.driver.ebp(DRIVER.Fs, DRIVER.Qes) - EXPECTED_EBP) < EXACT,
        `EBP should be Fs/Qes = ${EXPECTED_EBP}, got ${engine.driver.ebp(DRIVER.Fs, DRIVER.Qes)}`);
    });

    it('a driver with EBP = 37/0.40 = 92.5 sits in the borderline zone (50 < EBP < 100)', () => {
      // This is a sanity check that the result is physically meaningful.
      const result = engine.driver.ebp(DRIVER.Fs, DRIVER.Qes);
      assert.ok(result > 50 && result < 100,
        `EBP ${result.toFixed(1)} should be in the 50–100 borderline zone for this driver`);
    });

    it('a woofer with very low Qes (high Bl) has a high EBP — strongly vented-preferred', () => {
      // Very high Bl → very low Qes → very high EBP → strong vented preference.
      const highBlDriver = { ...DRIVER, Qes: 0.10 }; // Qes=0.10 is very high Bl
      const result = engine.driver.ebp(highBlDriver.Fs, highBlDriver.Qes);
      assert.ok(result > 100,
        `High-Bl driver EBP ${result.toFixed(1)} should exceed 100 (vented preferred)`);
    });

  });
});
