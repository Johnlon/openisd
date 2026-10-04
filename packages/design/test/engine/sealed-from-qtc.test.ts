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

describe('sealedFromQtc', () => {
  describe('Sealed box volume for a target system Q (sealedFromQtc)', () => {

    it('exposes the nine WinISD numeric sealed alignment options with exact labels', () => {
      assert.deepEqual(engine.sealed.alignmentOptions(), [
        { value: 0.5, label: '0.500 Critically damped' },
        { value: 0.577, label: '0.577 Max flat delay response' },
        { value: 0.707, label: '0.707 Max flat amplitude response' },
        { value: 0.8, label: '0.800 Equal ripple response' },
        { value: 0.9, label: '0.900 Equal ripple response' },
        { value: 1, label: '1.000 Equal ripple response' },
        { value: 1.1, label: '1.100 Equal ripple response' },
        { value: 1.2, label: '1.200 Equal ripple response' },
        { value: 1.5, label: '1.500 Equal ripple response' },
      ]);
    });

    it('calculates the closest alignment and EBP suitability through Engine', () => {
      const volume = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, 0.707);
      assert.ok(volume !== null);
      assert.equal(engine.sealed.qtcFromVolume(DRIVER.Qts, DRIVER.Vas, volume), 0.707);
      assert.equal(engine.sealed.closestAlignment(0.707).value, 0.707);
      assert.equal(engine.driver.ebpSuitability(engine.driver.ebp(40, 0.45)), 'either');
      assert.equal(engine.driver.ebpSuitability(40), 'sealed');
      assert.equal(engine.driver.ebpSuitability(120), 'vented');
    });

    // Formula: Qtc = Qts·√(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
    // Ref: [S72a], [Wiki-TS]

    it('the Butterworth alignment (Qtc = 0.707 = 1/√2) gives the maximally-flat sealed box volume', () => {
      // For our driver: Qts=0.38, Vas=30 L
      //   Vb = 0.030 / ((0.707/0.38)² − 1)
      //      = 0.030 / (3.4636 − 1)  ≈ 0.01217 m³ ≈ 12.17 L
      const QTC_BUTTERWORTH = Math.SQRT1_2; // 1/√2 = 0.7071
      const Vb = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, QTC_BUTTERWORTH);
      assert.ok(Vb !== null,
        'Butterworth alignment should be physically realisable for this driver');
      // Verify by rounding: Qtc from resulting Vb should equal 0.7071
      const Qtc_check = DRIVER.Qts * Math.sqrt(1 + DRIVER.Vas / Vb);
      assert.ok(Math.abs(Qtc_check - QTC_BUTTERWORTH) < EXACT,
        `Vb=${(Vb * 1000).toFixed(2)} L → Qtc=${Qtc_check.toFixed(6)} (expected ${QTC_BUTTERWORTH.toFixed(6)})`);
    });

    it('a higher Qtc target gives a smaller enclosure (less box compliance needed)', () => {
      // Higher Qtc = more boost = smaller box.
      // Qtc 0.9 > 0.707, so Vb(0.9) < Vb(0.707).
      const Vb_707 = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, Math.SQRT1_2);
      const Vb_090 = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, 0.9);
      assert.ok(Vb_707 !== null && Vb_090 !== null);
      assert.ok(Vb_090 < Vb_707,
        `Vb for Qtc=0.9 (${(Vb_090 * 1000).toFixed(1)} L) should be less than Vb for Qtc=0.707 (${(Vb_707 * 1000).toFixed(1)} L)`);
    });

    it('returns null when the target Qtc is below the driver Qts (physically impossible)', () => {
      // Qtc < Qts is not realisable — any finite box raises Qtc, not lowers it.
      // The formula gives (Qtc/Qts)² < 1, so the denominator is negative → null.
      const QTC_BELOW_QTS = DRIVER.Qts - 0.01; // just below Qts
      const result = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, QTC_BELOW_QTS);
      assert.equal(result, null,
        `Qtc=${QTC_BELOW_QTS} < Qts=${DRIVER.Qts} should return null (unrealisable)`);
    });

    it('returns null when the target Qtc equals the driver Qts (infinite box — open baffle)', () => {
      // At Qtc = Qts exactly, the formula gives Vb = Vas / 0 → undefined (infinite box).
      const result = engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, DRIVER.Qts);
      assert.equal(result, null,
        `Qtc = Qts should return null (would require infinite box)`);
    });

    it('sealedQtcFromVolume refuses a non-positive box volume', () => {
      // Qtc = Qts·√(1 + Vas/Vb) is undefined for Vb ≤ 0 — no enclosure has zero or negative volume.
      assert.equal(engine.sealed.qtcFromVolume(DRIVER.Qts, DRIVER.Vas, 0), null,
        'Vb=0 must be refused, not divide-by-zero');
      assert.equal(engine.sealed.qtcFromVolume(DRIVER.Qts, DRIVER.Vas, -0.01), null,
        'a negative Vb must be refused');
    });

  });
});
