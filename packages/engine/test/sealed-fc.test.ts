/**
 * Direct unit tests for sealedFc in src/alignments.ts — the closed-box system resonance for a
 * KNOWN volume, Fc = Fs·√(1 + Vas/Vb).
 *
 * [S72a] Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
 *        https://aes.org/e-lib/browse.cfm?elib=2062
 * [Wiki-TS] https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Every expected value is arithmetic a designer can do on paper; none is read back from the
 * implementation. This is the lossless direction — the lossy WinISD readout is
 * sealedResonanceWinisd, covered in loss-mode.test.ts.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { sealedFc, sealedFromQtc } from '@openisd/engine';

const EPS = 1e-9;

function near(got: number, want: number, msg: string) {
  assert.ok(Math.abs(got - want) < Math.max(EPS, Math.abs(want) * EPS),
    `${msg}: got ${got}, expected ${want}`);
}

// A typical 6.5" mid-woofer, SI units — the same shape used across the engine suite.
const DRIVER = { Fs: 40, Vas: 0.030 }; // 40 Hz, 30 L

describe('Sealed-box resonance for a given volume (sealedFc)', () => {

  it('a 10 L box under a 30 L-Vas / 40 Hz driver resonates at 80 Hz', () => {
    // Vas/Vb = 0.030/0.010 = 3 ⇒ Fc = 40·√4 = 40·2 = 80 Hz exactly.
    const Fc = sealedFc(DRIVER, 0.010);
    assert.ok(Fc !== null, 'a positive volume must yield a resonance');
    near(Fc, 80, 'Fc for Vb = 10 L');
  });

  it('a box equal to Vas raises resonance by exactly √2', () => {
    // Vas/Vb = 1 ⇒ Fc = Fs·√2 — the textbook "box as compliant as the driver" case.
    const Fc = sealedFc(DRIVER, DRIVER.Vas);
    assert.ok(Fc !== null, 'a positive volume must yield a resonance');
    near(Fc, 40 * Math.SQRT2, 'Fc for Vb = Vas');
  });

  it('a very large box lifts resonance above Fs by only Fs·Vas/(2·Vb)', () => {
    // As Vb → ∞ the box adds no stiffness and Fc → Fs. The approach is first-order:
    // √(1 + x) ≈ 1 + x/2 for small x = Vas/Vb, so Fc − Fs ≈ Fs·Vas/(2·Vb).
    // At Vb = 1e6 m³ that is 40 · 0.030 / 2e6 = 6e-7 Hz — asserted, not merely tolerated.
    const Vb = 1e6;
    const Fc = sealedFc(DRIVER, Vb);
    assert.ok(Fc !== null, 'a positive volume must yield a resonance');
    assert.ok(Fc > DRIVER.Fs, 'a sealed box can only raise resonance, never lower it');
    // 1e-6 relative: subtracting two numbers that agree to 8 significant figures loses
    // ~8 digits to cancellation, so the difference itself is only good to ~1e-8 relative.
    const lift = DRIVER.Fs * DRIVER.Vas / (2 * Vb);
    assert.ok(Math.abs((Fc - DRIVER.Fs) - lift) < lift * 1e-6,
      `first-order lift: got ${Fc - DRIVER.Fs}, expected ${lift}`);
  });

  it('resonance rises monotonically as the box shrinks', () => {
    const f = (Vb: number) => sealedFc(DRIVER, Vb)!;
    assert.ok(f(0.005) > f(0.010), '5 L must resonate higher than 10 L');
    assert.ok(f(0.010) > f(0.020), '10 L must resonate higher than 20 L');
    assert.ok(f(0.020) > f(0.040), '20 L must resonate higher than 40 L');
  });

  it('returns null for a zero or negative volume — there is no such enclosure', () => {
    assert.equal(sealedFc(DRIVER, 0), null, 'Vb = 0 has no resonance');
    assert.equal(sealedFc(DRIVER, -0.010), null, 'a negative volume is not an enclosure');
  });

  it('inverts sealedFromQtc: the volume for a target Qtc resonates at Fs·(Qtc/Qts)', () => {
    // Qtc = Qts·√(1 + Vas/Vb) and Fc = Fs·√(1 + Vas/Vb) share the same box factor, so
    // feeding sealedFromQtc's answer back into sealedFc must land on Fs·Qtc/Qts.
    // Butterworth (Qtc = 0.707) on a Qts = 0.38 driver ⇒ Fc = 40·0.707/0.38.
    const drv = { Fs: 40, Qts: 0.38, Vas: 0.030 };
    const Qtc = 0.707;
    const Vb = sealedFromQtc(drv, Qtc);
    assert.ok(Vb !== null, 'Qtc above Qts must yield a finite volume');
    const Fc = sealedFc(drv, Vb);
    assert.ok(Fc !== null, 'a positive volume must yield a resonance');
    near(Fc, drv.Fs * (Qtc / drv.Qts), 'Fc round-tripped through sealedFromQtc');
  });
});
