import {biquad} from './biquad.js';
import type {Complex, FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<FilterSpec, {type: 'peaking'}>;

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
}
