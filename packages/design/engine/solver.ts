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

import { P0, G_STANDARD } from './constants.js';
import type { Wiring } from './types.js';
import { GAMMA, DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA, moistAirDensity, moistAirSoundVelocity } from './air.js';
import { efficiencyConstant, referenceEfficiency, splFromEfficiency, efficiencyFromSpl } from './efficiency.js';
import { ebp } from './boxDesign.js';
import { dvolFromDims, depthFromDims, magDepthFromDims, magnetFromDims } from './dvolRelation.js';
import type { SolverQuantities, QuantityName } from './solverQuantities.js';



/**
 * A driver record's own speed of sound — matches WinISD's own resolution rule
 * (`docs/design/WINISD_SCHEMA.md` §12): the record's stated `c`; else recomputed from its
 * stated `roo` via `c = √(γ·p/roo)`; else the live physical model at the reference
 * environment. Never a stored constant — WinISD has none either.
 */
export function driverC(r: Readonly<SolverQuantities>): number {
  if (r.c_m_per_s != null && r.c_m_per_s > 0) return r.c_m_per_s;
  if (r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0) return Math.sqrt(GAMMA * DEFAULT_P_REF_PA / r.roo_kg_per_m3);
  return moistAirSoundVelocity(DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA);
}

/**
 * A driver record's own air density — its stated `roo`, else the live physical model at the
 * reference environment. WinISD never recomputes a missing `roo` from `c` — matched here.
 */
export function driverRho(r: Readonly<SolverQuantities>): number {
  return r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0 ? r.roo_kg_per_m3 : moistAirDensity(DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA);
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
export function solveConsistencyGroup(p: SolverQuantities): SolverQuantities {
  // The result is a SUPERSET of the input: every quantity handed in comes back out, plus what
  // the solver derived. `numVC` and `wiring` ride along untouched — the solver READS them, to
  // finish the terminal values below, and never consumes them; dropping them would make
  // re-solving a result lossy.
  const r: SolverQuantities = { ...p };


  const TAU = 2 * Math.PI;


  let changed = true;
  let iterations = 0;

  while (changed && iterations < 10) {
    changed = false;

    const setVal = (key: QuantityName, val: number) => {
      if (r[key] == null && isFinite(val) && val > 0) {
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

    // 4. Vas, Cms, Sd
    if (r.Vas_m3 == null && r.Cms_m_per_N != null && r.Sd_m2 != null) setVal('Vas_m3', driverRho(r) * driverC(r) * driverC(r) * r.Sd_m2 * r.Sd_m2 * r.Cms_m_per_N);

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

    // 10. no, Fs, Qes, Vas — Fs-from-this-triple is rel 14, tried in block 3 above.
    if (r.no == null && r.Fs_hz != null && r.Vas_m3 != null && r.Qes != null) {
      setVal('no', referenceEfficiency(r.Fs_hz, r.Vas_m3, r.Qes, driverC(r)));
    }
    if (r.Vas_m3 == null && r.no != null && r.Qes != null && r.Fs_hz != null && r.Fs_hz > 0) {
      setVal('Vas_m3', r.no * r.Qes / (efficiencyConstant(driverC(r)) * (r.Fs_hz ** 3)));
    }
    if (r.Qes == null && r.no != null && r.Fs_hz != null && r.Vas_m3 != null && r.no > 0) {
      setVal('Qes', efficiencyConstant(driverC(r)) * (r.Fs_hz ** 3) * r.Vas_m3 / r.no);
    }

    // 11. SPLref <-> no
    if (r.SPLref_dB == null && r.no != null && r.no > 0) {
      setVal('SPLref_dB', splFromEfficiency(r.no, driverRho(r), driverC(r)));
    }
    if (r.no == null && r.SPLref_dB != null) {
      setVal('no', efficiencyFromSpl(r.SPLref_dB, driverRho(r), driverC(r)));
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
  if (r.c_m_per_s == null) r.c_m_per_s = driverC(r);
  if (r.roo_kg_per_m3 == null) r.roo_kg_per_m3 = driverRho(r);

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
export function withAddedMass(drv: Readonly<SolverQuantities>, MaddKg: number): SolverQuantities {
  const out: SolverQuantities = Object.assign({}, drv);
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
