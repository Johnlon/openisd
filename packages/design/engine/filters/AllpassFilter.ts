import {biquad} from './biquad.js';
import {cDiv, cx} from '../complex.js';
import type {Complex, FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<FilterSpec, {type: 'allpass'}>;

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
}
