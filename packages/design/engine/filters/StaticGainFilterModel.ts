import {cx} from '../complex.js';
import type {Complex, FilterSpec, StaticGainFilter, StaticGainPatch, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {FILTER_GAIN_LIMITS, clamp} from './limits.js';


/** A flat gain, no frequency dependence. */
export class StaticGainFilterModel implements FilterModel {
  constructor(private readonly spec: StaticGainFilter) {}

  response(): Complex {
    return cx(Math.pow(10, this.spec.gain / 20), 0);
  }

  caption(): string {
    return `Static gain (Gain=${this.spec.gain.toFixed(2)} dB)`;
  }

  wpr(): WprFilter {
    const {gain, enabled} = this.spec;
    return {type: 6, params: `0;${enabled ? 1 : 0};${gain}`};
  }

  /** `.wpr` params: `0;enabled;gain` — 3 fields. */
  static fromWpr(fields: readonly string[]): FilterSpec | 'malformed' {
    if (fields.length !== 3) return 'malformed';
    const gain = Number(fields[2]);
    if (!Number.isFinite(gain)) return 'malformed';
    return {type: 'staticGain', gain};
  }

  /** Typed edit — `gain` clamped to its entry range. */
  static with(f: StaticGainFilter, patch: StaticGainPatch): StaticGainFilter {
    const next = {...f, ...patch};
    return {...next, gain: clamp(next.gain, FILTER_GAIN_LIMITS)};
  }
}
