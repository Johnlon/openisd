/**
 * Thiele-Small driver parameter derivation.
 *
 * Equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Authoritative source (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
 *
 * WinISD .wdr parse/serialise and ParState provenance live in @openisd/winisd, not
 * here — this module is pure physics with no file-format concern (ARCHITECTURE.md AD-6).
 */

import {G_STANDARD, P0} from './constants.js';
import type {Wiring} from './types.js';
import type {Air} from './air.js';
import {DEFAULT_P_REF_PA, GAMMA, solveEnvironment} from './air.js';
import {
    efficiencyConstant,
    efficiencyFromSpl,
    motorEfficiency,
    referenceEfficiency,
    splFromEfficiency
} from './efficiency.js';
import {
    ebp,
    prFsWithMass,
    prMassForFp,
    prTuning,
    sealedFromQtc,
    sealedQtcFromVolume,
    tuningFromLength,
    ventLength
} from './boxDesign.js';
import {depthFromDims, dvolFromDims, magDepthFromDims, magnetFromDims} from './dvolRelation.js';
import {LossMode, sealedResonance} from './lossMode.js';
import type {
    DriverSolverParams,
    PrSolverParams,
    SealedAlignmentSolverParams,
    SolverField,
    SolverInput,
    VentSolverParams
} from './solverTypes.js';
import type {CalculationIssue, CalculationPrerequisite, OutOfRangeIssue, TargetUnreachableIssue} from './consistency.js';
import {checkRange} from './physicalRange.js';

// S2-10 (T10/T3-style trim): the bag types every solve used to take/return, PRIVATE now — a
// caller reaches every one of these quantities through a `SolverField` handle
// (`solveDriver`/`solvePr`/`solveVent`/`solveSealedAlignment`), never through a snapshot bag.
// Kept as a plain WORKING SET only where the arithmetic genuinely needs one (an iterative
// fixpoint, a group of relations feeding each other) — never exported past this file.
interface DriverWorkingSet {
    Fs_hz?: number; Re_ohm?: number; Znom_ohm?: number; Le_H?: number; fLe_hz?: number;
    KLe_H_sqrtHz?: number; Qes?: number; Qms?: number; Qts?: number; Vas_m3?: number;
    Sd_m2?: number; Dd_m?: number; BL_Tm?: number; Mms_kg?: number; Cms_m_per_N?: number;
    Rms_kg_per_s?: number; EBP_hz?: number; Xmax_m?: number; Vd_m3?: number; Hc_m?: number;
    Hg_m?: number; Pe_W?: number; no?: number; SPLref_dB?: number; SPL_dB?: number;
    USPL_dB?: number; SPLmax_dB?: number; SPLmaxLF_dB?: number; Rme_kg_per_s?: number;
    Mpow_N_per_sqrtW?: number; Mcost_kg_per_s?: number; gamma_m_per_s2_A?: number;
    Gloss?: number; Vcd_m?: number; Depth_m?: number; MagDepth_m?: number;
    Magnet_m?: number; DVol_m3?: number; c_m_per_s?: number; roo_kg_per_m3?: number;
    Re_terminal_ohm?: number; BL_terminal_Tm?: number; numVC?: number;
    wiring?: Wiring;
}

interface SealedAlignmentWorkingSet {
    Qts?: number;
    Vas_m3?: number;
    Qtc?: number;
    Vb_m3?: number;
}

export type DriverQuantityName = keyof DriverSolverParams;
export type DriverIssue = CalculationIssue<DriverQuantityName> | OutOfRangeIssue;
export type DriverPrerequisite = CalculationPrerequisite<DriverQuantityName>;
export type VentQuantityName = keyof VentSolverParams;
export type VentIssue = CalculationIssue<VentQuantityName> | TargetUnreachableIssue;
export type PrQuantityName = keyof PrSolverParams;
export type PrIssue = CalculationIssue<PrQuantityName> | TargetUnreachableIssue;
export type SealedAlignmentQuantityName = keyof SealedAlignmentSolverParams;
export type SealedAlignmentIssue = CalculationIssue<SealedAlignmentQuantityName>;


/**
 * A driver record's own speed of sound — matches WinISD's own resolution rule
 * (`docs/design/WINISD_SCHEMA.md` §12): the record's stated `c`; else recomputed from its
 * stated `roo` via `c = √(γ·p/roo)`; else the live physical model at the reference
 * environment. Never a stored constant — WinISD has none either.
 */
function driverC(r: Readonly<DriverWorkingSet>): number {
  if (r.c_m_per_s != null && r.c_m_per_s > 0) return r.c_m_per_s;
  if (r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0) return Math.sqrt(GAMMA * DEFAULT_P_REF_PA / r.roo_kg_per_m3);
  return solveEnvironment({}).values.c;
}

/**
 * A driver record's own air density — its stated `roo`, else the live physical model at the
 * reference environment. WinISD never recomputes a missing `roo` from `c` — matched here.
 */
function driverRho(r: Readonly<DriverWorkingSet>): number {
  return r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0 ? r.roo_kg_per_m3 : solveEnvironment({}).values.rho;
}

/**
 * WinISD's nominal impedance, CALCULATED from the DC resistance:
 *
 *     Znom = 2 · round_half_to_even(0.75 · Re)
 *
 * Recovered exactly (18/18, integer agreement) from 21 probes of real WinISD — ledger QO30,
 * `winisd_research/runs/znom_state.jsonl`. `Znom` follows `Re` alone: a driver written with
 * `Re = 8` beside `Qes`/`Qts`/`Rms` describing `Re = 27` still gets 12, and a *derived* `Re`
 * serves as input just as well as an entered one. `Re = 0.6` yields a COMPUTED zero, which is
 * why the caller writes 0 rather than treating it as "no answer".
 *
 * ⚠ THE PRODUCT IS EVALUATED EXACTLY, AND THAT IS LOAD-BEARING. WinISD is Delphi and computes
 * in 80-bit Extended, where `0.75·Re` never needs rounding. In a double it does: `0.75·Re` is
 * `3·Re/4`, whose exact value needs up to 55 mantissa bits against a double's 53. On two probed
 * values the rounding lands the product exactly ON the `.5` tie and flips the answer —
 * `Re = 7.333333333333333` (exactly 5.49999999999999975, so 5 → 10, while the double product is
 * 5.5 → 12) and `Re = 3.3333333333333335` (2.500000000000000125, so 3 → 6, while the double
 * product is 2.5 → 4). So the product is carried as an unevaluated pair `hi + lo`: `Re/2` and
 * `Re/4` are each exact (binary scaling), and a two-sum recovers the residual their addition
 * discards. `frac` is a multiple of `ulp(hi)` while `|lo| ≤ ulp(hi)/2`, so `lo` can only ever
 * BREAK a true tie — it can neither manufacture nor destroy one.
 */
export function nominalImpedance(Re: number): number {
  if (!(Re > 0) || !isFinite(Re)) return NaN;

  const a = Re / 2, b = Re / 4;
  const hi = a + b;
  const t  = hi - a;
  const lo = (a - (hi - t)) + (b - t);   // exact: hi + lo === a + b, for any doubles a, b

  const fl = Math.floor(hi);
  const frac = hi - fl;                  // exact — floor never costs a mantissa bit
  const n = frac > 0.5 ? fl + 1
          : frac < 0.5 ? fl
          : lo   > 0   ? fl + 1
          : lo   < 0   ? fl
          : (fl % 2 === 0 ? fl : fl + 1);  // a genuine tie: round half to EVEN
  return 2 * n;
}

/**
 * Solve every derivable Thiele/Small field from whatever is already present in `d`,
 * without requiring a complete set — an entered (non-null) value is NEVER overwritten
 * (WinISD's fixed-E override semantics). This is the ONE place these formulas exist;
 * Callers that need partial/progressive derivation (an in-progress edit, not yet complete
 * enough to simulate — e.g. the live driver editor) call this directly instead of
 * reimplementing any of it.
 *
 * All equations: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Vas = ρ · c² · Sd² · Cms   →   Cms = Vas / (ρ · c² · Sd²)
 *   Mms = 1 / (ωs² · Cms)        from  ωs = 1/√(Mms · Cms)
 *   Rms = 2π · Fs · Mms / Qms
 *   Bl  = √(2π · Fs · Mms · Re / Qes)
 *
 * Two passes: a later formula (e.g. Fs from Mms+Cms) can unlock an earlier block
 * (Cms's own downstream chain) on the next iteration.
 *
 * The η₀/SPLref/USPL reference-efficiency chain is solved here too, entirely through
 * `efficiency.ts` — the single implementation of η₀ and of the SPL constant derived from
 * the air in use (`driverC`/`driverRho`). η₀ is a FRACTION throughout; the percent lives in
 * the display layer only.
 */
function solveConsistencyGroup(p: DriverWorkingSet): DriverWorkingSet {
  // The result is a SUPERSET of the input: every quantity handed in comes back out, plus what
  // the solver derived. `numVC` and `wiring` ride along untouched — the solver READS them, to
  // finish the terminal values below, and never consumes them; dropping them would make
  // re-solving a result lossy.
  const r: DriverWorkingSet = { ...p };


  const TAU = 2 * Math.PI;


  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;

    const setVal = <K extends keyof DriverWorkingSet>(key: K, val: DriverWorkingSet[K]) => {
      if (r[key] == null && typeof val === 'number' && isFinite(val) && val > 0) {
        r[key] = val;
        changed = true;
      }
    };

    // 1. Sd <-> Dd
    if (r.Sd_m2 == null && r.Dd_m != null && r.Dd_m > 0) setVal('Sd_m2', Math.PI * (r.Dd_m / 2) ** 2);
    if (r.Dd_m == null && r.Sd_m2 != null && r.Sd_m2 > 0) setVal('Dd_m', 2 * Math.sqrt(r.Sd_m2 / Math.PI));

    // 2. Qts, Qes, Qms parallel
    if (r.Qts == null && r.Qes != null && r.Qms != null) setVal('Qts', r.Qes * r.Qms / (r.Qes + r.Qms));
    if (r.Qes == null && r.Qts != null && r.Qms != null && r.Qms > r.Qts) setVal('Qes', r.Qts * r.Qms / (r.Qms - r.Qts));
    if (r.Qms == null && r.Qts != null && r.Qes != null && r.Qes > r.Qts) setVal('Qms', r.Qts * r.Qes / (r.Qes - r.Qts));

    // 3. Fs — WinISD's five routes, tried in WinISD's own priority order
    // (`docs/design/WINISD_SCHEMA.md` §4.3, `winisd_research/RE_GHIDRA_FINDINGS.md` "Fs
    // priority settled STATICALLY" / "CONFIRMED in the UI"). WinISD's own calculation engine
    // is ONE linear sequence of guarded blocks re-run to a fixpoint (`mov bl,1` / `test
    // bl,bl; jne` in the disassembly) — address order is evaluation order, and EVERY block
    // re-tests its target field for still-unset before writing it, so once any block sets
    // `Fs` in a pass, every later block (this pass and every pass after) is permanently
    // skipped, even a higher-priority one whose OWN inputs only become ready later. This is
    // matched exactly here: `setVal` only writes a null field, so within one pass the
    // earliest-listed ready route wins, and the loser is never revisited once `Fs` is set —
    // not "the priority order always wins", but "the priority order wins races that are
    // still live when this pass reaches them". A route whose inputs are still being derived
    // (e.g. rel 11's `Cms`, computed in block 4 below, AFTER this block runs) can lose to a
    // lower-priority route that was ready first — proven in WinISD itself by the `Cms`
    // compute site (`0x45f6f7`, `winisd_research/scripts/relation_routes.py:40`) sitting
    // AFTER the rel 11 Fs guard (`0x45f0d6`,
    // `winisd_research/RE_GHIDRA_FINDINGS.md` "Fs priority settled STATICALLY") in address
    // order, and pinned here by the "rel 2 locks out a not-yet-ready rel 11" test below.
    // WinISD has no route deriving Fs from Rms/Qms/Mms; that direction is deliberately
    // absent (see block 5 below).
    if (r.Fs_hz == null && r.Mms_kg != null && r.Cms_m_per_N != null) {
      setVal('Fs_hz', 1 / (TAU * Math.sqrt(r.Mms_kg * r.Cms_m_per_N)));                                  // rel 11
    }
    if (r.Fs_hz == null && r.no != null && r.Qes != null && r.Vas_m3 != null && r.Vas_m3 > 0 && r.no > 0) {
      setVal('Fs_hz', Math.pow((r.no * r.Qes) / (efficiencyConstant(driverC(r)) * r.Vas_m3), 1 / 3)); // rel 14
    }
    if (r.Fs_hz == null && r.Qes != null && r.BL_Tm != null && r.Mms_kg != null && r.Re_ohm != null && r.Mms_kg > 0 && r.Re_ohm > 0) {
      setVal('Fs_hz', r.Qes * r.BL_Tm * r.BL_Tm / (TAU * r.Mms_kg * r.Re_ohm));                            // rel 2
    }
    if (r.Fs_hz == null && r.Rme_kg_per_s != null && r.Qes != null && r.Mms_kg != null && r.Mms_kg > 0) {
      setVal('Fs_hz', r.Rme_kg_per_s * r.Qes / (TAU * r.Mms_kg));                                         // rel 4
    }
    if (r.Fs_hz == null && r.EBP_hz != null && r.Qes != null) {
      setVal('Fs_hz', r.EBP_hz * r.Qes);                                                         // rel 12
    }

    // 3b. Mms from Fs and Cms — the reverse direction, unaffected by which Fs route fired.
    if (r.Mms_kg == null && r.Fs_hz != null && r.Cms_m_per_N != null) setVal('Mms_kg', 1 / ((TAU * r.Fs_hz) ** 2 * r.Cms_m_per_N));

    // 4. Vas, Cms, Sd, no — evaluation order per WinISD's relation sites
    //    (winisd_research/scripts/relation_routes.py): the Cms/Sd reversals (0x45f6f7, 0x45f74f)
    //    run before the `no` sites (0x45fb67 rel 14, 0x45fc3b rel 15, 0x45fce6 rel 18), and Vas
    //    rel 14 (0x45fdd8) before Vas rel 10 (0x45fe70). Proven live by
    //    probe_vas_route_precedence.py (FINDING-027/028): a cleared Vas refills through the
    //    efficiency group first and only falls to the compliance group when `no` is underivable.

    // 🔒 Cms has TWO routes, and the ORDER matters — the same shape as the Rme precedence below.
    // The GEOMETRY route wins: Cms from Vas and Sd, not from Fs and Mms. John tested this against
    // real WinISD (2026-09-01) and it prefers Sd/Vas.
    //
    // It decides who gets blamed for a contradiction, which is the point. A driver whose stated
    // Mms cannot be true resolves its compliance from the geometry, so the impossible Mms then
    // disagrees with the Fs/Mms/Cms group — the fields the user actually typed. Letting Fs/Mms
    // win instead would rewrite Cms from the bad value and report the contradiction against Vas,
    // Cms and Sd, three fields nobody touched.
    if (r.Cms_m_per_N == null && r.Vas_m3 != null && r.Sd_m2 != null && r.Sd_m2 > 0) setVal('Cms_m_per_N', r.Vas_m3 / (driverRho(r) * driverC(r) * driverC(r) * r.Sd_m2 * r.Sd_m2));
    if (r.Cms_m_per_N == null && r.Fs_hz != null && r.Mms_kg != null) setVal('Cms_m_per_N', 1 / ((TAU * r.Fs_hz) ** 2 * r.Mms_kg));
    if (r.Sd_m2 == null && r.Vas_m3 != null && r.Cms_m_per_N != null && r.Cms_m_per_N > 0) setVal('Sd_m2', Math.sqrt(r.Vas_m3 / (driverRho(r) * driverC(r) * driverC(r) * r.Cms_m_per_N)));

    // `no` — every route precedes the Vas sites: rel 14 via Fs/Vas/Qes, rel 15 via the driver's
    // own motor (BL/Sd/Mms/Re), rel 18 via a stated SPL. Moved here from blocks 10/11 so a
    // cleared Vas still fills from efficiency when the motor route or SPL can reach η₀ — WinISD
    // evaluates ALL `no` sites before the first Vas site (FINDING-028).
    if (r.no == null && r.Fs_hz != null && r.Vas_m3 != null && r.Qes != null) {
      setVal('no', referenceEfficiency(r.Fs_hz, r.Vas_m3, r.Qes, driverC(r)));                                  // rel 14
    }
    if (r.no == null && r.BL_Tm != null && r.Sd_m2 != null && r.Mms_kg != null && r.Re_ohm != null
        && r.Mms_kg > 0 && r.Re_ohm > 0 && r.Sd_m2 > 0) {
      setVal('no', motorEfficiency(driverRho(r), driverC(r), r.BL_Tm, r.Sd_m2, r.Mms_kg, r.Re_ohm));           // rel 15
    }
    if (r.no == null && r.SPL_dB != null) {
      setVal('no', efficiencyFromSpl(r.SPL_dB, driverRho(r), driverC(r)));                                     // rel 18
    }
    if (r.no == null && r.SPLref_dB != null) {
      setVal('no', efficiencyFromSpl(r.SPLref_dB, driverRho(r), driverC(r)));                                  // rel 18
    }

    // Vas — rel 14 (efficiency) first, rel 10 (compliance) LAST.
    if (r.Vas_m3 == null && r.no != null && r.Qes != null && r.Fs_hz != null && r.Fs_hz > 0) {
      setVal('Vas_m3', r.no * r.Qes / (efficiencyConstant(driverC(r)) * (r.Fs_hz ** 3)));                      // rel 14
    }
    if (r.Vas_m3 == null && r.Cms_m_per_N != null && r.Sd_m2 != null) {
      setVal('Vas_m3', driverRho(r) * driverC(r) * driverC(r) * r.Sd_m2 * r.Sd_m2 * r.Cms_m_per_N);            // rel 10
    }

    // 5. Rms, Fs, Mms, Qms — WinISD has no route deriving Fs from this triple (see block 3).
    if (r.Rms_kg_per_s == null && r.Fs_hz != null && r.Mms_kg != null && r.Qms != null) setVal('Rms_kg_per_s', TAU * r.Fs_hz * r.Mms_kg / r.Qms);
    if (r.Qms == null && r.Fs_hz != null && r.Mms_kg != null && r.Rms_kg_per_s != null) setVal('Qms', TAU * r.Fs_hz * r.Mms_kg / r.Rms_kg_per_s);
    if (r.Mms_kg == null && r.Fs_hz != null && r.Qms != null && r.Rms_kg_per_s != null && r.Fs_hz > 0) setVal('Mms_kg', r.Rms_kg_per_s * r.Qms / (TAU * r.Fs_hz));

    // 6. Qes, Bl, Fs, Mms, Re — Fs-from-this-quartet is rel 2, tried in block 3 above.
    if (r.Qes == null && r.Fs_hz != null && r.Mms_kg != null && r.Re_ohm != null && r.BL_Tm != null) setVal('Qes', TAU * r.Fs_hz * r.Mms_kg * r.Re_ohm / (r.BL_Tm * r.BL_Tm));
    if (r.Re_ohm == null && r.Qes != null && r.BL_Tm != null && r.Fs_hz != null && r.Mms_kg != null) setVal('Re_ohm', r.Qes * r.BL_Tm * r.BL_Tm / (TAU * r.Fs_hz * r.Mms_kg));
    if (r.BL_Tm == null && r.Qes != null && r.Re_ohm != null && r.Fs_hz != null && r.Mms_kg != null && r.Qes > 0) setVal('BL_Tm', Math.sqrt(TAU * r.Fs_hz * r.Mms_kg * r.Re_ohm / r.Qes));
    if (r.Mms_kg == null && r.Qes != null && r.BL_Tm != null && r.Fs_hz != null && r.Re_ohm != null && r.Fs_hz > 0 && r.Re_ohm > 0) setVal('Mms_kg', r.Qes * r.BL_Tm * r.BL_Tm / (TAU * r.Fs_hz * r.Re_ohm));

    // 7. Xmax / Hc / Hg relations
    // Precedence between the two Xmax routes is on the RESULT, not the route: WinISD prefers
    // abs(Hc-Hg)/2, but an equal overhang gives 0 — not an excursion limit — and it falls
    // through to Vd/Sd below. Probe case G, ledger QO39/QO40.
    if (r.Xmax_m == null && r.Hc_m != null && r.Hg_m != null && r.Hc_m !== r.Hg_m) {
      setVal('Xmax_m', Math.abs(r.Hc_m - r.Hg_m) / 2);
    }
    if (r.Hc_m == null && r.Xmax_m != null && r.Hg_m != null) {
      setVal('Hc_m', r.Hg_m > 2 * r.Xmax_m ? r.Hg_m - 2 * r.Xmax_m : r.Hg_m + 2 * r.Xmax_m);
    }
    if (r.Hg_m == null && r.Xmax_m != null && r.Hc_m != null) {
      setVal('Hg_m', r.Hc_m > 2 * r.Xmax_m ? r.Hc_m - 2 * r.Xmax_m : r.Hc_m + 2 * r.Xmax_m);
    }
    if (r.Xmax_m == null && r.Vd_m3 != null && r.Sd_m2 != null && r.Sd_m2 > 0) {
      setVal('Xmax_m', r.Vd_m3 / r.Sd_m2);
    }


    // 8. Sd fallback from Vd/Xmax
    if (r.Sd_m2 == null && r.Vd_m3 != null && r.Xmax_m != null && r.Xmax_m > 0) {
      setVal('Sd_m2', r.Vd_m3 / r.Xmax_m);
    }

    // 9. Vd
    if (r.Vd_m3 == null && r.Sd_m2 != null && r.Xmax_m != null) {
      setVal('Vd_m3', r.Sd_m2 * r.Xmax_m);
    }

    // 9b. The DVol/Depth/MagDepth/Magnet geometry lock (WINISD_SCHEMA.md §3.10.1): the four
    // are bound by one equation over Dd and Vcd, so any absent member solves from the rest.
    // The formulas own their domain checks and return null on a degenerate geometry
    // (dvolRelation.ts); `setVal` is only reached with a real value, so an entered member is
    // never overwritten and junk is never invented — same contract as blocks 7 and 9.
    if (r.DVol_m3 == null && r.Dd_m != null && r.Vcd_m != null && r.Depth_m != null && r.MagDepth_m != null && r.Magnet_m != null) {
      const v = dvolFromDims({ Dd: r.Dd_m, Vcd: r.Vcd_m, Depth: r.Depth_m, MagDepth: r.MagDepth_m, Magnet: r.Magnet_m });
      if (v != null) setVal('DVol_m3', v);
    }
    if (r.Depth_m == null && r.Dd_m != null && r.Vcd_m != null && r.DVol_m3 != null && r.MagDepth_m != null && r.Magnet_m != null) {
      const v = depthFromDims({ Dd: r.Dd_m, Vcd: r.Vcd_m, DVol: r.DVol_m3, MagDepth: r.MagDepth_m, Magnet: r.Magnet_m });
      if (v != null) setVal('Depth_m', v);
    }
    if (r.MagDepth_m == null && r.Dd_m != null && r.Vcd_m != null && r.DVol_m3 != null && r.Depth_m != null && r.Magnet_m != null) {
      const v = magDepthFromDims({ Dd: r.Dd_m, Vcd: r.Vcd_m, DVol: r.DVol_m3, Depth: r.Depth_m, Magnet: r.Magnet_m });
      if (v != null) setVal('MagDepth_m', v);
    }
    if (r.Magnet_m == null && r.Dd_m != null && r.Vcd_m != null && r.DVol_m3 != null && r.Depth_m != null && r.MagDepth_m != null) {
      const v = magnetFromDims({ Dd: r.Dd_m, Vcd: r.Vcd_m, DVol: r.DVol_m3, Depth: r.Depth_m, MagDepth: r.MagDepth_m });
      if (v != null) setVal('Magnet_m', v);
    }

    // 10. Qes from η₀ — the `no` and Vas rel-14 routes of this block now live in block 4,
    //     ahead of the compliance group, per WinISD's site order (FINDING-027/028).
    if (r.Qes == null && r.no != null && r.Fs_hz != null && r.Vas_m3 != null && r.no > 0) {
      setVal('Qes', efficiencyConstant(driverC(r)) * (r.Fs_hz ** 3) * r.Vas_m3 / r.no);
    }

    // 11. SPLref <-> no — the no-from-SPL routes (rel 18) run with the `no` cluster in block 4.
    if (r.SPLref_dB == null && r.no != null && r.no > 0) {
      setVal('SPLref_dB', splFromEfficiency(r.no, driverRho(r), driverC(r)));
    }
    if (r.SPL_dB == null && r.no != null && r.no > 0) {
      setVal('SPL_dB', splFromEfficiency(r.no, driverRho(r), driverC(r)));
    }

    // 12. USPL, SPLref, Re
    //
    // USPL = SPL_stated + 10·log₁₀(2.83²/Re), NOT the bare-8 formula this code used before.
    // `2.83` is the industry-standard 1 W/8 Ω test voltage (V = √(1·8) = 2.828…, WinISD's own
    // rounded label). `2.83² = 8.0089`, not `8`, and the two are close enough to look
    // interchangeable (0.0048 dB) but are NOT: predicting `USPL` from each golden's own STATED
    // `SPL` and `Re` with the `2.83²` constant agrees with WinISD to 4.3e-14 relative on every
    // parity golden available (e.g. `sealed-small`: `90 + 10·log₁₀(8.0089/6.4) =
    // 90.9739289706469`, WinISD's own stored value to the last digit); the bare-8 formula is
    // off by 0.0048 dB on every one. `SPL_stated` is the record's OWN carried `SPL` (WDR key
    // `SPL`, entered — present in `r` here as soon as it is entered, since `r` is the untyped
    // record `solveConsistencyGroup` was handed and it is never declared or touched by this
    // function, only passed through); a record with no stated SPL falls back to `SPLref`, the
    // η₀-derived reference sensitivity block 11 above just produced — WinISD does the same
    // (its own `SPL` cell is entered-or-computed exactly like `SPLref` is here). See
    // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md
    // and docs/spec/SPEC_ENGINE.md "USPL / SPLmax — the 2.83 V reference and the 3 dB derating".
    const V283_SQ = 2.83 * 2.83;
    const uSplBase = r.SPL_dB ?? r.SPLref_dB;
    if (r.USPL_dB == null && uSplBase != null && r.Re_ohm != null && r.Re_ohm > 0) {
      setVal('USPL_dB', uSplBase + 10 * Math.log10(V283_SQ / r.Re_ohm));
    }
    if (r.Re_ohm == null && r.USPL_dB != null && uSplBase != null) {
      setVal('Re_ohm', V283_SQ / Math.pow(10, (r.USPL_dB - uSplBase) / 10));
    }
    if (r.SPLref_dB == null && r.USPL_dB != null && r.Re_ohm != null && r.Re_ohm > 0) {
      setVal('SPLref_dB', r.USPL_dB - 10 * Math.log10(V283_SQ / r.Re_ohm));
    }

    // 13. WinISD's Advanced-pane figures of merit (KNOWLEDGE_REPORT.md §4). Everything on
    // that panel except alfaVC/Rt/Ct is calculated — deleting one in WinISD makes it fill
    // the value back in (human ruling, ledger QO24).
    //
    // Rme has TWO routes, and the ORDER matters. They are the same number whenever
    // Bl = √(2π·Fs·Mms·Re/Qes) holds, so they diverge only on a record whose stored Bl
    // disagrees with its own Fs/Mms/Re/Qes — which real records do. On the Beyma 10BR60/V2
    // fixture the motional route gives 18.22124 and Bl²/Re gives 18.27846, and WinISD's own
    // value is the first: the motional route WINS, and Bl²/Re is only the fallback for a
    // record that cannot evaluate it.
    if (r.Rme_kg_per_s == null && r.Fs_hz != null && r.Mms_kg != null && r.Qes != null && r.Qes > 0) {
      setVal('Rme_kg_per_s', TAU * r.Fs_hz * r.Mms_kg / r.Qes);
    }
    if (r.Rme_kg_per_s == null && r.BL_Tm != null && r.Re_ohm != null && r.Re_ohm > 0) {
      setVal('Rme_kg_per_s', r.BL_Tm * r.BL_Tm / r.Re_ohm);
    }
    // Mpow = Bl/√Re — WinISD's OWN route, not √Rme. Verified from the `inconsistent-fs`
    // parity golden (packages/winisd/test/fixtures/winisd-parity/goldens/inconsistent-fs.wpr):
    // that record's stored `Fs` is written at exactly twice its true 1/(2π√(Mms·Cms)), which
    // separates the two candidate routes (they agree on every self-consistent record, which is
    // why 14 of the 15 parity goldens couldn't distinguish them). On that record WinISD wrote
    // `Rme=17.578125` (the motional route, 2π·Fs·Mms/Qes on the STORED Fs — unaffected by this
    // change) beside `Mpow=2.96463530640786`. `Bl/√Re = 7.5/√6.4 = 2.96463530640786`, matching
    // WinISD to the last digit; `√Rme = √17.578125 = 4.1926274578121`, which does not. So
    // WinISD's `Rme` and `Mpow` are independently sourced, not related by a square root —
    // `Mpow = √Rme` is not an identity WinISD holds, so this code must not pin it.
    // `√Rme` is retained only as the fallback for a record with no `Bl` (e.g. `Bl` itself
    // absent but `Rme` derivable from Fs/Mms/Qes). See
    // bugs/BUG_20260813_mpow-uses-sqrt-rme-where-winisd-uses-bl-over-sqrt-re.md.
    if (r.Mpow_N_per_sqrtW == null && r.BL_Tm != null && r.Re_ohm != null && r.Re_ohm > 0) setVal('Mpow_N_per_sqrtW', r.BL_Tm / Math.sqrt(r.Re_ohm));
    if (r.Mpow_N_per_sqrtW == null && r.Rme_kg_per_s != null && r.Rme_kg_per_s > 0) setVal('Mpow_N_per_sqrtW', Math.sqrt(r.Rme_kg_per_s));
    // gamma = Bl/Mms — one route only.
    if (r.gamma_m_per_s2_A == null && r.BL_Tm != null && r.Mms_kg != null && r.Mms_kg > 0) setVal('gamma_m_per_s2_A', r.BL_Tm / r.Mms_kg);
    // SPLmax = SPL_stated + 10·log₁₀(Pe) − 3 dB: the thermal-limit offset from the SAME base
    // USPL offsets from (`uSplBase`, block 12 above — stated SPL, else the η₀-derived
    // SPLref). The flat 3 dB derating is measured exactly (not 10·log₁₀(2) = 3.0103 — the two
    // parity goldens available print `SPLmax` values that back out to a derating of precisely
    // 3.0, e.g. `sealed-small`: `90 + 10·log₁₀(100) − 3 = 107`, WinISD's own stored value
    // exactly) but its PHYSICAL reason is not established by any source found in
    // winisd_research/ — the WHAT (exactly −3 dB) is proven, the WHY is not. See
    // bugs/BUG_20260813_uspl-and-splmax-use-formulas-winisd-does-not-2p83-volts-and-a-3db-derating.md
    // and docs/spec/SPEC_ENGINE.md "USPL / SPLmax — the 2.83 V reference and the 3 dB derating".
    if (r.SPLmax_dB == null && uSplBase != null && r.Pe_W != null && r.Pe_W > 0) {
      setVal('SPLmax_dB', uSplBase + 10 * Math.log10(r.Pe_W) - 3);
    }
    // Gloss — the static gravitational cone sag as a FRACTION of Xmax: g/((2π·Fs)²·Xmax)
    // (winisd_research/SOLVER_GAPS.md §2.4 — 41 live samples, worst relative residual 3.6e-15).
    // It reads the STORED Fs. The rival g·Mms·Cms/Xmax is exact on every self-consistent
    // driver, because Mms·Cms = 1/(2π·Fs)² there, and lands at relative residual 3.0 on a
    // driver whose Fs is written to disagree with its own Mms·Cms — so the two are separated,
    // not merely ranked. `Gloss` is the record's ONE name for the quantity, and what goes in
    // it is the fraction the file carries; the percent WinISD's pane shows is the display
    // layer's ×100 and exists nowhere in this module.
    if (r.Gloss == null && r.Fs_hz != null && r.Fs_hz > 0 && r.Xmax_m != null && r.Xmax_m > 0) {
      setVal('Gloss', G_STANDARD / ((TAU * r.Fs_hz) ** 2 * r.Xmax_m));
    }
    // SPLmaxLF — the excursion-limited half-space SPL at 20 Hz, 1 m, as dB re 20 µPa. The
    // bracket is the far-field RMS pressure of a piston of volume displacement Vd,
    // p = ρ₀·ω²·Vd/(2π·r·√2) at r = 1 m, ω = 2π·20. ρ₀ is the air the RECORD carries
    // (`driverRho` above — a .wdr's own `roo`, else the live physical model), never a
    // literal: WinISD moves SPLmaxLF by exactly 20·log₁₀(ρ ratio) when `roo` alone is changed.
    if (r.SPLmaxLF_dB == null && r.Vd_m3 != null && r.Vd_m3 > 0) {
      const p20 = driverRho(r) * (TAU * 20) ** 2 * r.Vd_m3 / (TAU * Math.SQRT2);
      setVal('SPLmaxLF_dB', 20 * Math.log10(p20 / P0));
    }
    // Mcost — Rme scaled by how far the coil leaves the gap: Rme·(1 + Xmax/min(Hc,Hg)). It
    // carries Rme's unit and reduces to Rme exactly when the coil never leaves. It reads Xmax
    // ITSELF: the rival Rme·(Hc+Hg)/(2·min) is exact whenever Xmax = |Hc−Hg|/2 (which the block
    // above makes true of any record that lets it) and lands at 0.40 on a record where Xmax is
    // written away from the gap geometry. Uses the Rme the precedence above produced — there is
    // no second Rme here. min(Hc,Hg) is the DIVISOR and both are 0 on essentially every real
    // record, which is the whole reason WinISD's own files read Mcost=0; when it is zero or
    // missing the field stays ABSENT, because neither 0 nor Infinity is a number this driver has.
    const minHeight = r.Hc_m != null && r.Hg_m != null ? Math.min(r.Hc_m, r.Hg_m) : 0;
    if (r.Mcost_kg_per_s == null && r.Rme_kg_per_s != null && r.Xmax_m != null && minHeight > 0) {
      setVal('Mcost_kg_per_s', r.Rme_kg_per_s * (1 + r.Xmax_m / minHeight));
    }

    // 14. Znom from Re — `nominalImpedance` above. Placed after every block that can PRODUCE
    // `Re` (6 and 12), because WinISD accepts a calculated Re as this rule's input. It does not
    // go through `setVal`: that refuses a non-positive result, and Re < 2/3 legitimately yields
    // a COMPUTED zero (probe Z_tie_re0.6 — Znom=0 marked C, not the unset Znom=0/N of a blank
    // driver). An entered Znom is never touched, so a Znom contradicting its own Re stays pinned.
    if (r.Znom_ohm == null && r.Re_ohm != null && r.Re_ohm > 0) {
      r.Znom_ohm = nominalImpedance(r.Re_ohm);
      changed = true;
    }

    // 24. Semi-inductance — `KLe = Le·√(2π·fLe)` (WINISD_SCHEMA.md §rel-24, read from WinISD's
    // own calculation engine; John confirmed the behaviour by hand against WinISD 2026-08-31).
    //
    // ONE DIRECTION ONLY, and deliberately so: WinISD calculates no route to `Le` or `fLe`, which
    // is why both are always either typed in or absent. Adding the inverse would manufacture
    // provenance WinISD never claims — a driver would start reporting a CALCULATED `Le` that no
    // datasheet stated and no measurement produced.
    if (r.KLe_H_sqrtHz == null && r.Le_H != null && r.fLe_hz != null && r.fLe_hz > 0) {
      setVal('KLe_H_sqrtHz', r.Le_H * Math.sqrt(TAU * r.fLe_hz));
    }

    iterations++;
  }

  // The air a record carries is itself a derivable field, exactly like any other: entered
  // (a .wdr's own c/roo) wins, else recomputed exactly as `driverC`/`driverRho` do above —
  // surfacing it here in the output record is what lets every caller treat c/roo through the
  // SAME entered-or-computed path as Fs/Qes/EBP, with no special case anywhere above this module.
  //
  // The two guards below are unreachable and deleted: `solveConsistencyGroup` is module-private,
  // and its only two call sites (`checkConsistency`'s direct call, and the `bumped` recompute
  // inside it) both pass a working set that ultimately traces back to `solveDriver`'s own
  // construction of `working`, which ALWAYS pre-fills `c_m_per_s: enteredDriverValue(...) ??
  // air.c` and `roo_kg_per_m3: enteredDriverValue(...) ?? air.rho` — and `Air.c`/`Air.rho`
  // (air.ts) are non-optional `number`, never null/undefined. So `r.c_m_per_s`/`r.roo_kg_per_m3`
  // are never null by the time this function is reached through any current call path.
  r.c_m_per_s = driverC(r);
  r.roo_kg_per_m3 = driverRho(r);

  // EBP (Fs/Qes) likewise: a real derivable field, computed once every input it needs is
  // available, through the SAME formula `boxDesign.ts` exports for every other caller —
  // never recomputed ad hoc downstream.
  if (r.EBP_hz == null && r.Fs_hz != null && r.Qes != null && r.Qes > 0) {
    r.EBP_hz = ebp(r.Fs_hz, r.Qes);
  }

  // THE TERMINAL VALUES, LAST. Not a relation — nothing else in the group constrains them, and
  // they answer a question about the WIRING rather than about the driver's parameters. So they
  // are computed once, after the fixpoint, from whatever `Re_ohm` and `BL_Tm` finally are:
  // `Re_ohm` is itself derivable, so computing these earlier would fix them to a value the solve
  // then moved.
  //
  // Here rather than at the caller because `sweep` REQUIRES this pair. A solver that stopped short
  // of it left every caller to finish the job, and a caller that forgot got a driver the engine
  // refused with a message naming a field it had never been able to supply.
  if (r.Re_terminal_ohm == null && r.Re_ohm != null) {
    r.Re_terminal_ohm = terminalRe_ohm(r.Re_ohm, r.numVC, r.wiring);
  }
  if (r.BL_terminal_Tm == null && r.BL_Tm != null) {
    r.BL_terminal_Tm = terminalBL_Tm(r.BL_Tm, r.numVC, r.wiring);
  }

  return r;
}

/**
 * Voice-coil DC resistance at an elevated temperature — thermal power compression (WinISD
 * parity, docs/research/WINISD_PARITY.md): `Re_hot = Re·(1 + alfaVC·ΔT)`, where `alfaVC` is the SI temperature
 * coefficient (/K; the UI's `1000/K` value ÷ 1000) and ΔT is the coil rise (K). ΔT=0 or
 * alfaVC=0 returns `Re` exactly (no-op).
 */
export function hotRe(Re: number, alfaVC: number, dT: number): number {
  return Re * (1 + (alfaVC || 0) * (dT || 0));
}

/**
 * Return a copy of the driver with `MaddKg` kilograms added to the cone's moving mass
 * (driver-side added mass — the WinISD "Added mass to cone" field, verified used in
 * docs/research/WINISD_PARITY.md). The suspension (Cms, Rms), motor (Bl), Re, Sd and Vas are unchanged by
 * the mass; the resonance and Q's follow from the heavier Mms:
 *   Mms' = Mms + Madd,  Fs' = 1/(2π√(Mms'·Cms)),
 *   Qms' = ωs'·Mms'/Rms,  Qes' = ωs'·Mms'·Re/Bl²,  Qts' = Qes'·Qms'/(Qes'+Qms').
 * `MaddKg ≤ 0` returns an equivalent driver (exact no-op) so existing goldens never move.
 */
export function withAddedMass(drv: Readonly<DriverWorkingSet>, MaddKg: number): DriverWorkingSet {
  const out: DriverWorkingSet = Object.assign({}, drv);
  if (!(MaddKg > 0)) return out;
  const { Cms_m_per_N, Rms_kg_per_s, Re_ohm, BL_Tm } = drv;
  if (drv.Mms_kg == null || Cms_m_per_N == null || Rms_kg_per_s == null
      || Re_ohm == null || BL_Tm == null) return out;
  const Mms = drv.Mms_kg + MaddKg;
  const ws  = 1 / Math.sqrt(Mms * Cms_m_per_N);      // ωs = 1/√(Mms·Cms)
  const Qms = ws * Mms / Rms_kg_per_s;               // ωs·Mms/Rms
  const Qes = ws * Mms * Re_ohm / (BL_Tm * BL_Tm);   // ωs·Mms·Re/Bl²
  out.Mms_kg = Mms;
  out.Fs_hz  = ws / (2 * Math.PI);
  out.Qms    = Qms;
  out.Qes    = Qes;
  out.Qts    = (Qes * Qms) / (Qes + Qms);
  return out;
}

/**
 * Re AS THE AMPLIFIER SEES IT. N coils of resistance r are r/N in parallel and N·r in series.
 *
 * Its own function, beside the solver rather than inside it: this is not a consistency relation —
 * nothing else in the group constrains it, and it answers a question about WIRING, not about the
 * driver's Thiele/Small parameters. The caller stores it in `Re_terminal_ohm`, never over
 * `Re_ohm`: WinISD rewrites the stated value in place and leaves it marked entered, so its file
 * claims the user typed a number the app computed.
 */
export function terminalRe_ohm(Re_ohm: number, numVC: number | undefined, wiring: Wiring | undefined): number {
  const coils = numVC != null && numVC >= 1 ? numVC : 1;
  return wiring === 'series' ? Re_ohm * coils : Re_ohm / coils;
}

/** BL as the amplifier sees it — `bl` per coil, `N·bl` in series, unchanged in parallel. Same
 *  rule as `terminalRe_ohm`: the caller stores it beside the stated value, never over it. */
export function terminalBL_Tm(BL_Tm: number, numVC: number | undefined, wiring: Wiring | undefined): number {
  const coils = numVC != null && numVC >= 1 ? numVC : 1;
  return wiring === 'series' ? BL_Tm * coils : BL_Tm;
}

// `solvePrConsistencyGroup` (a p:PrWorkingSet,air:Air->PrWorkingSet twin of `solvePr` below) was
// deleted: it had zero callers. `solvePr` is the only PR solve route reachable from `Engine`, and
// `testSolver.ts`'s exported `solvePrConsistencyGroup` is a same-named but unrelated helper that
// calls `engine.solvePr` — it does not reach this module's private function.

/** The PR geometry every route below needs, beside `tuning_goal_hz`/`addedMass_kg` themselves —
 *  named once so both routes report the identical missing set. */
const PR_GEOMETRY: readonly PrQuantityName[] = Object.freeze(['Vb_m3', 'prMmd_kg', 'prSd_m2', 'prCms_m_per_N']);

/** The PR handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`addedMass_kg` is not entered
 *  plus `resonanceWithAddedMass_hz`/`systemTuning_hz`, write each onto its `SolverField` via
 *  `setCalculated`, and return the issues the stated values carry. An entered value is never
 *  overwritten; an underivable member becomes `not-available`. `air` is the project's own
 *  resolved `{ rho, c }` — see `boxDesign.ts#ventLength`'s doc comment. */
export function solvePr(params: PrSolverParams, air: Air): PrIssue[] {
  const addedMass = params.addedMass_kg.value;
  const tuning = params.tuning_goal_hz.value;
  const Vb = params.Vb_m3.value;
  const prMmd = params.prMmd_kg.value;
  const prSd = params.prSd_m2.value;
  const prCms = params.prCms_m_per_N.value;

  const issues: PrIssue[] = [];

  if (tuning != null && tuning <= 0) {
    issues.push({
      kind: 'inconsistent-inputs',
      formula: 'Tuning frequency must be greater than zero',
      fields: ['tuning_goal_hz'],
      target: 'tuning_goal_hz',
      expected: 0,
      actual: tuning,
      relative: 1,
    });
  }

  const geometryComplete = Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null;
  const missingGeometry = PR_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

  if (addedMass != null && !params.tuning_goal_hz.entered) {
    if (geometryComplete) {
      params.tuning_goal_hz.setCalculated(prTuning({ Vb, prMmd, prMadd: addedMass, prSd, prCms }, air));
    } else {
      params.tuning_goal_hz.setNotAvailable();
      // geometryComplete is false here, and every way it can be false — Vb null/≤0, or prMmd/
      // prSd/prCms null — is also a way PR_GEOMETRY's own >0 filter counts that same field, so
      // missingGeometry is never empty in this branch.
      issues.push({
        kind: 'missing-dependencies', target: 'tuning_goal_hz',
        routes: [{ formula: 'tuning_goal_hz from addedMass_kg + Vb_m3 + prMmd_kg + prSd_m2 + prCms_m_per_N',
          required: ['addedMass_kg', ...PR_GEOMETRY], missing: missingGeometry }],
      });
    }
  } else if (tuning != null && !params.addedMass_kg.entered) {
    if (geometryComplete && tuning > 0) {
      const totalMass = prMassForFp({ Vb, prMmd, prMadd: 0, prSd, prCms }, tuning, air);
      const addedMassResult = totalMass - prMmd;
      if (addedMassResult >= 0) {
        params.addedMass_kg.setCalculated(addedMassResult);
      } else {
        params.addedMass_kg.setNotAvailable();
        issues.push({
          kind: 'target-unreachable',
          target: 'addedMass_kg',
          maxReachable_hz: prTuning({ Vb, prMmd, prMadd: 0, prSd, prCms }, air),
        });
      }
    } else {
      params.addedMass_kg.setNotAvailable();
      issues.push({
        kind: 'missing-dependencies', target: 'addedMass_kg',
        routes: [{ formula: 'addedMass_kg from tuning_goal_hz + Vb_m3 + prMmd_kg + prSd_m2 + prCms_m_per_N',
          required: ['tuning_goal_hz', ...PR_GEOMETRY], missing: missingGeometry }],
      });
    }
  }

  const resolvedMass = params.addedMass_kg.value;
  if (resolvedMass != null && prMmd != null && prCms != null) {
    params.resonanceWithAddedMass_hz.setCalculated(prFsWithMass(prMmd, resolvedMass, prCms));
  } else {
    params.resonanceWithAddedMass_hz.setNotAvailable();
  }
  if (resolvedMass != null && Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null) {
    params.systemTuning_hz.setCalculated(prTuning({ Vb, prMmd, prMadd: resolvedMass, prSd, prCms }, air));
  } else {
    params.systemTuning_hz.setNotAvailable();
  }

  return issues;
}

// `solveVentConsistencyGroup` (a p:VentWorkingSet,air:Air->VentWorkingSet twin of `solveVent`
// below) was deleted: it had zero callers. `solveVent` is the only vent solve route reachable
// from `Engine`, and `testSolver.ts`'s exported `solveVentConsistencyGroup` is a same-named but
// unrelated helper that calls `engine.solveVent` — it does not reach this module's private
// function.

/** The vent geometry every route below needs, beside `tuning_goal_hz`/`length_m` themselves. */
const VENT_GEOMETRY: readonly VentQuantityName[] = Object.freeze(['Vb_m3', 'area_m2']);

/** The vent handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`length_m` is not entered,
 *  write it onto its `SolverField` via `setCalculated`, and return the issues the stated
 *  values carry. An entered value is never overwritten; an underivable member becomes
 *  `not-available`. `air` is the project's own resolved `{ rho, c }` — see
 *  `boxDesign.ts#ventLength`'s doc comment for why that is a parameter here, never a
 *  reference-condition default. */
export function solveVent(params: VentSolverParams, air: Air): VentIssue[] {
  const tuning = params.tuning_goal_hz.value;
  const length = params.length_m.value;
  const Vb = params.Vb_m3.value;
  const area = params.area_m2.value;
  const count = params.count.value ?? 1;
  const endCorrection = params.endCorrection_m.value ?? 0.732;

  const issues: VentIssue[] = [];

  if (tuning != null && tuning <= 0) {
    issues.push({
      kind: 'inconsistent-inputs',
      formula: 'Tuning frequency must be greater than zero',
      fields: ['tuning_goal_hz'],
      target: 'tuning_goal_hz',
      expected: 0,
      actual: tuning,
      relative: 1,
    });
  }

  const geometryComplete = Vb != null && Vb > 0 && area != null && area > 0;
  const missingGeometry = VENT_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

  if (tuning != null && !params.length_m.entered) {
    if (geometryComplete && tuning > 0) {
      const L = ventLength(Vb, tuning, area, count, air, endCorrection);
      if (L >= 0) {
        params.length_m.setCalculated(L);
      } else {
        params.length_m.setNotAvailable();
        issues.push({
          kind: 'target-unreachable',
          target: 'length_m',
          maxReachable_hz: tuningFromLength(Vb, 0, area, count, air, endCorrection),
        });
      }
    } else {
      params.length_m.setNotAvailable();
      // geometryComplete is false here, and every way it can be false — Vb or area null/≤0 —
      // is also a way VENT_GEOMETRY's own >0 filter counts that same field, so missingGeometry
      // is never empty in this branch.
      issues.push({
        kind: 'missing-dependencies', target: 'length_m',
        routes: [{ formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)',
          required: ['tuning_goal_hz', ...VENT_GEOMETRY], missing: missingGeometry }],
      });
    }
  } else if (length != null && !params.tuning_goal_hz.entered) {
    if (geometryComplete) {
      params.tuning_goal_hz.setCalculated(tuningFromLength(Vb, length, area, count, air, endCorrection));
    } else {
      params.tuning_goal_hz.setNotAvailable();
      issues.push({
        kind: 'missing-dependencies', target: 'tuning_goal_hz',
        routes: [{ formula: 'tuning_goal_hz from length_m + Vb_m3 + area_m2 (Helmholtz)',
          required: ['length_m', ...VENT_GEOMETRY], missing: missingGeometry }],
      });
    }
  }

  return issues;
}


// `solveSealedAlignmentGroup` (a p:SealedAlignmentWorkingSet->SealedAlignmentWorkingSet twin of
// `Engine.solveSealedAlignment`) was deleted: it had zero callers. `Engine.solveSealedAlignment`
// is the only sealed-alignment solve route reachable from `Engine`, and `testSolver.ts`'s
// exported `solveSealedAlignmentGroup` is a same-named but unrelated helper that calls
// `engine.solveSealedAlignment` — it does not reach this module's private function.

/** The driver quantities every sealed-alignment route needs, beside `Qtc`/`Vb_m3` themselves.
 *  Typed over `SealedAlignmentWorkingSet`'s own keys (not the wider `SealedAlignmentQuantityName`,
 *  which S10 grew to include the Vb→Qtc route's read-only loss inputs) — `checkSealedAlignment`
 *  indexes `p: SealedAlignmentWorkingSet` with these, and that type carries only Qts/Vas_m3/Qtc/Vb_m3. */
const SEALED_ALIGNMENT_DRIVER_QUANTITIES: readonly (keyof SealedAlignmentWorkingSet & SealedAlignmentQuantityName)[] =
  Object.freeze(['Qts', 'Vas_m3']);

/** The stated sealed-alignment quantities that cannot yet solve because `Qts`/`Vas_m3` are
 *  incomplete — mirrors `Engine.solveSealedAlignment`'s own route conditions. There is no
 *  inconsistent-inputs case here: a sealed box has no THIRD input to `Qtc`/`Vb_m3` that could
 *  disagree with the pair, unlike the driver's Qts/Qes/Qms triple. */
function checkSealedAlignment(p: SealedAlignmentWorkingSet): SealedAlignmentIssue[] {
  const issues: SealedAlignmentIssue[] = [];
  const missingDriverQuantities = SEALED_ALIGNMENT_DRIVER_QUANTITIES.filter(f => {
    const v = p[f];
    return !(typeof v === 'number' && v > 0);
  });
  if (missingDriverQuantities.length === 0) return issues;

  if (p.Qtc != null && p.Vb_m3 == null) {
    issues.push({
      kind: 'missing-dependencies', target: 'Vb_m3',
      routes: [{ formula: 'Vb_m3 = Vas_m3 / ((Qtc/Qts)² − 1)',
        required: ['Qtc', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }],
    });
  } else if (p.Vb_m3 != null && p.Qtc == null) {
    issues.push({
      kind: 'missing-dependencies', target: 'Qtc',
      routes: [{ formula: 'Qtc = Qts · √(1 + Vas_m3/Vb_m3)',
        required: ['Vb_m3', ...SEALED_ALIGNMENT_DRIVER_QUANTITIES], missing: missingDriverQuantities }],
    });
  }

  return issues;
}

/** The sealed-alignment handle solve (T10/T11): derive whichever of `Qtc`/`Vb_m3` is not
 *  entered from the driver's own `Qts`/`Vas_m3`, write it onto its `SolverField` via
 *  `setCalculated`, and return the issues the stated values carry. An entered value is never
 *  overwritten; an underivable member becomes `not-available`. */
export function solveSealedAlignment(params: SealedAlignmentSolverParams): SealedAlignmentIssue[] {
  const Qts = params.Qts.value;
  const Vas = params.Vas_m3.value;
  const Qtc = params.Qtc.value;
  const Vb = params.Vb_m3.value;

  if (Qtc != null && !params.Vb_m3.entered) {
    if (Qts != null && Vas != null) {
      const v = sealedFromQtc(Qts, Vas, Qtc);
      if (v != null) {
        params.Vb_m3.setCalculated(v);
      } else {
        params.Vb_m3.setNotAvailable();
      }
    } else {
      params.Vb_m3.setNotAvailable();
    }
  } else if (Vb != null && !params.Qtc.entered) {
    if (Qts != null && Vas != null) {
      const Fs = params.Fs_hz.value;
      // Fs_hz is the gate (S10): only a caller that states it opts into the lossy readout —
      // every pre-S10 caller (Fs_hz absent) keeps the lossless textbook ratio unchanged.
      const v = Fs != null
        ? sealedResonance(LossMode.parse(params.lossMode.value), {
            Fs, Vas, Qts, Vb, Ql: params.Ql.value ?? Infinity, Qa: params.Qa.value ?? Infinity,
          }).Qtc
        : sealedQtcFromVolume(Qts, Vas, Vb);
      if (v != null) {
        params.Qtc.setCalculated(v);
      } else {
        params.Qtc.setNotAvailable();
      }
    } else {
      params.Qtc.setNotAvailable();
    }
  }

  const solved: SealedAlignmentWorkingSet = {
    Qts: Qts ?? undefined,
    Vas_m3: Vas ?? undefined,
    Qtc: params.Qtc.value ?? undefined,
    Vb_m3: params.Vb_m3.value ?? undefined,
  };
  return checkSealedAlignment(solved);
}

// ---------------------------------------------------------------------------------------------
// DRIVER CONSISTENCY — moved from consistency.ts (S2-10): `checkConsistency` needs
// `solveConsistencyGroup`, which became private to this file, so the two live together, same as
// every other node's solve+check pair above. `consistency.ts` keeps only the generic
// CalculationIssue/SolveRoute vocabulary every node's issues share.
// ---------------------------------------------------------------------------------------------

/** Every field this module's relations read or predict is numeric — `wiring` is the one
 *  non-numeric driver quantity, and `numVC` is a `SolverInput` with no `.precision` of its own
 *  (the domain defaults a not-entered coil count itself); no relation below names either. */
type NumericDriverQuantityName = Exclude<DriverQuantityName, 'wiring' | 'numVC'>;

/** Field values by name, SI, as the solver produces them — a concrete, closed dictionary over
 *  the driver's own numeric quantities, never a bare `Record<string, unknown>`. */
type Values = Readonly<Partial<Record<NumericDriverQuantityName, number>>>;

/** One inconsistent-inputs group: every member, and the relation that predicts `target` from
 *  the others. WINISD_SCHEMA.md §4 verbatim; nothing here is a new formula. */
interface Relation {
  readonly formula: string;
  readonly target: NumericDriverQuantityName;
  readonly fields: readonly NumericDriverQuantityName[];
  readonly predict: (v: Values) => number;
}

const CONSISTENCY_TAU = 2 * Math.PI;

const RELATIONS: readonly Readonly<Relation>[] = Object.freeze([
  Object.freeze({ formula: 'Qts = Qes·Qms/(Qes+Qms)', target: 'Qts', fields: Object.freeze(['Qts', 'Qes', 'Qms'] as const),
    predict: (v: Values) => v.Qes! * v.Qms! / (v.Qes! + v.Qms!) }),
  Object.freeze({ formula: 'Fs = 1/(2π·√(Mms·Cms))', target: 'Fs_hz', fields: Object.freeze(['Fs_hz', 'Mms_kg', 'Cms_m_per_N'] as const),
    predict: (v: Values) => 1 / (CONSISTENCY_TAU * Math.sqrt(v.Mms_kg! * v.Cms_m_per_N!)) }),
  Object.freeze({ formula: 'Rms = 2π·Fs·Mms/Qms', target: 'Rms_kg_per_s', fields: Object.freeze(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms'] as const),
    predict: (v: Values) => CONSISTENCY_TAU * v.Fs_hz! * v.Mms_kg! / v.Qms! }),
  Object.freeze({ formula: 'Qes = 2π·Fs·Mms·Re/Bl²', target: 'Qes', fields: Object.freeze(['Qes', 'Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm'] as const),
    predict: (v: Values) => CONSISTENCY_TAU * v.Fs_hz! * v.Mms_kg! * v.Re_ohm! / (v.BL_Tm! * v.BL_Tm!) }),
  Object.freeze({ formula: 'Rme = Bl²/Re', target: 'Rme_kg_per_s', fields: Object.freeze(['Rme_kg_per_s', 'BL_Tm', 'Re_ohm'] as const),
    predict: (v: Values) => v.BL_Tm! * v.BL_Tm! / v.Re_ohm! }),
  Object.freeze({ formula: 'Rme = 2π·Fs·Mms/Qes', target: 'Rme_kg_per_s', fields: Object.freeze(['Rme_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qes'] as const),
    predict: (v: Values) => CONSISTENCY_TAU * v.Fs_hz! * v.Mms_kg! / v.Qes! }),
  Object.freeze({ formula: 'Dd = 2·√(Sd/π)', target: 'Dd_m', fields: Object.freeze(['Dd_m', 'Sd_m2'] as const),
    predict: (v: Values) => 2 * Math.sqrt(v.Sd_m2! / Math.PI) }),
  Object.freeze({ formula: 'Mpow = Bl/√Re', target: 'Mpow_N_per_sqrtW', fields: Object.freeze(['Mpow_N_per_sqrtW', 'BL_Tm', 'Re_ohm'] as const),
    predict: (v: Values) => v.BL_Tm! / Math.sqrt(v.Re_ohm!) }),
  Object.freeze({ formula: 'Mpow = √Rme', target: 'Mpow_N_per_sqrtW', fields: Object.freeze(['Mpow_N_per_sqrtW', 'Rme_kg_per_s'] as const),
    predict: (v: Values) => Math.sqrt(v.Rme_kg_per_s!) }),
  Object.freeze({ formula: 'gamma = Bl/Mms', target: 'gamma_m_per_s2_A', fields: Object.freeze(['gamma_m_per_s2_A', 'BL_Tm', 'Mms_kg'] as const),
    predict: (v: Values) => v.BL_Tm! / v.Mms_kg! }),
  Object.freeze({ formula: 'Vd = Sd·Xmax', target: 'Vd_m3', fields: Object.freeze(['Vd_m3', 'Sd_m2', 'Xmax_m'] as const),
    predict: (v: Values) => v.Sd_m2! * v.Xmax_m! }),
  // ρ/c are the driver's OWN resolved air (`solveConsistencyGroup` always fills `c_m_per_s`/
  // `roo_kg_per_m3` in, per solver.ts above), never a fixed reference constant — matching the
  // same air the solve itself used for this exact conversion.
  Object.freeze({ formula: 'Vas = ρ·c²·Sd²·Cms', target: 'Vas_m3', fields: Object.freeze(['Vas_m3', 'Cms_m_per_N', 'Sd_m2', 'roo_kg_per_m3', 'c_m_per_s'] as const),
    predict: (v: Values) => v.roo_kg_per_m3! * v.c_m_per_s! * v.c_m_per_s! * v.Sd_m2! * v.Sd_m2! * v.Cms_m_per_N! }),
  Object.freeze({ formula: 'EBP = Fs/Qes', target: 'EBP_hz', fields: Object.freeze(['EBP_hz', 'Fs_hz', 'Qes'] as const),
    predict: (v: Values) => v.Fs_hz! / v.Qes! }),
]);

/** Every field name any relation above reads, deduplicated — the closed set `Values` covers. */
const RELATION_FIELDS: readonly NumericDriverQuantityName[] = Object.freeze(
  Array.from(new Set(RELATIONS.flatMap(rel => rel.fields))),
);

/** A computed field's uncertainty can collapse to zero when the solve is insensitive to every
 *  entered value; this is a representation floor, not a tolerance. */
const FLOAT_NOISE = 1e-9;

/** Only the fields any relation reads, as a closed `Values` bag — never the full solved record
 *  (which also carries `wiring` and everything else no relation names). */
function valuesFrom(r: DriverWorkingSet): Values {
  const out: Partial<Record<NumericDriverQuantityName, number>> = {};
  for (const field of RELATION_FIELDS) {
    const v = r[field];
    if (typeof v === 'number') out[field] = v;
  }
  return out;
}

/** `base` with `field` set to `value` — the one place a `NumericDriverQuantityName` is written
 *  into a fresh `DriverWorkingSet`, so every caller shares the same, single assignment the
 *  compiler checks once. */
function withNumericField(
  base: DriverWorkingSet, field: NumericDriverQuantityName, value: number,
): DriverWorkingSet {
  const next: DriverWorkingSet = { ...base };
  next[field] = value;
  return next;
}

/**
 * Every entered value's disagreement with what the OTHER entered values imply for it, beyond
 * their own combined rounding precision — plus, for `Qts`, whether the group can even be
 * solved at all. `entered` is the driver's own stated numerics; a value the solver itself
 * derived is never fed back in as if the human had typed it. `params` supplies each entered
 * field's own precision (D13: the reading's stated `read_precision`, or else half the last
 * decimal it was typed to) — the source of truth for how wide that field's own rounding
 * interval is, never recomputed from the resolved number here.
 */
function checkConsistency(entered: DriverWorkingSet, params: DriverSolverParams): DriverIssue[] {
  const resolved = solveConsistencyGroup(entered);

  // Each field's own uncertainty: an ENTERED field carries its own stated precision (D13); a
  // COMPUTED one starts at the float-representation floor and accumulates however far each
  // entered field's own rounding can move it (below).
  const delta: Partial<Record<NumericDriverQuantityName, number>> = {};
  for (const field of RELATION_FIELDS) {
    const value = resolved[field];
    if (typeof value !== 'number') continue;
    delta[field] = entered[field] != null ? (params[field].precision ?? 0) : Math.abs(value) * FLOAT_NOISE;
  }
  for (const field of RELATION_FIELDS) {
    const enteredValue = entered[field];
    const ownDelta = delta[field];
    if (typeof enteredValue !== 'number' || !(ownDelta! > 0)) continue;
    const bumped = solveConsistencyGroup(withNumericField(entered, field, enteredValue + ownDelta!));
    for (const other of RELATION_FIELDS) {
      if (entered[other] != null) continue; // only computed fields accumulate movement
      const moved = bumped[other];
      const base = resolved[other];
      if (typeof moved === 'number' && typeof base === 'number') {
        // `other` reached here only via `entered[other] == null` (above) and `base` (=
        // `resolved[other]`) being a number — exactly the two conditions the population loop
        // above used to set `delta[other]` for every field in `RELATION_FIELDS`, so it is
        // already set.
        delta[other] = delta[other]! + Math.abs(moved - base);
      }
    }
  }

  const resolvedValues = valuesFrom(resolved);
  const issues: DriverIssue[] = [];
  for (const rel of RELATIONS) {
    if (!rel.fields.every(f => typeof resolvedValues[f] === 'number')) continue;
    const expected = rel.predict(resolvedValues);
    if (!isFinite(expected)) continue;

    // `rel.target` is always one of `rel.fields` (every relation names its own target among its
    // fields), and the `.every()` above just confirmed `resolvedValues[rel.target]` — hence
    // `resolved[rel.target]` — is a number; the population loop above sets `delta[field]` for
    // every `RELATION_FIELDS` member with a numeric resolved value, so it is already set.
    let tolerance = delta[rel.target]!;
    for (const f of rel.fields) {
      const fieldDelta = delta[f];
      if (f === rel.target || !(fieldDelta! > 0)) continue;
      const bumpedValues: Partial<Record<NumericDriverQuantityName, number>> = { ...resolvedValues };
      bumpedValues[f] = resolvedValues[f]! + fieldDelta!;
      const moved = rel.predict(bumpedValues);
      if (isFinite(moved)) tolerance += Math.abs(moved - expected);
    }

    const actual = resolvedValues[rel.target]!;
    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      // `residual` is the gap between the two intervals' CENTRES; `tolerance` is how much of
      // that gap their own half-widths already close. What is left over — the gap between the
      // two intervals' NEAREST EDGES — is the genuine, unexplained disagreement.
      const shortfall = residual - tolerance;
      issues.push({
        kind: 'inconsistent-inputs', formula: rel.formula, fields: rel.fields,
        target: rel.target, expected, actual, relative: shortfall / Math.max(Math.abs(actual), Math.abs(expected)),
      });
    }
  }

  // Qts has no route besides Qes+Qms (WinISD has no third input to this triple) — a driver
  // stating fewer than two of the three cannot solve it, and the caller needs to know exactly
  // which field is missing to unblock it. Checked on ENTERED COUNT, not on whether Qts resolved
  // to a number: an entered Qts always "resolves" to its own stated value regardless of whether
  // the group is otherwise solvable, so checking `resolvedValues.Qts` alone let a driver stating
  // Qts ALONE pass as consistent — the group structurally still has no independent route to
  // confirm it (S9a Cluster 6).
  const enteredTrioCount = (['Qts', 'Qes', 'Qms'] as const).filter(f => entered[f] != null).length;
  if (enteredTrioCount < 2) {
    const missing: NumericDriverQuantityName[] = (['Qes', 'Qms'] as const).filter(f => entered[f] == null);
    issues.push({
      kind: 'missing-dependencies',
      target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing }],
    });
  }

  return issues;
}

/** A handle's own value, entered-only — a value the solver itself derived is never fed back in
 *  as if it had been typed (matches `checkConsistency`'s own contract). */
function enteredDriverValue(field: SolverInput): number | undefined {
  return field.entered ? field.value ?? undefined : undefined;
}

/** Write `value` onto a non-entered handle: derived when present, `not-available` when not. An
 *  entered handle is never touched. */
function writeDriverBack(field: SolverField, value: number | undefined): void {
  if (field.entered) return;
  if (value != null) field.setCalculated(value); else field.setNotAvailable();
}

/** The driver handle solve (T10/T11): build a private, entered-only `DriverWorkingSet` working
 *  set from the handles, run `solveConsistencyGroup`/`checkConsistency` on it unchanged, write
 *  every derived (non-entered) value back via `setCalculated` (or `setNotAvailable` when it
 *  cannot solve), and return the issues. `wiring` is a discrete entered input, never derived, so
 *  it is read but never written back. `air` is the project's own resolved `{ rho, c }` — a
 *  not-entered `c_m_per_s`/`roo_kg_per_m3` defaults to it (matching `solveVent`/`solvePr`'s own
 *  `air` parameter), and the default then writes back as `'C'`. */
export function solveDriver(params: DriverSolverParams, air: Air): DriverIssue[] {
  const working: DriverWorkingSet = {
    Fs_hz: enteredDriverValue(params.Fs_hz), Re_ohm: enteredDriverValue(params.Re_ohm),
    Znom_ohm: enteredDriverValue(params.Znom_ohm), Le_H: enteredDriverValue(params.Le_H),
    fLe_hz: enteredDriverValue(params.fLe_hz), KLe_H_sqrtHz: enteredDriverValue(params.KLe_H_sqrtHz),
    Qes: enteredDriverValue(params.Qes), Qms: enteredDriverValue(params.Qms), Qts: enteredDriverValue(params.Qts),
    Vas_m3: enteredDriverValue(params.Vas_m3), Sd_m2: enteredDriverValue(params.Sd_m2), Dd_m: enteredDriverValue(params.Dd_m),
    BL_Tm: enteredDriverValue(params.BL_Tm), Mms_kg: enteredDriverValue(params.Mms_kg),
    Cms_m_per_N: enteredDriverValue(params.Cms_m_per_N), Rms_kg_per_s: enteredDriverValue(params.Rms_kg_per_s),
    EBP_hz: enteredDriverValue(params.EBP_hz), Xmax_m: enteredDriverValue(params.Xmax_m), Vd_m3: enteredDriverValue(params.Vd_m3),
    Hc_m: enteredDriverValue(params.Hc_m), Hg_m: enteredDriverValue(params.Hg_m), Pe_W: enteredDriverValue(params.Pe_W),
    no: enteredDriverValue(params.no), SPLref_dB: enteredDriverValue(params.SPLref_dB), SPL_dB: enteredDriverValue(params.SPL_dB),
    USPL_dB: enteredDriverValue(params.USPL_dB), SPLmax_dB: enteredDriverValue(params.SPLmax_dB),
    SPLmaxLF_dB: enteredDriverValue(params.SPLmaxLF_dB), Rme_kg_per_s: enteredDriverValue(params.Rme_kg_per_s),
    Mpow_N_per_sqrtW: enteredDriverValue(params.Mpow_N_per_sqrtW), Mcost_kg_per_s: enteredDriverValue(params.Mcost_kg_per_s),
    gamma_m_per_s2_A: enteredDriverValue(params.gamma_m_per_s2_A), Gloss: enteredDriverValue(params.Gloss),
    Vcd_m: enteredDriverValue(params.Vcd_m), Depth_m: enteredDriverValue(params.Depth_m), MagDepth_m: enteredDriverValue(params.MagDepth_m),
    Magnet_m: enteredDriverValue(params.Magnet_m), DVol_m3: enteredDriverValue(params.DVol_m3),
    c_m_per_s: enteredDriverValue(params.c_m_per_s) ?? air.c,
    roo_kg_per_m3: enteredDriverValue(params.roo_kg_per_m3) ?? air.rho,
    Re_terminal_ohm: enteredDriverValue(params.Re_terminal_ohm),
    BL_terminal_Tm: enteredDriverValue(params.BL_terminal_Tm), numVC: enteredDriverValue(params.numVC),
    wiring: params.wiring.value ?? undefined,
  };

  const solved = solveConsistencyGroup(working);
  const issues: DriverIssue[] = [...checkConsistency(working, params), ...checkRange(params)];

  writeDriverBack(params.Fs_hz, solved.Fs_hz); writeDriverBack(params.Re_ohm, solved.Re_ohm);
  writeDriverBack(params.Znom_ohm, solved.Znom_ohm); writeDriverBack(params.Le_H, solved.Le_H);
  writeDriverBack(params.fLe_hz, solved.fLe_hz); writeDriverBack(params.KLe_H_sqrtHz, solved.KLe_H_sqrtHz);
  writeDriverBack(params.Qes, solved.Qes); writeDriverBack(params.Qms, solved.Qms); writeDriverBack(params.Qts, solved.Qts);
  writeDriverBack(params.Vas_m3, solved.Vas_m3); writeDriverBack(params.Sd_m2, solved.Sd_m2); writeDriverBack(params.Dd_m, solved.Dd_m);
  writeDriverBack(params.BL_Tm, solved.BL_Tm); writeDriverBack(params.Mms_kg, solved.Mms_kg);
  writeDriverBack(params.Cms_m_per_N, solved.Cms_m_per_N); writeDriverBack(params.Rms_kg_per_s, solved.Rms_kg_per_s);
  writeDriverBack(params.EBP_hz, solved.EBP_hz); writeDriverBack(params.Xmax_m, solved.Xmax_m); writeDriverBack(params.Vd_m3, solved.Vd_m3);
  writeDriverBack(params.Hc_m, solved.Hc_m); writeDriverBack(params.Hg_m, solved.Hg_m); writeDriverBack(params.Pe_W, solved.Pe_W);
  writeDriverBack(params.no, solved.no); writeDriverBack(params.SPLref_dB, solved.SPLref_dB); writeDriverBack(params.SPL_dB, solved.SPL_dB);
  writeDriverBack(params.USPL_dB, solved.USPL_dB); writeDriverBack(params.SPLmax_dB, solved.SPLmax_dB);
  writeDriverBack(params.SPLmaxLF_dB, solved.SPLmaxLF_dB); writeDriverBack(params.Rme_kg_per_s, solved.Rme_kg_per_s);
  writeDriverBack(params.Mpow_N_per_sqrtW, solved.Mpow_N_per_sqrtW); writeDriverBack(params.Mcost_kg_per_s, solved.Mcost_kg_per_s);
  writeDriverBack(params.gamma_m_per_s2_A, solved.gamma_m_per_s2_A); writeDriverBack(params.Gloss, solved.Gloss);
  writeDriverBack(params.Vcd_m, solved.Vcd_m); writeDriverBack(params.Depth_m, solved.Depth_m); writeDriverBack(params.MagDepth_m, solved.MagDepth_m);
  writeDriverBack(params.Magnet_m, solved.Magnet_m); writeDriverBack(params.DVol_m3, solved.DVol_m3); writeDriverBack(params.Re_terminal_ohm, solved.Re_terminal_ohm);
  writeDriverBack(params.BL_terminal_Tm, solved.BL_terminal_Tm);
  if (!params.c_m_per_s.entered) params.c_m_per_s.setCalculated(air.c);
  if (!params.roo_kg_per_m3.entered) params.roo_kg_per_m3.setCalculated(air.rho);

  return issues;
}
