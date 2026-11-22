import {cMul} from '../../complex.js';
import type {Complex} from '../../types.js';
import {LINKWITZ_RILEY_ORDER_LIMITS} from '../../../fields/filterLimits.js';
import type {PassFamilyModel} from './PassFamilyModel.js';
import {ButterworthFamily} from './ButterworthFamily.js';

/**
 * The Linkwitz-Riley pass family, even order n: Butterworth(n/2) squared. WinISD ignores the
 * order and always draws LR4; OpenISD honours it
 * (bugs/archive/BUG_20260927_winisd-linkwitz-riley-and-sos-ignore-order.md).
 */
export class LinkwitzRileyFamily implements PassFamilyModel {
  readonly label = 'Linkwitz-Riley';
  private readonly half: ButterworthFamily;

  constructor(order: number) {
    this.half = new ButterworthFamily(LinkwitzRileyFamily.evenOrder(order) / 2);
  }

  /** The even order an entered or loaded `order` draws: the nearest even, halves up (3 → 4), in 2..20. */
  static evenOrder(order: number): number {
    const {min, max} = LINKWITZ_RILEY_ORDER_LIMITS;
    return Math.min(max, Math.max(min, 2 * Math.round(order / 2)));
  }

  lowpass(x: number): Complex {
    const h = this.half.lowpass(x);
    return cMul(h, h);
  }

  highpass(x: number): Complex {
    const h = this.half.highpass(x);
    return cMul(h, h);
  }
}
