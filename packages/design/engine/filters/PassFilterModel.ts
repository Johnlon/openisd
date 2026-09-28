import type {Complex, FilterSpec, PassFamily, PassFilter, WprFilter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import type {PassFamilyModel} from './passFamilies/PassFamilyModel.js';
import {ButterworthFamily} from './passFamilies/ButterworthFamily.js';
import {LinkwitzRileyFamily} from './passFamilies/LinkwitzRileyFamily.js';
import {BesselFamily} from './passFamilies/BesselFamily.js';
import {SosFamily} from './passFamilies/SosFamily.js';


/** The one place a `PassFamily` becomes a strategy — exhaustive, no default arm: `PassFamily`
 *  is a closed 4-member union, so an unhandled new subtype fails to compile here. */
function passFamilyModel(family: PassFamily, order: number, Q: number): PassFamilyModel {
  switch (family) {
    case 'butterworth':   return new ButterworthFamily(order);
    case 'linkwitzRiley': return new LinkwitzRileyFamily();
    case 'bessel':        return new BesselFamily(order);
    case 'sos':           return new SosFamily(Q);
  }
}

/** `.wpr` `[Filters]` "Subtype" code, WinISD's own Filter Editor drop-down row — the one place a
 *  `PassFamily` becomes that number, and back. Exhaustive, no default arm. */
function subtypeOf(family: PassFamily): number {
  switch (family) {
    case 'butterworth':   return 0;
    case 'linkwitzRiley': return 1;
    case 'bessel':        return 2;
    case 'sos':           return 3;
  }
}

/** The inverse of `subtypeOf`: `null` for anything other than the four measured codes 0-3 — the
 *  caller decides what an unmapped code means (PROBE_FINDINGS.md: >3 is skipped; a
 *  negative/non-integer code is not measured and is treated as malformed instead of guessed). */
function passFamilyOf(subtype: number): PassFamily | null {
  switch (subtype) {
    case 0: return 'butterworth';
    case 1: return 'linkwitzRiley';
    case 2: return 'bessel';
    case 3: return 'sos';
    default: return null;
  }
}

/**
 * WinISD's Lowpass/Highpass Filter Editor types — one class for both, since they differ only in
 * which side of their `PassFamilyModel` strategy they read, at normalised s = j·(f/fc).
 */
export class PassFilterModel implements FilterModel {
  private readonly family: PassFamilyModel;

  constructor(private readonly spec: PassFilter) {
    this.family = passFamilyModel(spec.family, spec.order, spec.Q);
  }

  response(f: number): Complex {
    const x = f / this.spec.fc;
    return this.spec.type === 'lowpass' ? this.family.lowpass(x) : this.family.highpass(x);
  }

  /** Lowpass/Highpass share this shape; only the leading word differs. Linkwitz-Riley is 4th
   *  order only, so its caption always shows n=4 — never the stored `order` — and only the User
   *  SOS family (fc/Q entered directly, not derived from a Butterworth/Bessel/LR table) states
   *  Q. */
  caption(): string {
    const label = this.spec.type === 'lowpass' ? 'Lowpass' : 'Highpass';
    const n = this.spec.family === 'linkwitzRiley' ? 4 : this.spec.order;
    const q = this.spec.family === 'sos' ? `, Q=${this.spec.Q.toFixed(3)}` : '';
    return `${label} (${this.family.label}, n=${n}, fc=${this.spec.fc.toFixed(2)} Hz${q})`;
  }

  wpr(): WprFilter {
    const {type, family, order, fc, Q, enabled} = this.spec;
    return {
      type: type === 'lowpass' ? 0 : 1,
      params: `${subtypeOf(family)};${enabled ? 1 : 0};${order};${fc};${Q}`,
    };
  }

  /** `kind` picks lowpass vs highpass (WinISD type numbers 0/1 share this one params shape:
   *  subtype;enabled;order;fc;Q). `'unsupportedSubtype'` for a measured-skip subtype code (>3);
   *  `'malformed'` for a wrong field count, a non-numeric field, or a subtype code that is
   *  neither one of the four measured ones nor measured to be skipped (negative/non-integer). */
  static fromWpr(kind: 'lowpass' | 'highpass', fields: readonly string[]): FilterSpec | 'malformed' | 'unsupportedSubtype' {
    if (fields.length !== 5) return 'malformed';
    const subtype = Number(fields[0]);
    const order = Number(fields[2]);
    const fc = Number(fields[3]);
    const Q = Number(fields[4]);
    if (!Number.isFinite(subtype) || !Number.isFinite(order) || !Number.isFinite(fc) || !Number.isFinite(Q)) {
      return 'malformed';
    }
    if (subtype > 3) return 'unsupportedSubtype';
    const family = passFamilyOf(subtype);
    if (family == null) return 'malformed';
    return {type: kind, family, order, fc, Q};
  }
}
