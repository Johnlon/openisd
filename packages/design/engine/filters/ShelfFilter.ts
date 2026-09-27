import {biquad} from './biquad.js';
import type {Complex, Filter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_Q_LIMITS, clamp} from './limits.js';

type Spec = Extract<Filter, {type: 'lowshelf' | 'highshelf'}>;

/**
 * OpenISD-only low/high shelves (not a WinISD type) — one class for both, since they differ
 * only in which side of the biquad carries A = 10^(gainDb/40).
 *   Low:  H(s) = A · (s² + (√A/Q)·s + A) / (A·s² + (√A/Q)·s + 1)
 *   High: H(s) = A · (A·s² + (√A/Q)·s + 1) / (s² + (√A/Q)·s + A)
 */
export class ShelfFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const {fc, Q, gain} = this.spec;
    const w = 2 * Math.PI * f;
    const w0 = 2 * Math.PI * fc;
    const A = Math.pow(10, gain / 40);
    const sqA = Math.sqrt(A);
    return this.spec.type === 'lowshelf'
      ? biquad(w, A, A * sqA * w0 / Q, A * A * w0 * w0, A, sqA * w0 / Q, w0 * w0)
      : biquad(w, A * A, A * sqA * w0 / Q, A * w0 * w0, 1, sqA * w0 / Q, A * w0 * w0);
  }

  caption(): string {
    const label = this.spec.type === 'lowshelf' ? 'Low shelf' : 'High shelf';
    const {fc, Q, gain} = this.spec;
    return `${label} (fc ${fc.toFixed(0)} Hz · Q ${Q.toFixed(2)} · ${gain.toFixed(1)} dB)`;
  }

  /** WinISD has no shelf filter type — nothing to write, and (unlike every WinISD type) no
   *  `.wpr` type number to parse from either. */
  wpr(): null {
    return null;
  }

  /** Typed edit — `fc`/`Q`/`gain` each clamped to their own entry ranges; any field left out of
   *  `patch` passes through unchanged. Same variant (low/high shelf) in, same variant out. */
  static with(f: Spec, patch: Partial<Pick<Spec, 'fc' | 'Q' | 'gain'>>): Spec {
    const next = {...f, ...patch};
    return {
      ...next,
      fc: clamp(next.fc, FILTER_FC_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
      gain: clamp(next.gain, FILTER_GAIN_LIMITS),
    };
  }
}
