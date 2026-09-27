import {biquad} from './biquad.js';
import type {Complex, Filter, FilterSpec, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<Filter, {type: 'linkwitz'}>;

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

  wpr(): WprFilter {
    const {f0, Q0, fp, Qp, enabled} = this.spec;
    return {type: 3, params: `0;${enabled ? 1 : 0};${f0};${Q0};${fp};${Qp}`};
  }

  /** `.wpr` params: `0;enabled;f0;Q0;fp;Qp` — 6 fields. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 6) return 'malformed';
    const f0 = Number(fields[2]);
    const Q0 = Number(fields[3]);
    const fp = Number(fields[4]);
    const Qp = Number(fields[5]);
    if (![f0, Q0, fp, Qp].every(Number.isFinite)) return 'malformed';
    return {type: 'linkwitz', f0, Q0, fp, Qp};
  }
}
