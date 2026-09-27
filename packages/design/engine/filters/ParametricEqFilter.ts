import {biquad} from './biquad.js';
import type {Complex, Filter, FilterSpec, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_Q_LIMITS, clamp} from './limits.js';

type Spec = Extract<Filter, {type: 'peaking'}>;

/**
 * Parametric EQ (peaking). V = 10^(G/20). Boost (V ≥ 1): (s²+V·(ω0/Q)s+ω0²)/(s²+(ω0/Q)s+ω0²).
 * Cut (V < 1): (s²+(ω0/Q)s+ω0²)/(s²+(ω0/(V·Q))s+ω0²) — symmetric boost/cut, not the same curve
 * run backwards.
 */
export class ParametricEqFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const {fc, Q, gain} = this.spec;
    const w = 2 * Math.PI * f, w0 = 2 * Math.PI * fc;
    const V = Math.pow(10, gain / 20);
    if (V >= 1) return biquad(w, 1, V * w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
    return biquad(w, 1, w0 / Q, w0 * w0, 1, w0 / (V * Q), w0 * w0);
  }

  caption(): string {
    const {fc, Q, gain} = this.spec;
    return `Parametric EQ (fc=${fc.toFixed(2)} Hz, Q=${Q.toFixed(2)}, Gain=${gain.toFixed(2)} dB)`;
  }

  wpr(): WprFilter {
    const {fc, Q, gain, enabled} = this.spec;
    return {type: 4, params: `0;${enabled ? 1 : 0};${fc};${Q};${gain}`};
  }

  /** `.wpr` params: `0;enabled;fc;Q;gain` — 5 fields. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 5) return 'malformed';
    const fc = Number(fields[2]);
    const Q = Number(fields[3]);
    const gain = Number(fields[4]);
    if (![fc, Q, gain].every(Number.isFinite)) return 'malformed';
    return {type: 'peaking', fc, Q, gain};
  }

  /** Typed edit — `fc`/`Q`/`gain` each clamped to their own entry ranges; any field left out of
   *  `patch` passes through unchanged. */
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
