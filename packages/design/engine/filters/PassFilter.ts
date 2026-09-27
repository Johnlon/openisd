import type {Complex, FilterSpec, PassFamily} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import type {PassFamilyModel} from './passFamilies/PassFamilyModel.js';
import {ButterworthFamily} from './passFamilies/ButterworthFamily.js';
import {LinkwitzRileyFamily} from './passFamilies/LinkwitzRileyFamily.js';
import {BesselFamily} from './passFamilies/BesselFamily.js';
import {SosFamily} from './passFamilies/SosFamily.js';

type Spec = Extract<FilterSpec, {type: 'lowpass' | 'highpass'}>;

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

/**
 * WinISD's Lowpass/Highpass Filter Editor types — one class for both, since they differ only in
 * which side of their `PassFamilyModel` strategy they read, at normalised s = j·(f/fc).
 */
export class PassFilter implements FilterModel {
  private readonly family: PassFamilyModel;

  constructor(private readonly spec: Spec) {
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
}
