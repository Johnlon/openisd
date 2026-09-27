import {cDiv, cInv, cx} from '../../complex.js';
import type {Complex} from '../../types.js';
import type {PassFamilyModel} from './PassFamilyModel.js';

/** Plain 2nd-order LP/HP with Q, order ignored — WinISD's "User SOS" subtype. */
export class SosFamily implements PassFamilyModel {
  readonly label = 'User SOS';
  constructor(private readonly Q: number) {}

  /** LP 1/(s²+s/Q+1), at normalised s = j·x. */
  lowpass(x: number): Complex {
    return cInv(cx(1 - x * x, x / this.Q));
  }

  /** HP s²/(s²+s/Q+1), at normalised s = j·x. */
  highpass(x: number): Complex {
    return cDiv(cx(-x * x, 0), cx(1 - x * x, x / this.Q));
  }
}
