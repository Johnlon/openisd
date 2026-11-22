/**
 * Sealed box — lossless, or WinISD's lossy model, on the box's own compliance Cab.
 * Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
 * https://aes.org/e-lib/browse.cfm?elib=2062
 */
import {cAdd, cDiv, cMul, cPar, cSub, cx} from '../complex.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class SealedBox implements BoxModel {
  solve(q: DriverSideQuantities): BoxOutput {
    const {pg, ZaE, ZaD, Zc, Cab, Cas, Mas, Ql, Qa, loss} = q;
    const zero = cx(0, 0);

    switch (loss) {
      case 'lossless': {
        const Zbox = Zc;
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        return {Zbox, UD, UP: zero, U0: UD};
      }
      case 'winisd-lossy': {
        const Cat = (Cas * Cab) / (Cas + Cab);
        const wsc = 1 / Math.sqrt(Cat * Mas);
        const RalConst = cx(Ql / (wsc * Cab), 0);
        // WinISD's absorption: ωsc·Mas/Qa in series with Cab (BUG_20260926_winisd-box-absorption-is-series).
        const RaaSeries = cx(wsc * Mas / Qa, 0);
        const Zbox = cPar(RalConst, cAdd(RaaSeries, Zc));
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const Uleak = cMul(UD, cDiv(Zbox, RalConst));
        const U0 = cSub(UD, Uleak);
        return {Zbox, UD, UP: zero, U0};
      }
    }
  }
}
