/**
 * Passive radiator — mechanical elements referred to the acoustical domain.
 * Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
 * https://aes.org/e-lib/browse.cfm?elib=2223
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
import {cAdd, cDiv, cInv, cMul, cPar, cScale, cSub, cx} from '../complex.js';
import type {SweepParams} from '../types.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class PassiveRadiatorBox implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Zc, Ral, Raa, Ql, Qa, lossMode} = q;
    const P = this.P;

    // n_pr PRs in parallel → combined acoustic impedance = Zpr_single / n_pr. Map/Cap/Rap are
    // the radiator's own mass/compliance/loss — the same in every lossMode; only the BOX's leak
    // and absorption (Ral/Raa) and how the output is read off Zbox differ below.
    const n_pr = P.prNum || 1;
    // The domain guarantees prMmd/prSd/prCms present before a sweep (engine/params.ts
    // `solveBoxParams`); `?? NaN` narrows without a throw and matches how the vented box treats
    // a missing `P.Fb` — absent still poisons the branch with NaN, never a non-null assertion.
    const Map = ((P.prMmd ?? NaN) + (P.prMadd ?? NaN)) / ((P.prSd ?? NaN) * (P.prSd ?? NaN));
    const Cap = (P.prCms ?? NaN) * (P.prSd ?? NaN) * (P.prSd ?? NaN);
    const Rap = (P.prRms || 0) / ((P.prSd ?? NaN) * (P.prSd ?? NaN));
    const Zpr_single = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    const Zpr = n_pr > 1 ? cScale(Zpr_single, 1 / n_pr) : Zpr_single;

    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // Ral/Raa here are the same per-frequency Ql/Qa/(ω·Cab) the sealed box's own
        // conventional-lossy branch uses; for 'lossless' they are effectively absent because
        // Ql/Qa are then ≥1e6. Output is cone minus radiator (leak not split out).
        const Zbox = cPar(Zc, Ral, Raa, Zpr);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, Zpr));
        const U0 = cSub(UD, UP);
        return {Zbox, UD, UP, U0};
      }
      case 'winisd-lossy': {
        // WinISD's passive-radiator box (winisd_research/GHIDRA_FINDINGS.md "Passive radiator
        // box — `0x45a960`", bugs/BUG_20260927_passive-radiator-losses-not-winisd-form.md).
        // Leak and absorption are FIXED resistances taken at ωr = 2π·Fr — the box's OWN tuning
        // (the resonance this box and this radiator actually produce together,
        // `PassiveRadiatorBox.systemTuning_hz`), never the radiator's free-air Fs and never
        // per-frequency:
        //   Ral = Ql·ωr·Map          leak, parallel to the box (fixed)
        //   Raa = ωr·Map/Qa          absorption, in series with Cab (fixed)
        //   Zbox = Ral ∥ (Raa + 1/(jωCab)) ∥ Zpr
        // Radiated output is the Cab branch's own current — cone MINUS leak MINUS radiator, not
        // cone minus radiator alone. The box's own Qp is never used for a passive radiator (the
        // radiator's own loss Rap above already carries it, as ωp·Map/Qms_pr when the radiator's
        // own added mass Me = 0 — unverified for Me ≠ 0 or n_pr > 1, GHIDRA_FINDINGS.md same
        // section).
        //
        // `P.Fr` absent poisons every value below with NaN, exactly like an absent `Fb` does in
        // the vented box — never a throw (classifyFinite is the net that catches it).
        const Fr = P.Fr ?? NaN;
        const wr = 2 * Math.PI * Fr;
        const RalConst = cx(Ql * wr * Map, 0);
        const RaaSeries = cx(wr * Map / Qa, 0);
        const CabBranch = cAdd(RaaSeries, Zc);
        const Zbox = cPar(RalConst, CabBranch, Zpr);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, Zpr));
        const U0 = cMul(UD, cDiv(Zbox, CabBranch));
        return {Zbox, UD, UP, U0};
      }
    }
  }
}
