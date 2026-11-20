/**
 * 6th-order bandpass: rear chamber vented to Fr, front chamber vented to Ff, driver between them.
 */
import {cAdd, cDiv, cInv, cMul, cPar, cSub, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import {tunedChamber, winisdLossyChambers, seriesChambersWithLeak} from './port.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';
import {DEFAULT_NEW_PROJECT_QP} from '../../fields/defaults.js';

export class Bandpass6Box implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, Cas, Mas, rho, c, loss} = q;
    const P = this.P;

    switch (loss) {
      case 'lossless': {
        // OpenISD's own simple model (not WinISD-captured), taken only when every loss Q is at the
        // lossless limit (circuit.ts `boxLoss`): each chamber an ordinary vented compliance with the
        // SHARED Ql/Qa and its own port's Qpr/Qpf, port mass from its own tuning target (no separate
        // geometry field for a second port) — no inter-chamber leak (Ricl dropped).
        const Qp = P.Qp || DEFAULT_NEW_PROJECT_QP;

        const {Cab: Cabr, Zport: Zportr} = tunedChamber(P.Vb, P.Fr ?? NaN, rho, c, w, P.Qpr ?? Qp);
        const Zr = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0), cx(Qa / (w * Cabr), 0), Zportr);

        const {Cab: Cabf, Zport: Zportf} = tunedChamber(P.Vf ?? NaN, P.Ff ?? NaN, rho, c, w, P.Qpf ?? Qp);
        const Zf = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), cx(Qa / (w * Cabf), 0), Zportf);

        const Zbox = cAdd(Zr, Zf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zf, Zportf));
        const UPr = cMul(UD, cDiv(Zr, Zportr));
        // Front port minus rear port: the rear compliance current minus the front one, as the lossy branch.
        const U0 = cSub(UP, UPr);
        return {Zbox, UD, UP, U0, UPr};
      }
      case 'winisd-lossy': {
        // WinISD's 6th-order bandpass (winisd_research/archive/GHIDRA_FINDINGS.md "6th-order bandpass —
        // `0x5668c0`", captured runs/bp6-w5-1). Each chamber a vented box in its own right, at
        // its own tuning, exactly the loss form `VentedBox`'s own `winisd-lossy` branch uses —
        // twice, once per chamber, plus the inter-chamber leak Ricl at the DRIVER's own ωs:
        //   ωr = 2π·Fr   Mapr = 1/(ωr²·Cabr)
        //   Ralr = Qlr·ωr·Mapr   Raar = ωr·Mapr/Qar   Rapr = ωr·Mapr/Qpr
        //   ωf = 2π·Ff   Mapf = 1/(ωf²·Cabf)
        //   Ralf = Qlf·ωf·Mapf   Raaf = ωf·Mapf/Qaf   Rapf = ωf·Mapf/Qpf
        //   ωs = 1/√(Mas·Cas)    Ricl = Qiclfr·ωs·Mas
        //   Zr = Ralr ∥ (Raar + 1/jωCabr) ∥ (Rapr + jωMapr)
        //   Zf = Ralf ∥ (Raaf + 1/jωCabf) ∥ (Rapf + jωMapf)
        //   Zx = Ricl ∥ (Zr + Zf)             the cone's own load — returned as `Zbox`
        //   Ul = UD·Zx/(Zr+Zf)                current into the (Zr+Zf) branch, off Zx
        //   Up = Ul·Zf/(Rapf+jωMapf)          front port flow — returned as `UP`
        //   Upr = Ul·Zr/(Rapr+jωMapr)         rear port flow — returned as `UPr`
        //   U0 = Ul·Zr/(Raar+1/jωCabr) − Ul·Zf/(Raaf+1/jωCabf)
        //        the REAR compliance current minus the front one — captured (worst error 3.5e-13,
        //        where the two currents cancel); the static decode read the opposite sign
        //        (front − rear) before capture correction it.
        //
        // Absent Qlr/Qar/Qpr/Qiclfr/Qlf/Qaf/Qpf/Fr/Ff poison every value below with NaN
        // (`?? NaN`), caught by `classifyFinite`, never a throw or a `!` — the same net the
        // vented/PR/bandpass4 `winisd-lossy` branches use for their own absent tuning fields.
        const ch = winisdLossyChambers(P, w, Cas, Mas, rho, c);
        const {Zbox, UD, Ul} = seriesChambersWithLeak(ch.Zr, ch.Zf, ch.Ricl, pg, ZaE, ZaD);
        const UP = cMul(Ul, cDiv(ch.Zf, ch.RapBranchF));
        const UPr = cMul(Ul, cDiv(ch.Zr, ch.RapBranchR));
        const rearCompliance = cMul(Ul, cDiv(ch.Zr, ch.Zcr));
        const frontCompliance = cMul(Ul, cDiv(ch.Zf, ch.Zcf));
        const U0 = cSub(rearCompliance, frontCompliance);
        return {Zbox, UD, UP, U0, UPr};
      }
    }
  }
}
