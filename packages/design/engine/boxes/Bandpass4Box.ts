/**
 * 4th-order bandpass: rear sealed chamber + front vented chamber.
 */
import {cAdd, cDiv, cInv, cMul, cPar, cSub, cx} from '../complex.js';
import {portImpedance} from './port.js';
import type {SweepParams} from '../types.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class Bandpass4Box implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, Cas, Mas, rho, c, lossMode} = q;
    const P = this.P;

    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // Shared per-frequency Ql/Qa/(ω·Cab) for BOTH chambers (the rear chamber's own, never
        // the front's — same shared-loss convention the other boxes' conventional branch uses).
        // Output is the front port's own current alone.
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
      case 'winisd-lossy': {
        // WinISD's 4th-order bandpass (winisd_research/GHIDRA_FINDINGS.md "4th-order bandpass —
        // `0x457a30`", bugs/BUG_20260927_bandpass4-box-not-winisd-form.md). Each chamber's OWN
        // losses, each a FIXED resistance at that chamber's own frequency — never the sweep
        // frequency, never shared between chambers, unlike the branch above:
        //   ωsc = 1/√(Mas·Cas·Cabr/(Cas+Cabr))        rear+driver sealed-form resonance
        //   Ralr = Qlr/(ωsc·Cabr)   Raar = ωsc·Mas/Qar   (series with Cabr)
        //   ωf = 2π·Ff,  Mapf = 1/(ωf²·Cabf)           front port mass FROM Ff, never Leff/Sp
        //   Ralf = Qlf·ωf·Mapf      Raaf = ωf·Mapf/Qaf   (series with Cabf)   Rap = ωf·Mapf/Qpf
        //   ωs = 1/√(Mas·Cas)                           the DRIVER's own free-air resonance
        //   Ricl = Qiclfr·ωs·Mas                         inter-chamber leak
        //   Zr = Ralr ∥ (Raar + 1/jωCabr)     Zf = Ralf ∥ (Raaf + 1/jωCabf) ∥ (Rap + jωMapf)
        //   Zx = Ricl ∥ (Zr + Zf)             the cone's own load — returned as `Zbox`
        //   Ul = UD·Zx/(Zr+Zf)                current into the (Zr+Zf) branch, off Zx
        //   Up = Ul·Zf/(Rap+jωMapf)           front port flow — returned as `UP`
        //   U0 = Up + Ul·Zf/Ralf − Ul·Zr/Ralr  port + front leak − rear leak, never port alone
        //
        // Absent Qlr/Qar/Qiclfr/Qlf/Qaf/Qpf/Ff poison every value below with NaN (`?? NaN`),
        // caught by `classifyFinite`, never a throw or a `!` — the same net the vented/PR
        // winisd-lossy branches use for their own absent Fb/Fr.
        const Cabr = P.Vb / (rho * c * c);
        const Cabf = (P.Vf ?? NaN) / (rho * c * c);

        const Qlr = P.Qlr ?? NaN, Qar = P.Qar ?? NaN, Qiclfr = P.Qiclfr ?? NaN;
        const Qlf = P.Qlf ?? NaN, Qaf = P.Qaf ?? NaN, Qpf = P.Qpf ?? NaN;
        const Ff = P.Ff ?? NaN;

        const wsc = 1 / Math.sqrt(Mas * Cas * Cabr / (Cas + Cabr));
        const Ralr = cx(Qlr / (wsc * Cabr), 0);
        const Raar = cx(wsc * Mas / Qar, 0);
        const Zr = cPar(Ralr, cAdd(Raar, cInv(cx(0, w * Cabr))));

        const wf = 2 * Math.PI * Ff;
        const Mapf = 1 / (wf * wf * Cabf);
        const Ralf = cx(Qlf * wf * Mapf, 0);
        const Raaf = cx(wf * Mapf / Qaf, 0);
        const PortBranch = cAdd(cx(wf * Mapf / Qpf, 0), cx(0, w * Mapf));
        const Zf = cPar(Ralf, cAdd(Raaf, cInv(cx(0, w * Cabf))), PortBranch);

        const ws = 1 / Math.sqrt(Mas * Cas);
        const Ricl = cx(Qiclfr * ws * Mas, 0);

        const ZrPlusZf = cAdd(Zr, Zf);
        const Zbox = cPar(Ricl, ZrPlusZf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const Ul = cMul(UD, cDiv(Zbox, ZrPlusZf));
        const UP = cMul(Ul, cDiv(Zf, PortBranch));
        const frontLeak = cMul(Ul, cDiv(Zf, Ralf));
        const rearLeak = cMul(Ul, cDiv(Zr, Ralr));
        const U0 = cSub(cAdd(UP, frontLeak), rearLeak);
        return {Zbox, UD, UP, U0};
      }
    }
  }
}
