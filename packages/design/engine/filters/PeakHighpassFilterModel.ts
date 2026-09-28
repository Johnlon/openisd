import {biquad} from './biquad.js';
import type {Complex, FilterSpec, PeakHighpassFilter, PeakHighpassPatch, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, clamp} from './limits.js';


/**
 * The HP2 whose peak is Gpk at fpk: s²/(s²+(ω0/Q)s+ω0²), P = 10^(Gpk/20),
 * Q² = (P² + P·√(P²−1))/2, ω0 = 2π·fpk·√(1 − 1/(2Q²)).
 */
export class PeakHighpassFilterModel implements FilterModel {
  constructor(private readonly spec: PeakHighpassFilter) {}

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

  wpr(): WprFilter {
    const {fpk, gainPk, enabled} = this.spec;
    return {type: 5, params: `0;${enabled ? 1 : 0};${fpk};${gainPk}`};
  }

  /** `.wpr` params: `0;enabled;fpk;Gpk` — 4 fields. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 4) return 'malformed';
    const fpk = Number(fields[2]);
    const gainPk = Number(fields[3]);
    if (!Number.isFinite(fpk) || !Number.isFinite(gainPk)) return 'malformed';
    return {type: 'peakHighpass', fpk, gainPk};
  }

  /** Typed edit — `fpk`/`gainPk` each clamped to their own entry ranges; any field left out of
   *  `patch` passes through unchanged. */
  static with(f: PeakHighpassFilter, patch: PeakHighpassPatch): PeakHighpassFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      fpk: clamp(next.fpk, FILTER_FC_LIMITS),
      gainPk: clamp(next.gainPk, FILTER_GAIN_LIMITS),
    };
  }
}
