/**
 * Enclosure alignment calculations.
 *
 * T/S parameter equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 *
 * Port tuning (Helmholtz resonator):
 *   https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * Authoritative sources (paywalled):
 *   Thiele, A.N. "Loudspeakers in Vented Boxes, Part I." JAES 19(5) 1971.
 *   https://aes.org/e-lib/browse.cfm?elib=1967
 *
 *   Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2062
 *
 *   Small, R.H. "Vented-Box Loudspeaker Systems — Part I." JAES 21(5) 1973.
 *   https://aes.org/e-lib/browse.cfm?elib=2149
 *
 *   Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
 *   https://aes.org/e-lib/browse.cfm?elib=2223
 */

import type {Air} from './air.js';
import {END_CORRECTION} from './air.js';
import type {EbpSuitability, SealedAlignmentOption, SweepParams, SweepResult, VentedAlignment, VentedDesign} from './types.js';
import {SEALED_ALIGNMENT_OPTIONS} from '../fields/options.js';

// JL: FIXME - suspect - why not the params from the DS or why specicla pr params needed for this
/** The subset of params the PR helpers read — lets callers pass any params object
 *  (engine SweepParams, or the UI's UiParams/SyncedParams) that carries these fields. */
type PRParams = Pick<SweepParams, 'Vb' | 'prMmd' | 'prMadd' | 'prSd' | 'prCms'>;

// Each alignment helper takes exactly the T/S fields it reads (a full Driver or a
// bare T/S fixture both satisfy the Pick — they never touch the derived Cms/Mms/Bl).

/**
 * Efficiency Bandwidth Product — criterion for enclosure type selection.
 * EBP = Fs / Qes.  EBP < 50 → sealed preferred; EBP > 100 → vented preferred.
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
export function ebp(Fs_hz: number, Qes: number): number { return Fs_hz / Qes; }

/**
 * Sealed box volume for a target system Q (Qtc).
 * Qtc = Qts · √(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function sealedFromQtc(Qts: number, Vas_m3: number, Qtc: number): number | null {
  const ratio = (Qtc / Qts) ** 2 - 1;
  return ratio <= 0 ? null : Vas_m3 / ratio;
}

export function sealedAlignmentOptions(): readonly SealedAlignmentOption[] {
  return SEALED_ALIGNMENT_OPTIONS;
}

export function sealedQtcFromVolume(Qts: number, Vas_m3: number, Vb_m3: number): number | null {
  if (!(Qts > 0) || !(Vas_m3 > 0) || !(Vb_m3 > 0)) return null;
  return Qts * Math.sqrt(1 + Vas_m3 / Vb_m3);
}

export function closestSealedAlignment(Qtc: number): SealedAlignmentOption {
  return SEALED_ALIGNMENT_OPTIONS.reduce((closest, option) =>
    Math.abs(option.value - Qtc) < Math.abs(closest.value - Qtc) ? option : closest,
  );
}

export function ebpSuitability(EBP_hz: number): EbpSuitability {
  if (EBP_hz < 50) return 'sealed';
  if (EBP_hz > 100) return 'vented';
  return 'either';
}

/**
 * WinISD's vented-alignment polynomials, one pair per alignment: `alpha = exp(P_alpha(ln Qts))`,
 * `h = exp(P_h(ln Qts))`. Coefficients highest degree first, read as 10-byte x87 literals from
 * `winisd.exe` `0x5ea700`–`0x5ea9e0` (`winisd_research/GHIDRA_FINDINGS.md`, "VENTED ALIGNMENT
 * MECHANISM FOUND — `0x46afd0`"). They are the program's own fits to the classic Ql=7 alignment
 * tables; Ql is not an input to these four. Captures cover Qts' 0.25–0.60.
 */
interface VentedPolynomials {
  readonly alpha: readonly number[];
  readonly h: readonly number[];
}

const QB3_POLY: VentedPolynomials = Object.freeze({
  alpha: Object.freeze([
    -0.527653766418192, -4.045037842606329, -10.388310807896415, -5.25594713440707,
    21.601394321188952, 40.33530712040413, 22.661419872287436, 2.717622080740771,
  ]),
  h: Object.freeze([
    -0.029801244681591, -0.195366397032358, -0.437959753294342, -1.355136486318576,
    -0.999127306592246,
  ]),
});

const EBS3_POLY: VentedPolynomials = Object.freeze({
  alpha: Object.freeze([
    0.006359580444886, 0.284719820427248, 1.201995900184085, -0.509649345433783,
    -1.784408772362153,
  ]),
  h: Object.freeze([
    0.015424255373668, 0.172186160819739, 0.620617168304417, -0.084975509883162,
    -0.76456030458537,
  ]),
});

const EBS6_POLY: VentedPolynomials = Object.freeze({
  alpha: Object.freeze([
    -0.229471801052817, -0.901670322424065, -0.410672175645899, -0.41030467280452,
    -1.207690336319967,
  ]),
  h: Object.freeze([
    -0.229066066258841, -1.231981240907907, -2.116888241589388, -2.07475979269649,
    -1.434673514434639,
  ]),
});

const C4_POLY: VentedPolynomials = Object.freeze({
  alpha: Object.freeze([
    2.042092829582793, -0.285129728592432, -25.76924674836319, -53.426473674138194,
    -41.84812814959069, -16.515214504570608, -4.222667174871261,
  ]),
  h: Object.freeze([
    -2.661465684928509, -17.790020226363403, -45.116813494746765, -54.76142489283109,
    -33.41178255237291, -10.570811827917767, -1.866019821604128,
  ]),
});

/** The two dimensionless numbers an alignment fixes: `alpha = Vas/Vb`, `h = Fb/Fs`. */
interface AlignmentRatios {
  readonly alpha: number;
  readonly h: number;
}

/** Horner evaluation, coefficients highest degree first — the order WinISD's code runs. */
function horner(coefficients: readonly number[], x: number): number {
  return coefficients.reduce((acc, c) => acc * x + c, 0);
}

/** `alpha = Vas/Vb` and `h = Fb/Fs` from a polynomial pair in `ln(Qts)`. */
function polynomialAlignment(poly: VentedPolynomials, Qts: number): AlignmentRatios {
  const x = Math.log(Qts);
  return { alpha: Math.exp(horner(poly.alpha, x)), h: Math.exp(horner(poly.h, x)) };
}

/**
 * Vented box design as WinISD's New Project wizard does it — reproduces its `.wpr` `Vb`/`Fb`
 * to floating-point noise (60 captures, Qts 0.15–1.0, ≤ 2.3e-14 relative; `winisd_research/
 * runs/vented_alignment_validation.md`). No clamp: outside ~0.25–0.6 WinISD extrapolates the
 * polynomials, and so does this.
 *
 * `QtsLoaded` is the SOURCE-LOADED Qts: WinISD folds the project's series resistance Rg into
 * Qes before designing (`sourceLoadedQts()` in `lossMode.ts`). Passing the bare driver Qts
 * gives a Vb ~3 % low at Rg = 0.1 Ω / Re = 6 Ω — the wizard's box is for the driver as driven.
 *
 *   BB4/SBB4:              alpha = ¼·(1/Qts' − 1/Ql)²,   h = 1     (Ql read here only)
 *   QB3, C4/SC4, EBS3/6:   alpha = exp(P_alpha(ln Qts')), h = exp(P_h(ln Qts'))
 *   Vb = Vas / alpha,  Fb = h · Fs
 *
 * Decompile and validation: `winisd_research/GHIDRA_FINDINGS.md`, "VENTED ALIGNMENT MECHANISM
 * FOUND — `0x46afd0`"; OpenISD summary `docs/research/VENTED_ALIGNMENT_FORMULAS.md`.
 */
export function ventedAlignment(alignment: VentedAlignment, Fs_hz: number, QtsLoaded: number, Vas_m3: number, Ql: number): VentedDesign {
  const { alpha, h } = ventedAlphaAndH(alignment, QtsLoaded, Ql);
  return { Vb: Vas_m3 / alpha, Fb: h * Fs_hz };
}

function ventedAlphaAndH(alignment: VentedAlignment, Qts: number, Ql: number): AlignmentRatios {
  switch (alignment) {
    case 'bb4':  return { alpha: 0.25 * (1 / Qts - 1 / Ql) ** 2, h: 1 };
    case 'qb3':  return polynomialAlignment(QB3_POLY, Qts);
    case 'c4':   return polynomialAlignment(C4_POLY, Qts);
    case 'ebs3': return polynomialAlignment(EBS3_POLY, Qts);
    case 'ebs6': return polynomialAlignment(EBS6_POLY, Qts);
  }
}

/**
 * Physical vent length for a target tuning frequency.
 * Helmholtz resonator: f = (c/2π) · √(A / (V₀ · L_eq))
 * where L_eq = L + END_CORRECTION·d  (flanged at the baffle, free into the box)
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * The result is the RAW SIGNED root, never clamped. The end correction alone already supplies
 * acoustic mass, so every volume + port area has a ceiling — the tuning at L = 0 — above which
 * the equation's only solution is a negative length. That negative IS the answer: it says the
 * target is unreachable and by how much, it round-trips exactly through `tuningFromLength()`,
 * and callers guard on `> 0`. Flooring it instead would return a buildable-looking vent that
 * tunes somewhere else entirely, which is a wrong number wearing a right one's clothes.
 *
 * `Sp` is ONE port's area and `count` how many identical ports there are: the air-mass term sees
 * the total opening `count·Sp`, while the end correction is a per-port effect and keeps the
 * single port's equivalent diameter `d = 2·√(Sp/π)`.
 *
 * `air` is the PROJECT's own resolved `{ rho, c }` — never a reference-condition default computed
 * inside this module. The caller (ultimately `OpenISDBox`, via its embedded driver's already-
 * resolved air — Driver Air Constants, `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`)
 * decides what air a design runs in; this function only computes the physics for whatever air it
 * is handed.
 */
export function ventLength(Vb: number, fb: number, Sp: number, count: number, air: Air, endCorrection: number = END_CORRECTION): number {
  const Cab = Vb / (air.rho * air.c * air.c);
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  return Map * count * Sp / air.rho - endCorrection * d;
}

/**
 * Port tuning frequency from physical dimensions.
 * f = (c/2π) · √(count·Sp / (Vb · L_eq))  where L_eq = L + END_CORRECTION·d, d from ONE port
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * `air` — see `ventLength`'s doc comment above; the same rule applies here.
 */
export function tuningFromLength(Vb: number, L: number, Sp: number, count: number, air: Air, endCorrection: number = END_CORRECTION): number {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + endCorrection * d;
  const Cab  = Vb / (air.rho * air.c * air.c);
  const Map  = air.rho * Leff / (count * Sp);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}

/**
 * Passive radiator system resonance frequency.
 * PR compliance Cap = prCms·prSd² combines with box compliance Cab in series:
 * Cpar = Cab·Cap/(Cab+Cap);  fp = 1/(2π·√(Map·Cpar))
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * `air` — see `ventLength`'s doc comment above; the same rule applies here.
 */
export function prTuning(P: PRParams, air: Air): number {
  const Cab  = P.Vb / (air.rho * air.c * air.c);
  const Map  = (P.prMmd! + P.prMadd!) / (P.prSd! * P.prSd!);
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cpar));
}

/**
 * PR moving mass required to achieve a target fp.
 * Inverts prTuning(): Map = 1/((2π·fp)²·Cpar),  Mmp = Map·prSd²
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * `air` — see `ventLength`'s doc comment above; the same rule applies here.
 */
export function prMassForFp(P: PRParams, fp: number, air: Air): number {
  const Cab  = P.Vb / (air.rho * air.c * air.c);
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd! * P.prSd!;
}

/**
 * Passive radiator free-air resonance with added mass.
 * Analogous to a driver's Fs but for the PR cone with mass loading:
 *   Fs_pr = 1 / (2π · √((Mmd + Madd) · Cms))
 * This is a mechanical resonance of the radiator alone — no box, no air compliance —
 * used to display the PR's effective resonant frequency as a function of added weight.
 */
export function prFsWithMass(Mmd_kg: number, Madd_kg: number, Cms_m_per_N: number): number {
  return 1 / (2 * Math.PI * Math.sqrt((Mmd_kg + Madd_kg) * Cms_m_per_N));
}

/**
 * Finds the actual system resonance (Fsc) and Q (Qtc) from the simulated impedance curve
 * of a sealed/closed box, taking box leakage/absorption losses into account (TS method).
 */
export function findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
  if (!result || result.fs.length === 0 || !Re || Re <= 0) return null;

  let maxZ = -1;
  let peakIdx = -1;
  for (let i = 0; i < result.fs.length; i++) {
    if (result.zmag[i] > maxZ) {
      maxZ = result.zmag[i];
      peakIdx = i;
    }
  }

  if (peakIdx === -1 || maxZ <= Re) return null;

  const peakFreq = result.fs[peakIdx];
  // r0 = maxZ/Re is always > 1 here: the guard above already refused maxZ <= Re, and Re > 0
  // was refused earlier still, so a "r0 <= 1" guard here could never fire — removed rather
  // than left as dead defensive code.
  const r0 = maxZ / Re;
  const Z_target = Re * Math.sqrt(r0);

  // Find f1 (below peakIdx)
  let f1 = -1;
  for (let i = peakIdx; i >= 0; i--) {
    if (result.zmag[i] <= Z_target) {
      const fA = result.fs[i];
      const fB = result.fs[i + 1];
      const zA = result.zmag[i];
      const zB = result.zmag[i + 1];
      // zB is the previous loop iteration's point (one step towards the peak): it failed this
      // same "<= Z_target" test, so zB > Z_target >= zA strictly — zA and zB can never be
      // equal, so the interpolation denominator is never zero.
      f1 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
      break;
    }
  }

  // Find f2 (above peakIdx)
  let f2 = -1;
  for (let i = peakIdx; i < result.fs.length; i++) {
    if (result.zmag[i] <= Z_target) {
      const fA = result.fs[i - 1];
      const fB = result.fs[i];
      const zA = result.zmag[i - 1];
      const zB = result.zmag[i];
      // zA is the previous loop iteration's point (one step towards the peak): it failed this
      // same "<= Z_target" test, so zA > Z_target >= zB strictly — never equal to zB.
      f2 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
      break;
    }
  }

  if (f1 === -1 || f2 === -1 || f2 <= f1) {
    return { Fsc: peakFreq, Qtc: 0 };
  }

  const Qmc = (peakFreq * Math.sqrt(r0)) / (f2 - f1);
  const Qtc = Qmc / r0;

  return { Fsc: peakFreq, Qtc };
}
