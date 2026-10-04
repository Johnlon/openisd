import {biquad} from './biquad.js';
import {cAdd, cDiv, cMul, cx} from '../complex.js';
import type {AllpassFilter, Complex, FilterSpec, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';


/** Reverse Bessel polynomial θn(s) = Σ a_k·s^k, a_k = (2n−k)!/(2^(n−k)·k!·(n−k)!), at s = j·x.
 *  Built from a_n = 1 down, a_(k−1) = a_k·k·(2n−k+1)/(2·(n−k+1)), so no factorial overflows. */
function reverseBessel(n: number, x: number): Complex {
  let a = 1;
  let sum = cx(0, 0);
  for (let k = n; k >= 0; k--) {
    sum = cAdd(cMul(sum, cx(0, x)), cx(a, 0));
    if (k > 0) a = a * k * (2 * n - k + 1) / (2 * (n - k + 1));
  }
  return sum;
}

/**
 * Allpass, order n, delay t.
 * Order 1: (1 − jωt/2)/(1 + jωt/2), delay t. Order 2: WinISD's 2nd-order allpass, ω0 = 2/t and Q,
 * delay t/Q. Above order 2 WinISD ignores the order and draws order 2 (GHIDRA_FINDINGS.md
 * "Allpass n ≥ 2 ⚠"); OpenISD honours it: the order-n Bessel (maximally flat delay) allpass
 * θn(−s·t/2)/θn(s·t/2), delay t, flat to a higher frequency as the order rises; Q is not used
 * (bugs/archive/BUG_20260927_winisd-allpass-t-not-delay-order-above-2-ignored.md).
 */
export class AllpassFilterModel implements FilterModel {
  constructor(private readonly spec: AllpassFilter) {}

  response(f: number): Complex {
    const {order, t, Q} = this.spec;
    const w = 2 * Math.PI * f;
    if (order === 2) {
      const w0 = 2 / t;
      return biquad(w, 1, -w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
    }
    // θn has real coefficients, so θn(−jx) = conj(θn(jx)). θ1 = s + 1 is order 1's own form.
    const d = reverseBessel(Math.max(1, order), w * t / 2);
    return cDiv(cx(d.re, -d.im), d);
  }

  caption(): string {
    const {order, t, Q} = this.spec;
    const q = order >= 2 ? `, Q=${Q.toFixed(2)}` : '';
    return `Allpass (n=${order}, t=${t.toFixed(3)} s${q})`;
  }

  wpr(): WprFilter {
    const {order, t, Q, enabled} = this.spec;
    return {type: 2, params: `0;${enabled ? 1 : 0};${order};${t};${Q}`};
  }

  /** `.wpr` params: `0;enabled;order;t;Q` — 5 fields, WinISD's own always-`0` first field. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 5) return 'malformed';
    const order = Number(fields[2]);
    const t = Number(fields[3]);
    const Q = Number(fields[4]);
    if (!Number.isFinite(order) || !Number.isFinite(t) || !Number.isFinite(Q)) return 'malformed';
    return {type: 'allpass', order, t, Q};
  }
}
