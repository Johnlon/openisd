'use strict';
// Allocation-light complex number helpers.  All inputs/outputs are plain
// {re, im} objects — no class, no prototype overhead.
const cx    = (re, im = 0) => ({ re, im });
const cAdd  = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cSub  = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cMul  = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cDiv  = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
const cInv  = (a)    => { const d = a.re * a.re + a.im * a.im; return { re: a.re / d, im: -a.im / d }; };
const cAbs  = (a)    => Math.hypot(a.re, a.im);
const cArg  = (a)    => Math.atan2(a.im, a.re);
const cScale = (a, k) => ({ re: a.re * k, im: a.im * k });
const cPar  = (...zs) => cInv(zs.reduce((s, z) => cAdd(s, cInv(z)), cx(0, 0)));  // parallel impedance

const API = { cx, cAdd, cSub, cMul, cDiv, cInv, cAbs, cArg, cScale, cPar };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.R = Object.assign(window.R || {}, API);
