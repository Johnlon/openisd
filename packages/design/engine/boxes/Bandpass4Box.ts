/**
 * 4th-order bandpass: rear sealed chamber + front vented chamber. Unlike the other three
 * topologies this one has no lossMode switch — WinISD gives it a single form regardless of
 * lossMode (pre-existing behaviour, not something this class adds).
 */
import {cAdd, cDiv, cInv, cMul, cPar, cx} from '../complex.js';
import {portImpedance} from './port.js';
import type {SweepParams} from '../types.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class Bandpass4Box implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, rho, c} = q;
    const P = this.P;

    const Cabr   = P.Vb / (rho * c * c);
    const Zr     = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0), cx(Qa / (w * Cabr), 0));
    // The domain guarantees Vf present before a sweep (engine/params.ts `solveBoxParams`);
    // `?? NaN` narrows without a throw, matching the vented box's `P.Fb` treatment.
    const Cabf   = (P.Vf ?? NaN) / (rho * c * c);
    const Zportf = portImpedance(w, P);
    const Zf     = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), cx(Qa / (w * Cabf), 0), Zportf);
    const Zbox = cAdd(Zr, Zf);
    const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    const UP = cMul(UD, cDiv(Zf, Zportf));
    const U0 = UP;
    return {Zbox, UD, UP, U0};
  }
}
