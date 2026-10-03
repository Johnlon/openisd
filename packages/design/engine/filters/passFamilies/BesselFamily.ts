import {cAdd, cDiv, cMul, cScale, cx} from '../../complex.js';
import type {Complex} from '../../types.js';
import type {PassFamilyModel} from './PassFamilyModel.js';

function factorial(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

/** cm = (2n−m)!/(2^(n−m)·m!·(n−m)!), m = 0..n. cm[0] = c0, cm[n] = 1 always. */
function besselCoeffs(n: number): number[] {
  const cm: number[] = [];
  for (let m = 0; m <= n; m++) cm.push(factorial(2 * n - m) / (Math.pow(2, n - m) * factorial(m) * factorial(n - m)));
  return cm;
}

/** [(k·s)^0, (k·s)^1, …, (k·s)^n] at normalised s = j·x. */
function besselTerms(x: number, n: number, k: number): Complex[] {
  const ks = cx(0, k * x);
  const terms: Complex[] = [cx(1, 0)];
  for (let m = 1; m <= n; m++) terms.push(cMul(terms[m - 1], ks));
  return terms;
}

function besselDenominator(cm: readonly number[], terms: readonly Complex[]): Complex {
  let sum = cx(0, 0);
  for (let m = 0; m < cm.length; m++) sum = cAdd(sum, cScale(terms[m], cm[m]));
  return sum;
}

/**
 * The Bessel pass family, order n — GHIDRA_FINDINGS.md: phase-normalised, k = c0^(1/n). The low-pass
 * is WinISD's. The high-pass is the mirror of that low-pass; `winisdHighpass` selects WinISD's own
 * (non-mirror) form instead.
 */
export class BesselFamily implements PassFamilyModel {
  readonly label = 'Bessel';
  constructor(private readonly order: number, private readonly winisdHighpass: boolean) {}

  /** LP: c0 / Σ cm·(k·s)^m. */
  lowpass(x: number): Complex {
    const cm = besselCoeffs(this.order);
    const k = Math.pow(cm[0], 1 / this.order);
    return cDiv(cx(cm[0], 0), besselDenominator(cm, besselTerms(x, this.order, k)));
  }

  /**
   * HP. Mirror (default): the LP with s → 1/s, c0/Σ cm·(k/s)^m, evaluated as
   * c0·s^n / Σ cm·k^m·s^(n−m) so it is finite at x = 0. With `winisdHighpass`: WinISD's own,
   * (k·s)^n / Σ cm·(k·s)^m — the LP's denominator with numerator (k·s)^n, NOT the mirror
   * (WinISD error, GHIDRA_FINDINGS.md "Bessel HP ⚠").
   */
  highpass(x: number): Complex {
    const cm = besselCoeffs(this.order);
    const k = Math.pow(cm[0], 1 / this.order);
    if (this.winisdHighpass) {
      const terms = besselTerms(x, this.order, k);
      return cDiv(terms[this.order], besselDenominator(cm, terms));
    }
    const powers = besselTerms(x, this.order, 1);
    let denominator = cx(0, 0);
    for (let m = 0; m <= this.order; m++) denominator = cAdd(denominator, cScale(powers[this.order - m]!, cm[m]! * Math.pow(k, m)));
    return cDiv(cScale(powers[this.order]!, cm[0]), denominator);
  }
}
