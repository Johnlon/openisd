/**
 * Vented box — a port branch in parallel with the box compliance.
 * Small, R.H. "Vented-Box Loudspeaker Systems — Part I." JAES 21(5) 1973.
 * https://aes.org/e-lib/browse.cfm?elib=2149
 */
import {cAdd, cDiv, cMul, cPar, cSub, cx} from '../complex.js';
import {portImpedance} from './port.js';
import type {SweepParams} from '../types.js';
import type {BoxModel, BoxOutput, DriverSideQuantities} from './BoxModel.js';

export class VentedBox implements BoxModel {
  constructor(private readonly P: SweepParams) {}

  solve(q: DriverSideQuantities): BoxOutput {
    const {w, pg, ZaE, ZaD, Zc, Cab, Ral, Raa, Ql, Qa, lossMode} = q;
    const P = this.P;

    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // Port branch — lumped mass Map = ρ·Leff/Sp (Leff = L + END_CORRECTION·d), or a
        // transmission line when P.tlPortModel is set. See portImpedance(). Ral/Raa are the
        // same per-frequency Ql/Qa/(ω·Cab) the sealed box's own conventional-lossy branch uses;
        // for 'lossless' they are effectively absent because Ql/Qa are then ≥1e6.
        // https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
        const Zport = portImpedance(w, P);
        const Zbox = cPar(Zc, Ral, Raa, Zport);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, Zport));
        const U0 = cSub(UD, UP);
        return {Zbox, UD, UP, U0};
      }
      case 'winisd-lossy': {
        // WinISD's vented box (winisd_research/GHIDRA_FINDINGS.md "Vented box — `0x456800`",
        // bugs/BUG_20260927_vented-box-losses-not-winisd-form.md). Every loss is a FIXED
        // resistance taken at ωb = 2π·Fb — the box's TUNING, never the vent's own length or
        // area — unlike the branch above, whose Map/Rap are per-frequency and length-derived:
        //   Map = 1/(ωb²·Cab)                 the vent's geometry is not read at all
        //   Ral = Ql/(ωb·Cab)                  leak, parallel to the box (fixed)
        //   Raa = ωb·Map/Qa                    absorption, in series with Cab (fixed)
        //   Rap = ωb·Map/Qp                    port loss, in series with Map (fixed)
        //   Zbox = Ral ∥ (Raa + 1/(jωCab)) ∥ (Rap + jωMap)
        // Radiated output is the Cab branch's own current — cone MINUS leak MINUS port, not
        // cone minus port alone. `P.tlPortModel` is a conventional-branch-only option: WinISD's
        // own port here is always this lumped Map, never a transmission line.
        //
        // `P.Fb` absent poisons every value below with NaN, exactly like an absent `Leff`/`Sp`
        // does in the branch above (engine/params.ts's own doc: this solve divides by its inputs
        // unguarded, and `classifyFinite` is the net that catches it) — never a throw, so the
        // engine keeps its no-throw contract whether or not a domain guard ran in front of it
        // (test/engine/hardening.test.ts "the engine's own net still classifies...").
        const Fb = P.Fb ?? NaN;
        const wb = 2 * Math.PI * Fb;
        const Map = 1 / (wb * wb * Cab);
        const Qp = P.Qp || 100;
        const RalConst = cx(Ql / (wb * Cab), 0);
        const RaaSeries = cx(wb * Map / Qa, 0);
        const RapSeries = cx(wb * Map / Qp, 0);
        const CabBranch = cAdd(RaaSeries, Zc);
        const PortBranch = cAdd(RapSeries, cx(0, w * Map));
        const Zbox = cPar(RalConst, CabBranch, PortBranch);
        const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const UP = cMul(UD, cDiv(Zbox, PortBranch));
        const U0 = cMul(UD, cDiv(Zbox, CabBranch));
        return {Zbox, UD, UP, U0};
      }
    }
  }
}
