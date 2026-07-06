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
export const cPar   = (...zs: Complex[]): Complex => cInv(zs.reduce((s, z) => cAdd(s, cInv(z)), cx(0, 0)));
