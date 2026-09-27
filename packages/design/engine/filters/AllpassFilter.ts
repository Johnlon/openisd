import {biquad} from './biquad.js';
import {cDiv, cx} from '../complex.js';
import type {Complex, Filter, FilterSpec, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {FILTER_ORDER_LIMITS, FILTER_Q_LIMITS, FILTER_T_LIMITS, clamp, roundClamp} from './limits.js';

type Spec = Extract<Filter, {type: 'allpass'}>;

/**
 * Allpass. Order 1: (1 − jωt/2)/(1 + jωt/2), DC group delay t. Order ≥ 2: the 2nd-order allpass
 * with ω0 = 2/t and Q, DC group delay t/Q; order above 2 is ignored (GHIDRA_FINDINGS.md
 * "Allpass n ≥ 2 ⚠": n=3 and n=4 give the same 2nd-order section as n=2).
 */
export class AllpassFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const {order, t, Q} = this.spec;
    const w = 2 * Math.PI * f;
    if (order <= 1) return cDiv(cx(1, -w * t / 2), cx(1, w * t / 2));
    const w0 = 2 / t;
    return biquad(w, 1, -w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
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

  /** Typed edit — `order` rounded to the nearest integer then clamped to 1..10, `t`/`Q` clamped
   *  to their own entry ranges; any field left out of `patch` passes through unchanged. */
  static with(f: Spec, patch: Partial<Pick<Spec, 'order' | 't' | 'Q'>>): Spec {
    const next = {...f, ...patch};
    return {
      ...next,
      order: roundClamp(next.order, FILTER_ORDER_LIMITS),
      t: clamp(next.t, FILTER_T_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
    };
  }
}
