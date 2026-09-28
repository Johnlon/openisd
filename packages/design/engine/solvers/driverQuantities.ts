import type {Wiring} from '../types.js';

// S2-10 (T10/T3-style trim): the bag types every solve used to take/return, PRIVATE now — a
// caller reaches every one of these quantities through a `SolverField` handle
// (`solveDriver`/`PrEngine.solve`/`VentEngine.solve`/`solveSealedAlignment`), never through a snapshot bag.
// Kept as a plain WORKING SET only where the arithmetic genuinely needs one (an iterative
// fixpoint, a group of relations feeding each other) — never exported past this file.
export interface DriverWorkingSet {
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
