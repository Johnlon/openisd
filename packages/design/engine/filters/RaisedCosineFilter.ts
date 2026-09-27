import {cx} from '../complex.js';
import type {Complex, Filter, FilterSpec, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';

type Spec = Extract<Filter, {type: 'raisedCosine'}>;

/**
 * DLP Raised Cosine. Real, zero phase: x = log10(f/fc)/(log10(2)·BW); for −1 ≤ x ≤ 1,
 * 10^((1+cos(πx))·(G/20)·0.5), else 1. fc or BW ≤ 0 is replaced by 1e-6.
 */
export class RaisedCosineFilter implements FilterModel {
  constructor(private readonly spec: Spec) {}

  response(f: number): Complex {
    const fc = this.spec.fc <= 0 ? 1e-6 : this.spec.fc;
    const bw = this.spec.bwOct <= 0 ? 1e-6 : this.spec.bwOct;
    const x = Math.log10(f / fc) / (Math.log10(2) * bw);
    if (x < -1 || x > 1) return cx(1, 0);
    return cx(Math.pow(10, (1 + Math.cos(Math.PI * x)) * (this.spec.gain / 20) * 0.5), 0);
  }

  caption(): string {
    const {fc, bwOct, gain} = this.spec;
    return `DLP Raised Cosine (fc=${fc.toFixed(2)} Hz, BW=${bwOct.toFixed(2)} oct, Gain=${gain.toFixed(2)} dB)`;
  }

  wpr(): WprFilter {
    const {fc, bwOct, gain, enabled} = this.spec;
    return {type: 7, params: `0;${enabled ? 1 : 0};${fc};${bwOct};${gain}`};
  }

  /** `.wpr` params: `0;enabled;fc;BW;gain` — 5 fields. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 5) return 'malformed';
    const fc = Number(fields[2]);
    const bwOct = Number(fields[3]);
    const gain = Number(fields[4]);
    if (![fc, bwOct, gain].every(Number.isFinite)) return 'malformed';
    return {type: 'raisedCosine', fc, bwOct, gain};
  }
}
