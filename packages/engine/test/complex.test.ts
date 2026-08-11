/**
 * Direct unit tests for src/core/complex.js
 *
 * Complex arithmetic is the mathematical foundation of the circuit solver.
 * Every operation is tested with a scenario a developer can verify by hand.
 *
 * All expected values are computed by hand or from first principles —
 * no test values depend on the implementation being tested.
 *
 * Run: node --test test/complex.test.mjs
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { cx, cAdd, cSub, cMul, cDiv, cInv, cAbs, cArg, cScale, cPar } from '@openisd/engine';
import type { Complex } from '@openisd/engine';

// Tolerance for floating-point comparisons (effectively exact for these operations).
const EPS = 1e-12;

function near(a: number, b: number, msg: string) {
  assert.ok(Math.abs(a - b) < EPS, `${msg}: got ${a}, expected ${b}`);
}

function nearCx(got: Complex, re: number, im: number, label: string) {
  near(got.re, re, `${label}.re`);
  near(got.im, im, `${label}.im`);
}


describe('Complex number construction (cx)', () => {

  it('cx(3, 4) creates the complex number 3 + 4i', () => {
    const z = cx(3, 4);
    assert.equal(z.re, 3);
    assert.equal(z.im, 4);
  });

  it('cx(5) with no imaginary part creates the real number 5 + 0i', () => {
    const z = cx(5);
    assert.equal(z.re, 5);
    assert.equal(z.im, 0);
  });

});


describe('Addition (cAdd)', () => {

  it('(3 + 4i) + (1 + 2i) = 4 + 6i', () => {
    nearCx(cAdd(cx(3, 4), cx(1, 2)), 4, 6, '(3+4i)+(1+2i)');
  });

  it('adding a real and a purely imaginary number: (5 + 0i) + (0 + 3i) = 5 + 3i', () => {
    nearCx(cAdd(cx(5, 0), cx(0, 3)), 5, 3, '(5+0i)+(0+3i)');
  });

  it('adding a complex number to its negative gives zero', () => {
    nearCx(cAdd(cx(7, -2), cx(-7, 2)), 0, 0, 'z + (-z)');
  });

});


describe('Subtraction (cSub)', () => {

  it('(5 + 3i) − (2 + 1i) = 3 + 2i', () => {
    nearCx(cSub(cx(5, 3), cx(2, 1)), 3, 2, '(5+3i)−(2+1i)');
  });

  it('subtracting a number from itself gives zero', () => {
    nearCx(cSub(cx(4, -3), cx(4, -3)), 0, 0, 'z − z');
  });

});


describe('Multiplication (cMul)', () => {

  it('(3 + 4i) × (1 + 2i) = (3−8) + (6+4)i = −5 + 10i', () => {
    // (a+bi)(c+di) = (ac−bd) + (ad+bc)i
    nearCx(cMul(cx(3, 4), cx(1, 2)), -5, 10, '(3+4i)×(1+2i)');
  });

  it('i × i = −1 (imaginary unit squared)', () => {
    // cx(0,1) is the imaginary unit i;  i×i = −1+0i
    nearCx(cMul(cx(0, 1), cx(0, 1)), -1, 0, 'i×i');
  });

  it('multiplying by 1+0i (real unity) leaves a complex number unchanged', () => {
    const z = cx(7, -3);
    nearCx(cMul(z, cx(1, 0)), z.re, z.im, 'z×1');
  });

  it('(2 + 0i) × (0 + 3i) = 6i — real times imaginary', () => {
    nearCx(cMul(cx(2, 0), cx(0, 3)), 0, 6, '2×3i');
  });

});


describe('Division (cDiv)', () => {

  it('(3 + 4i) / (1 + 2i): hand-computed result is 11/5 − 2/5·i = 2.2 − 0.4i', () => {
    // Multiply top and bottom by conjugate (1−2i):
    //   (3+4i)(1−2i) / ((1+2i)(1−2i)) = (3+8 + (4−6)i) / 5 = (11 − 2i) / 5
    nearCx(cDiv(cx(3, 4), cx(1, 2)), 2.2, -0.4, '(3+4i)/(1+2i)');
  });

  it('dividing by itself gives 1 + 0i', () => {
    const z = cx(5, -3);
    nearCx(cDiv(z, z), 1, 0, 'z/z');
  });

  it('(0 + 6i) / (0 + 2i) = 3 + 0i — purely imaginary division', () => {
    nearCx(cDiv(cx(0, 6), cx(0, 2)), 3, 0, '6i/2i');
  });

});


describe('Inverse (cInv)', () => {

  it('inverse of (1 + 0i) is 1 + 0i', () => {
    nearCx(cInv(cx(1, 0)), 1, 0, '1/1');
  });

  it('inverse of (0 + 1i) is 0 − 1i (1/i = −i)', () => {
    nearCx(cInv(cx(0, 1)), 0, -1, '1/i');
  });

  it('inverse of (2 + 0i) is 0.5 + 0i', () => {
    nearCx(cInv(cx(2, 0)), 0.5, 0, '1/2');
  });

  it('z × (1/z) = 1 + 0i for any non-zero complex z', () => {
    const z = cx(3, 4);
    nearCx(cMul(z, cInv(z)), 1, 0, 'z × (1/z)');
  });

});


describe('Magnitude (cAbs)', () => {

  it('|3 + 4i| = 5 — the classic 3-4-5 Pythagorean triple', () => {
    near(cAbs(cx(3, 4)), 5, '|3+4i|');
  });

  it('|1 + 0i| = 1 — unit real', () => {
    near(cAbs(cx(1, 0)), 1, '|1|');
  });

  it('|0 + 1i| = 1 — imaginary unit', () => {
    near(cAbs(cx(0, 1)), 1, '|i|');
  });

  it('|0 + 0i| = 0 — zero', () => {
    near(cAbs(cx(0, 0)), 0, '|0|');
  });

  it('|−5 + 0i| = 5 — magnitude is always non-negative', () => {
    near(cAbs(cx(-5, 0)), 5, '|−5|');
  });

});


describe('Argument / angle (cArg)', () => {

  it('arg(1 + 0i) = 0 — positive real axis', () => {
    near(cArg(cx(1, 0)), 0, 'arg(1)');
  });

  it('arg(0 + 1i) = π/2 — positive imaginary axis', () => {
    near(cArg(cx(0, 1)), Math.PI / 2, 'arg(i)');
  });

  it('arg(−1 + 0i) = π — negative real axis', () => {
    near(cArg(cx(-1, 0)), Math.PI, 'arg(−1)');
  });

  it('arg(0 − 1i) = −π/2 — negative imaginary axis', () => {
    near(cArg(cx(0, -1)), -Math.PI / 2, 'arg(−i)');
  });

  it('arg(1 + 1i) = π/4 — 45° above the real axis', () => {
    near(cArg(cx(1, 1)), Math.PI / 4, 'arg(1+i)');
  });

});


describe('Scalar scaling (cScale)', () => {

  it('2 × (3 + 4i) = 6 + 8i', () => {
    nearCx(cScale(cx(3, 4), 2), 6, 8, '2×(3+4i)');
  });

  it('0 × (7 − 2i) = 0 + 0i', () => {
    nearCx(cScale(cx(7, -2), 0), 0, 0, '0×z');
  });

  it('−1 × (5 + 3i) = −5 − 3i (negation)', () => {
    nearCx(cScale(cx(5, 3), -1), -5, -3, '−1×z');
  });

});


describe('Parallel combination (cPar) — acoustic impedances in parallel', () => {

  // cPar(Z1, Z2, ...) = 1 / (1/Z1 + 1/Z2 + ...)
  // In the circuit solver this represents acoustic compliance elements in parallel.

  it('two equal real impedances in parallel give half the impedance', () => {
    // Two 4 Ω resistors in parallel = 2 Ω
    nearCx(cPar(cx(4, 0), cx(4, 0)), 2, 0, '4Ω ∥ 4Ω = 2Ω');
  });

  it('three equal real impedances in parallel give one-third the impedance', () => {
    nearCx(cPar(cx(9, 0), cx(9, 0), cx(9, 0)), 3, 0, '9Ω ∥ 9Ω ∥ 9Ω = 3Ω');
  });

  it('a very large impedance in parallel with a small one approaches the smaller (dominance)', () => {
    // 1 Ω ∥ 1,000,000 Ω ≈ 0.999999 Ω ≈ 1 Ω
    const result = cPar(cx(1, 0), cx(1e6, 0));
    near(result.re, 1 / (1 + 1e-6), 'dominant impedance');
  });

  it('parallel combination is commutative: Z1 ∥ Z2 = Z2 ∥ Z1', () => {
    const Z1 = cx(3, 2), Z2 = cx(5, -1);
    const ab = cPar(Z1, Z2);
    const ba = cPar(Z2, Z1);
    near(ab.re, ba.re, 'cPar commutative (re)');
    near(ab.im, ba.im, 'cPar commutative (im)');
  });

});
