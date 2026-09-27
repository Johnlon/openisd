import {biquad} from './biquad.js';
import type {Complex, FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<FilterSpec, {type: 'peakHighpass'}>;

/**
 * The HP2 whose peak is Gpk at fpk: s²/(s²+(ω0/Q)s+ω0²), P = 10^(Gpk/20),
 * Q² = (P² + P·√(P²−1))/2, ω0 = 2π·fpk·√(1 − 1/(2Q²)).
 */
export class PeakHighpassFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const {fpk, gainPk} = this.spec;
    const P = Math.pow(10, gainPk / 20);
    const Q2 = (P * P + P * Math.sqrt(P * P - 1)) / 2;
    const Q = Math.sqrt(Q2);
    const w0 = 2 * Math.PI * fpk * Math.sqrt(1 - 1 / (2 * Q2));
    return biquad(2 * Math.PI * f, 1, 0, 0, 1, w0 / Q, w0 * w0);
  }

  caption(): string {
    const {fpk, gainPk} = this.spec;
    return `Peaking 2nd order highpass (Gpk=${gainPk.toFixed(2)} dB fpk=${fpk.toFixed(2)} Hz)`;
  }
}
