/**
 * Direct unit tests for the shelving filters in src/filters.ts — lowShelf and highShelf.
 *
 * Every expected value is derived by hand from the documented transfer function, evaluated
 * at s = jω, and NEVER read back from the implementation. The derivation is written out in
 * each test so a reader can check the arithmetic without running anything.
 *
 * Shelf convention under test: `gainDb` is the FULL shelf height. A low shelf reaches it at
 * DC and unity well above fc; a high shelf is unity at DC and reaches it well above fc.
 * https://en.wikipedia.org/wiki/Audio_equalization#Shelving_filters
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { lowShelf, highShelf } from '@openisd/engine';

// Tolerance for floating-point comparisons — these are a handful of multiplies and one
// complex division, so agreement is near machine precision.
const EPS = 1e-9;

function near(got: number, want: number, msg: string) {
  assert.ok(Math.abs(got - want) < Math.max(EPS, Math.abs(want) * EPS),
    `${msg}: got ${got}, expected ${want}`);
}

// A 40 dB shelf makes the algebra exact: A = 10^(40/40) = 10, so A² = 100 and √A = √10.
// Choosing Q = √A makes the damping term √A/Q collapse to 1, which is what lets the
// mid-shelf point below be evaluated in closed form on paper.
const GAIN_DB = 40;
const A = 10;
const ROOT_A = Math.sqrt(10);
const Q = ROOT_A;
const FC = 100; // Hz

describe('lowShelf — 2nd-order low-frequency shelving filter', () => {

  it('boosts DC by the full shelf gain (|H| = 10^(gainDb/20) = 100 at 0 Hz)', () => {
    // At ω = 0 the biquad reduces to b2/a2 = A²ω₀²/ω₀² = A² = 10^(gainDb/20).
    const H = lowShelf(0, FC, Q, GAIN_DB);
    near(H.re, A * A, 'DC real part');
    near(H.im, 0, 'DC imaginary part');
  });

  it('approaches unity (0 dB) far above the corner, trailing a phase lag of 0.9·ω₀/ω', () => {
    // Write r = ω₀/ω and divide num and den by ω²  (with Q = √A, so √A/Q = 1):
    //   num/ω² = A²r² − A + j·A·r      den/ω² = r² − A + j·r
    // To first order in r:  H ≈ (1 − j·r)/(1 − j·r/A) ≈ 1 − j·r·(1 − 1/A).
    // At r = 1e-6 and A = 10 that is H ≈ 1 − j·0.9e-6 — the limit is 1, and the residual is
    // asserted rather than tolerated, which is what proves it is a genuine asymptote.
    const r = 1e-6;
    const H = lowShelf(FC / r, FC, Q, GAIN_DB);
    near(H.re, 1, 'HF real part');
    near(H.im, -r * (1 - 1 / A), 'HF imaginary part (first-order residual)');
  });

  it('equals 10 − j·99√10 at f = fc/√A, where the denominator is purely imaginary', () => {
    // num = (A²ω₀² − A·ω²) + j·A·√A·ω₀·ω/Q ; den = (ω₀² − A·ω²) + j·√A·ω₀·ω/Q.
    // Put ω² = ω₀²/A (so ω = ω₀/√10) and Q = √A, hence √A/Q = 1:
    //   den = 0 + j·ω₀²/√10
    //   num = (100 − 1)·ω₀² + j·10·ω₀²/√10  =  ω₀²·(99 + j√10)
    //   H   = (99 + j√10)·√10 / j  =  √10·(√10 − 99j)  =  10 − j·99√10
    const H = lowShelf(FC / ROOT_A, FC, Q, GAIN_DB);
    near(H.re, 10, 'real part');
    near(H.im, -99 * ROOT_A, 'imaginary part');
  });

  it('a 0 dB shelf is a pass-through at every frequency', () => {
    // A = 1 collapses numerator and denominator to the same polynomial.
    for (const f of [10, 100, 1000]) {
      const H = lowShelf(f, FC, Q, 0);
      near(H.re, 1, `0 dB real part at ${f} Hz`);
      near(H.im, 0, `0 dB imaginary part at ${f} Hz`);
    }
  });

  it('a negative gain cuts the low end by that many dB', () => {
    // −40 dB ⇒ A = 10^(−1) = 0.1 ⇒ DC gain = A² = 0.01 = 10^(−40/20).
    const H = lowShelf(0, FC, Q, -GAIN_DB);
    near(H.re, 0.01, 'DC real part');
    near(H.im, 0, 'DC imaginary part');
  });
});

describe('highShelf — 2nd-order high-frequency shelving filter', () => {

  it('is unity (0 dB) at DC — the shelf has not started', () => {
    // At ω = 0 the biquad reduces to b2/a2 = A·ω₀² / A·ω₀² = 1.
    const H = highShelf(0, FC, Q, GAIN_DB);
    near(H.re, 1, 'DC real part');
    near(H.im, 0, 'DC imaginary part');
  });

  it('approaches the full shelf gain far above the corner (H → A² = 100)', () => {
    // Write r = ω₀/ω and divide num and den by ω²  (with Q = √A, so √A/Q = 1):
    //   num/ω² = A·r² − A² + j·A·r      den/ω² = A·r² − 1 + j·r
    // To first order in r:  H ≈ (A² − j·A·r)(1 + j·r) ≈ A² + j·r·(A² − A).
    // At r = 1e-6 and A = 10 that is H ≈ 100 + j·90e-6.
    const r = 1e-6;
    const H = highShelf(FC / r, FC, Q, GAIN_DB);
    near(H.re, A * A, 'HF real part');
    near(H.im, r * (A * A - A), 'HF imaginary part (first-order residual)');
  });

  it('equals 10 + j·99√10 at f = fc·√A — the conjugate of the low shelf mirror point', () => {
    // num = (A·ω₀² − A²·ω²) + j·A·√A·ω₀·ω/Q ; den = (A·ω₀² − ω²) + j·√A·ω₀·ω/Q.
    // Put ω² = A·ω₀² (so ω = ω₀·√10) and Q = √A, hence √A/Q = 1:
    //   den = 0 + j·ω₀²√10
    //   num = 10·ω₀²·(1 − 100) + j·10·ω₀²√10  =  ω₀²·(−990 + j·10√10)
    //   H   = (−990 + j·10√10) / (j√10)  =  (10√10 + 990j)/√10  =  10 + j·99√10
    const H = highShelf(FC * ROOT_A, FC, Q, GAIN_DB);
    near(H.re, 10, 'real part');
    near(H.im, 99 * ROOT_A, 'imaginary part');
  });

  it('a 0 dB shelf is a pass-through at every frequency', () => {
    for (const f of [10, 100, 1000]) {
      const H = highShelf(f, FC, Q, 0);
      near(H.re, 1, `0 dB real part at ${f} Hz`);
      near(H.im, 0, `0 dB imaginary part at ${f} Hz`);
    }
  });

  it('mirrors lowShelf: swapping the shelf type swaps which end is boosted', () => {
    // A designer's sanity check — the two filters are complementary in where the gain sits.
    const lowAtDc = lowShelf(0, FC, Q, GAIN_DB);
    const highAtDc = highShelf(0, FC, Q, GAIN_DB);
    const lowAtHf = lowShelf(FC * 1e6, FC, Q, GAIN_DB);
    const highAtHf = highShelf(FC * 1e6, FC, Q, GAIN_DB);
    assert.ok(lowAtDc.re > highAtDc.re, 'low shelf boosts DC, high shelf does not');
    assert.ok(highAtHf.re > lowAtHf.re, 'high shelf boosts HF, low shelf does not');
  });
});
