import {biquad} from './biquad.js';
import type {Complex, FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<FilterSpec, {type: 'linkwitz'}>;

/**
 * Linkwitz transform (sealed enclosure bass extension) — reshapes a sealed-box low-frequency
 * response from its natural alignment (f0, Q0) to a target alignment (fp, Qp). The one filter
 * type that predates WinISD's GHIDRA-verified filter chain and is unchanged by it:
 *   H(s) = (s² + (ω₀/Q₀)·s + ω₀²) / (s² + (ωₚ/Qₚ)·s + ωₚ²)
 * https://en.wikipedia.org/wiki/Linkwitz_transform
 */
export class LinkwitzTransformFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const {f0, Q0, fp, Qp} = this.spec;
    const w  = 2 * Math.PI * f;
    const w0 = 2 * Math.PI * f0;
    const wp = 2 * Math.PI * fp;
    return biquad(w, 1, w0 / Q0, w0 * w0, 1, wp / Qp, wp * wp);
  }

  caption(): string {
    const {f0, Q0, fp, Qp} = this.spec;
    return `Linkwitz transform (f0=${f0.toFixed(2)} Q0=${Q0.toFixed(2)} fp=${fp.toFixed(2)} Qp=${Qp.toFixed(2)})`;
  }
}
