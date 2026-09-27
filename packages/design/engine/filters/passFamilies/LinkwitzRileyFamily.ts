import {cMul} from '../../complex.js';
import type {Complex} from '../../types.js';
import type {PassFamilyModel} from './PassFamilyModel.js';
import {ButterworthFamily} from './ButterworthFamily.js';

/**
 * WinISD's Linkwitz-Riley pass family — always the underlying Butterworth order 2, squared. The
 * Filter Editor's `order` field is kept (it round-trips through the `.wpr`) but ignored here,
 * same as WinISD.
 */
export class LinkwitzRileyFamily implements PassFamilyModel {
  readonly label = 'Linkwitz-Riley';
  private readonly butterworth2 = new ButterworthFamily(2);

  lowpass(x: number): Complex {
    const h2 = this.butterworth2.lowpass(x);
    return cMul(h2, h2);
  }

  highpass(x: number): Complex {
    const h2 = this.butterworth2.highpass(x);
    return cMul(h2, h2);
  }
}
