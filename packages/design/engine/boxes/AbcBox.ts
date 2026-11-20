/**
 * ABC (Aperiodic Bi-Chamber): rear chamber vented to Fr with the driver's back, front chamber
 * vented to Ff hangs off the rear chamber through a lossless intra-chamber port.
 */
import {cAdd, cDiv, cInv, cMul, cPar, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import {tunedChamber, winisdLossyChambers} from './port.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';
import {DEFAULT_NEW_PROJECT_QP} from '../../fields/defaults.js';

export class AbcBox implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, Cas, Mas, rho, c, loss} = q;
    const P = this.P;

    switch (loss) {
      case 'lossless': {
        // OpenISD's own simple model (not WinISD-captured), taken only when every loss Q is at the
        // lossless limit (circuit.ts `boxLoss`): each chamber an ordinary vented compliance with the
        // SHARED Ql/Qa and its own port's Qpr/Qpf, port mass from its own tuning target. The intra port itself
        // stays (Rai = 0 is a physical fact of this topology, not a loss-Q setting to drop) but
        // without Ricl, the same "no inter-chamber leak" simplification.
        const Qp = P.Qp || DEFAULT_NEW_PROJECT_QP;

        const {Cab: Cabr, w0: wr, Map: Mapr, Zport: RapBranchR} = tunedChamber(P.Vb, P.Fr ?? NaN, rho, c, w, P.Qpr ?? Qp);
        const Zcr = cAdd(cx(wr * Mapr / Qa, 0), cInv(cx(0, w * Cabr)));
        const Zr = cPar(cx(wr * Mapr * Ql, 0), Zcr, RapBranchR);

        const {Cab: Cabf, w0: wf, Map: Mapf, Zport: RapBranchF} = tunedChamber(P.Vf ?? NaN, P.Ff ?? NaN, rho, c, w, P.Qpf ?? Qp);
        const Zcf = cAdd(cx(wf * Mapf / Qa, 0), cInv(cx(0, w * Cabf)));
        const Zf = cPar(cx(wf * Mapf * Ql, 0), Zcf, RapBranchF);

        const Mai = rho * (P.LeffIntra ?? NaN) / (P.SpIntra ?? NaN);
        const jwMai = cx(0, w * Mai);
        const ZiPlusZf = cAdd(jwMai, Zf);
        const Zbox = cPar(Zr, ZiPlusZf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const V = cMul(UD, Zbox);
        const Vf = cMul(V, cDiv(Zf, ZiPlusZf));
        const UP = cDiv(Vf, RapBranchF);
        const UPr = cDiv(V, RapBranchR);
        const U0 = cAdd(cDiv(Vf, Zcf), cDiv(V, Zcr));
        return {Zbox, UD, UP, U0, UPr};
      }
      case 'winisd-lossy': {
        // WinISD's ABC box (winisd_research/archive/GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber) —
        // `0x4591b0`", captured runs/abc-w5-1). Both chambers exactly as `Bandpass6Box`'s own
        // `winisd-lossy` branch — same tuning-based losses, same inter-chamber Ricl at the
        // driver's own ωs — but the driver's back sits in the REAR chamber directly (Zr a
        // straight shunt off the box-load node) and the front chamber hangs off it through a
        // LOSSLESS intra-chamber port (Rai = 0):
        //   Zr, Zf as `Bandpass6Box`
        //   Mai = ρ·LeffIntra/SpIntra           the intra port's own mass, from its LENGTH —
        //                                       never from a tuning target, unlike the front/rear
        //   Zi = Ricl ∥ jωMai                   the correct load impedance (Ricl included)
        //   Zx = Zr ∥ (Zi+Zf)                   the cone's own load — returned as `Zbox`
        //   V  = UD·Zx                          pressure at the rear-chamber node
        //   Vf = V·Zf/(Zi+Zf)                   pressure after the intra-port divider
        //   Up  = Vf/(Rapf+jωMapf)              front port flow — returned as `UP`
        //   Upr = V/(Rapr+jωMapr)               rear port flow — returned as `UPr` (straight
        //                                       V/Zpr: Zr is a direct shunt off V, unlike
        //                                       `Bandpass6Box` where Zr is in series with Zf)
        //   Upi = V/[jωMai + Zf·(1 + jωMai/Ricl)]
        //                                       the current through the intra port's mass alone
        //                                       (returned as `UPi`): Ricl is the leak AROUND the
        //                                       port, so its current is not port flow.
        //                                       `winisdAbcIntraPortVelocity` on (the default, and
        //                                       where the flag is absent): V/(jωMai + Zf),
        //                                       WinISD's chart-21 form, which omits the term
        //                                       Zf·jωMai/Ricl (winisd_research/archive/GHIDRA_FINDINGS.md,
        //                                       winisd_research/archive/PROBE_FINDINGS.md abc velocity self-consistency).
        //   U0 = Vf/(Raaf+1/jωCabf) + V/(Raar+1/jωCabr)
        //        the SUM of the two compliance currents — captured to 1.6e-15, no sign
        //        correction needed (unlike `Bandpass6Box`'s own transfer).
        //
        // Absent Qlr/Qar/Qpr/Qiclfr/Qlf/Qaf/Qpf/Fr/Ff/LeffIntra/SpIntra poison every value below
        // with NaN (`?? NaN`), caught by `classifyFinite`, never a throw or a `!`.
        const {Zr, Zcr, RapBranchR, Zf, Zcf, RapBranchF, Ricl} = winisdLossyChambers(P, w, Cas, Mas, rho, c);

        const Mai = rho * (P.LeffIntra ?? NaN) / (P.SpIntra ?? NaN);
        const jwMai = cx(0, w * Mai);
        const Zi = cPar(Ricl, jwMai);

        const ZiPlusZf = cAdd(Zi, Zf);
        const Zbox = cPar(Zr, ZiPlusZf);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const V = cMul(UD, Zbox);
        const Vf = cMul(V, cDiv(Zf, ZiPlusZf));
        const UP = cDiv(Vf, RapBranchF);
        const UPr = cDiv(V, RapBranchR);
        const UPi = cDiv(V, P.winisdAbcIntraPortVelocity !== false ? cAdd(jwMai, Zf) : cAdd(jwMai, cMul(Zf, cAdd(cx(1, 0), cDiv(jwMai, Ricl)))));
        const U0 = cAdd(cDiv(Vf, Zcf), cDiv(V, Zcr));
        return {Zbox, UD, UP, U0, UPr, UPi};
      }
    }
  }
}
