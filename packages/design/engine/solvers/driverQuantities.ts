import type {Wiring} from '../types.js';

// S2-10 (T10/T3-style trim): the bag types every solve used to take/return, PRIVATE now — a
// caller reaches every one of these quantities through a `SolverField` handle
// (`solveDriver`/`PrEngine.solve`/`VentEngine.solve`/`SealedEngine.solve`), never through a snapshot bag.
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
 * The voice-coil temperature coefficient (/K) the sums heat Re with (John, QO953.c16, T917): the driver's own
 * `alfaVC_per_K` when it is stated and not 0, else the project's. A negative driver value is no coil metal's (the
 * field's floor is non-negative) and would drive the hot Re below 0, so it counts as not stated. AlfaVC belongs to the coil wire's metal (copper
 * 0.00393 /K, aluminium about 0.0041-0.0043 /K); every catalogue driver and held .wdr stores 0, so they heat with
 * the project's value. `winisdProjectAlfaVC` (the "Coil coefficient from project" WinISD bug switch) gives WinISD's
 * sum back: the project's value only, whatever the driver says (WinISD 0.7.0 and 0.50a7 read only `[Box] alfaVC`).
 */
export function coilAlfaVC_per_K(driverAlfaVC_per_K: number | null, projectAlfaVC_per_K: number, winisdProjectAlfaVC: boolean): number {
  if (winisdProjectAlfaVC) return projectAlfaVC_per_K;
  return driverAlfaVC_per_K !== null && Number.isFinite(driverAlfaVC_per_K) && driverAlfaVC_per_K > 0
    ? driverAlfaVC_per_K
    : projectAlfaVC_per_K;
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
  const Qes = ws * Mms * Re_ohm / (BL_Tm * BL_Tm);   // ωs·Mms·Re/Bl², the published Re and Bl
  out.Mms_kg = Mms;
  out.Fs_hz  = ws / (2 * Math.PI);
  out.Qms    = Qms;
  out.Qes    = Qes;
  out.Qts    = (Qes * Qms) / (Qes + Qms);
  return out;
}

/**
 * The iso-barik pair as WinISD models it: two drivers acting as one, Mms×2, Cms/2, Rms×2, Vas/2
 * and the circuit's terminal BL ×√2, so Fs and the Q's are unchanged. The typed BL (the motor's
 * push) stays one driver's. Fitted to winisd_research runs/sealed-w5-isobarik (SPL, excursion,
 * TF to 3e-14); bugs/archive/BUG_20260928_isobarik-loading-not-simulated.md.
 */
export function isobarikPair(drv: Readonly<DriverWorkingSet>): DriverWorkingSet {
  const out: DriverWorkingSet = Object.assign({}, drv);
  if (drv.Mms_kg != null) out.Mms_kg = drv.Mms_kg * 2;
  if (drv.Cms_m_per_N != null) out.Cms_m_per_N = drv.Cms_m_per_N / 2;
  if (drv.Rms_kg_per_s != null) out.Rms_kg_per_s = drv.Rms_kg_per_s * 2;
  if (drv.Vas_m3 != null) out.Vas_m3 = drv.Vas_m3 / 2;
  if (drv.BL_terminal_Tm != null) out.BL_terminal_Tm = drv.BL_terminal_Tm * Math.SQRT2;
  return out;
}

/** A multi-coil driver's wiring-dependent figures: Re, BL, and Le and Znom where known. */
export interface WiredMotor {
  readonly Re_ohm: number;
  readonly BL_Tm: number;
  readonly Le_H: number | null;
  readonly Znom_ohm: number | null;
}

/** `motor` for the requested wiring. */
export interface WiringConverted {
  readonly converted: true;
  readonly motor: WiredMotor;
}

/** Why `motor` cannot be given for the requested wiring. */
export interface WiringRefused {
  readonly converted: false;
  readonly reason: string;
}

export type WiringConversion = WiringConverted | WiringRefused;

/**
 * The published figures of a driver with `numVC` identical coils, measured in `measured`, as they
 * are in `target` (QO900 R1). Series → parallel: Re ÷ N², BL ÷ N, Le and Znom ÷ N²; parallel →
 * series the inverse; the same wiring unchanged. (WinISD's routine converts Re and BL only: with `reBlOnly`, the yellow
 * switch "Coil wiring: Re and BL only", Le and Znom are returned as published, as WinISD does; QO942.c62.) Fs, the Q's, Mms, Cms and Vas do not depend on
 * the wiring, and Qes = 2π·Fs·Mms·Re/BL² comes out the same either way.
 *
 * Refused for fewer than 2 coils and an unknown measured wiring. Any number of coils above 1 converts, as
 * WinISD's routine does (numVC above 1; winisd_research FINDING_20261115, QO941).
 */
export function convertWiring(motor: WiredMotor, numVC: number | null, measured: Wiring | null, target: Wiring, reBlOnly = false): WiringConversion {
  if (numVC === null || numVC < 2) return {converted: false, reason: 'A driver with fewer than 2 voice coils has no wiring to change.'};
  if (measured === null) return {converted: false, reason: 'The measured wiring is not known, so the figures cannot be converted to another wiring.'};
  if (measured === target) return {converted: true, motor};
  const n = target === 'parallel' ? 1 / numVC : numVC;
  const scaled = (v: number | null): number | null => v === null || reBlOnly ? v : v * n * n;
  return {
    converted: true,
    motor: {Re_ohm: motor.Re_ohm * n * n, BL_Tm: motor.BL_Tm * n, Le_H: scaled(motor.Le_H), Znom_ohm: scaled(motor.Znom_ohm)},
  };
}
