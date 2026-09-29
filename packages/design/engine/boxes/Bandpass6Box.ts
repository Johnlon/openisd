/**
 * 6th-order bandpass: rear chamber vented to Fr, front chamber vented to Ff, driver between them.
 */
import {cAdd, cDiv, cInv, cMul, cPar, cSub, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import {winisdLinePortReactance} from './port.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class Bandpass6Box implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, Cas, Mas, rho, c, lossMode} = q;
    const P = this.P;

    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // OpenISD's own simple model (not WinISD-captured): each chamber an ordinary vented
        // compliance with the SHARED Ql/Qa/Qp, port mass from its own tuning target (no separate
        // geometry field for a second port) — no inter-chamber leak, the same simplification
        // Bandpass4Box's own conventional branch makes by dropping Ricl.
        const rc2 = rho * c * c;
        const Qp = P.Qp || 100;

        const Cabr = P.Vb / rc2;
        const wr = 2 * Math.PI * (P.Fr ?? NaN);
        const Mapr = 1 / (wr * wr * Cabr);
        const Zportr = cAdd(cx(wr * Mapr / Qp, 0), cx(0, w * Mapr));
        const Zr = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0), cx(Qa / (w * Cabr), 0), Zportr);

        const Cabf = (P.Vf ?? NaN) / rc2;
        const wf = 2 * Math.PI * (P.Ff ?? NaN);
        const Mapf = 1 / (wf * wf * Cabf);
        const Zportf = cAdd(cx(wf * Mapf / Qp, 0), cx(0, w * Mapf));
        const Zf = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), cx(Qa / (w * Cabf), 0), Zportf);

        const Zbox = cAdd(Zr, Zf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zf, Zportf));
        const UPr = cMul(UD, cDiv(Zr, Zportr));
        const U0 = cAdd(UP, UPr);
        return {Zbox, UD, UP, U0, UPr};
      }
      case 'winisd-lossy': {
        // WinISD's 6th-order bandpass (winisd_research/GHIDRA_FINDINGS.md "6th-order bandpass —
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
        const Cabr = P.Vb / (rho * c * c);
        const Cabf = (P.Vf ?? NaN) / (rho * c * c);

        const Qlr = P.Qlr ?? NaN, Qar = P.Qar ?? NaN, Qpr = P.Qpr ?? NaN;
        const Qlf = P.Qlf ?? NaN, Qaf = P.Qaf ?? NaN, Qpf = P.Qpf ?? NaN;
        const Qiclfr = P.Qiclfr ?? NaN;
        const Fr = P.Fr ?? NaN, Ff = P.Ff ?? NaN;

        const wr = 2 * Math.PI * Fr;
        const Mapr = 1 / (wr * wr * Cabr);
        const Ralr = cx(Qlr * wr * Mapr, 0);
        const Raar = cx(wr * Mapr / Qar, 0);
        const Zcr = cAdd(Raar, cInv(cx(0, w * Cabr)));
        const RapBranchR = cAdd(cx(wr * Mapr / Qpr, 0), cx(0, P.tlPortModel ? winisdLinePortReactance(w, Mapr, P.Spr ?? NaN, P.rearPortEndCorrection_m ?? NaN, rho, c) : w * Mapr));
        const Zr = cPar(Ralr, Zcr, RapBranchR);

        const wf = 2 * Math.PI * Ff;
        const Mapf = 1 / (wf * wf * Cabf);
        const Ralf = cx(Qlf * wf * Mapf, 0);
        const Raaf = cx(wf * Mapf / Qaf, 0);
        const Zcf = cAdd(Raaf, cInv(cx(0, w * Cabf)));
        const RapBranchF = cAdd(cx(wf * Mapf / Qpf, 0), cx(0, P.tlPortModel ? winisdLinePortReactance(w, Mapf, P.Sp ?? NaN, P.portEndCorrection_m ?? NaN, rho, c) : w * Mapf));
        const Zf = cPar(Ralf, Zcf, RapBranchF);

        const ws = 1 / Math.sqrt(Mas * Cas);
        const Ricl = cx(Qiclfr * ws * Mas, 0);

        const ZrPlusZf = cAdd(Zr, Zf);
        const Zbox = cPar(Ricl, ZrPlusZf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const Ul = cMul(UD, cDiv(Zbox, ZrPlusZf));
        const UP = cMul(Ul, cDiv(Zf, RapBranchF));
        const UPr = cMul(Ul, cDiv(Zr, RapBranchR));
        const rearCompliance = cMul(Ul, cDiv(Zr, Zcr));
        const frontCompliance = cMul(Ul, cDiv(Zf, Zcf));
        const U0 = cSub(rearCompliance, frontCompliance);
        return {Zbox, UD, UP, U0, UPr};
      }
    }
  }
}
