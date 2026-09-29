/**
 * ABC (Aperiodic Bi-Chamber): rear chamber vented to Fr with the driver's back, front chamber
 * vented to Ff hangs off the rear chamber through a lossless intra-chamber port.
 */
import {cAdd, cDiv, cInv, cMul, cPar, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import {winisdLinePortReactance} from './port.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class AbcBox implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Ql, Qa, Cas, Mas, rho, c, lossMode} = q;
    const P = this.P;

    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // OpenISD's own simple model (not WinISD-captured): each chamber an ordinary vented
        // compliance with the SHARED Ql/Qa/Qp, port mass from its own tuning target, same
        // simplification `Bandpass6Box`'s own conventional branch makes. The intra port itself
        // stays (Rai = 0 is a physical fact of this topology, not a loss-Q setting to drop) but
        // without Ricl, the same "no inter-chamber leak" simplification.
        const rc2 = rho * c * c;
        const Qp = P.Qp || 100;

        const Cabr = P.Vb / rc2;
        const wr = 2 * Math.PI * (P.Fr ?? NaN);
        const Mapr = 1 / (wr * wr * Cabr);
        const RapBranchR = cAdd(cx(wr * Mapr / Qp, 0), cx(0, w * Mapr));
        const Zcr = cAdd(cx(wr * Mapr / Qa, 0), cInv(cx(0, w * Cabr)));
        const Zr = cPar(cx(wr * Mapr * Ql, 0), Zcr, RapBranchR);

        const Cabf = (P.Vf ?? NaN) / rc2;
        const wf = 2 * Math.PI * (P.Ff ?? NaN);
        const Mapf = 1 / (wf * wf * Cabf);
        const RapBranchF = cAdd(cx(wf * Mapf / Qp, 0), cx(0, w * Mapf));
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
        // WinISD's ABC box (winisd_research/GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber) —
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
        //   Upi = V/(jωMai + Zf)                WinISD's OWN chart-21 form for the intra port's
        //                                       own velocity — Ricl left OUT and Zi swapped for
        //                                       bare jωMai, a WinISD wart kept by default
        //                                       (returned as `UPi`; the load `Zx` above and every
        //                                       other chart still use the correct Zi).
        //   U0 = Vf/(Raaf+1/jωCabf) + V/(Raar+1/jωCabr)
        //        the SUM of the two compliance currents — captured to 1.6e-15, no sign
        //        correction needed (unlike `Bandpass6Box`'s own transfer).
        //
        // Absent Qlr/Qar/Qpr/Qiclfr/Qlf/Qaf/Qpf/Fr/Ff/LeffIntra/SpIntra poison every value below
        // with NaN (`?? NaN`), caught by `classifyFinite`, never a throw or a `!`.
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
        const UPi = cDiv(V, cAdd(jwMai, Zf));
        const U0 = cAdd(cDiv(Vf, Zcf), cDiv(V, Zcr));
        return {Zbox, UD, UP, U0, UPr, UPi};
      }
    }
  }
}
