import type { Complex } from './types.js';

export const cx     = (re: number, im = 0): Complex => ({ re, im });
export const cAdd   = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cSub   = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cMul   = (a: Complex, b: Complex): Complex => ({ re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re });
export const cDiv   = (a: Complex, b: Complex): Complex => { const d = b.re*b.re + b.im*b.im; return { re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d }; };
export const cInv   = (a: Complex): Complex => { const d = a.re*a.re + a.im*a.im; return { re: a.re/d, im: -a.im/d }; };
export const cAbs   = (a: Complex): number => Math.hypot(a.re, a.im);
export const cArg   = (a: Complex): number => Math.atan2(a.im, a.re);
export const cScale = (a: Complex, k: number): Complex => ({ re: a.re*k, im: a.im*k });
/** e^z = e^x·(cos y + j·sin y)  https://en.wikipedia.org/wiki/Exponential_function#Complex_exponential */
export const cExp   = (a: Complex): Complex => { const m = Math.exp(a.re); return { re: m*Math.cos(a.im), im: m*Math.sin(a.im) }; };
/**
 * tanh(x + jy) = [sinh 2x + j·sin 2y] / [cosh 2x + cos 2y]
 * https://en.wikipedia.org/wiki/Hyperbolic_functions#Hyperbolic_tangent
 *
 * Evaluated in this half-angle form rather than as (e^z − e^−z)/(e^z + e^−z) because the
 * latter overflows to NaN (Infinity/Infinity) once |x| passes ~710. Beyond |2x| = TANH_SAT
 * both sinh and cosh are the same number to within a double's precision, so tanh is ±1
 * exactly — returning it directly keeps a long, lossy transmission line finite.
 */
const TANH_SAT = 40;   // cosh(40) ≈ 1.2e17 — sinh/cosh agree to < 1 ulp beyond here
export const cTanh  = (a: Complex): Complex => {
  const x2 = 2*a.re, y2 = 2*a.im;
  if (Math.abs(x2) > TANH_SAT) return { re: Math.sign(x2), im: 0 };
  const d = Math.cosh(x2) + Math.cos(y2);
  return { re: Math.sinh(x2)/d, im: Math.sin(y2)/d };
};
export const cPar   = (...zs: Complex[]): Complex => cInv(zs.reduce((s, z) => cAdd(s, cInv(z)), cx(0, 0)));
