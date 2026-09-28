/**
 * The vented-box area of the engine: WinISD's five wizard alignments, bit-for-bit, and the
 * plausibility judgement on what they design — outside an alignment's design range WinISD
 * extrapolates (John, 2026-09-22: "keep parity and use dq"), so nothing here changes a designed
 * value; the judgement only says which of them a person should not trust, against the band the
 * user owns in Settings, read at call time so a Settings edit lands without a rebuild.
 */
import type {AppSettings} from '../appSettings.js';
import type {VentedAlignment, VentedDesign} from '../types.js';
import type {VentedDesignQuantity, VentedPlausibilityIssue} from '../plausibility.js';
import {nonPhysicalQuantity, quantityOutOfBand} from '../plausibility.js';

export interface VentedEngine {
  /** WinISD's five wizard vented alignments. `QtsLoaded` is `sourceLoadedQts()`'s answer, not
   *  the bare driver Qts; `Ql` is read by BB4/SBB4 only. */
  alignment(alignment: VentedAlignment, Fs_hz: number, QtsLoaded: number, Vas_m3: number, Ql: number): VentedDesign;
  /** Every reason a design should not be trusted, volume before tuning. Empty means buildable
   *  as far as the user's own band is concerned. */
  plausibility(design: VentedDesign): readonly VentedPlausibilityIssue[];
  /** A designed box volume alone. A project CELL holds one quantity, so it can only be marked
   *  for that quantity's own issue; `plausibility` answers for the wizard readout, which shows
   *  both at once. */
  volumeIssue(Vb_m3: number): VentedPlausibilityIssue | null;
  /** A designed tuning alone — `volumeIssue`'s counterpart. */
  tuningIssue(Fb_hz: number): VentedPlausibilityIssue | null;
}

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
function ventedAlphaAndH(alignment: VentedAlignment, Qts: number, Ql: number): AlignmentRatios {
  switch (alignment) {
    case 'bb4':  return { alpha: 0.25 * (1 / Qts - 1 / Ql) ** 2, h: 1 };
    case 'qb3':  return polynomialAlignment(QB3_POLY, Qts);
    case 'c4':   return polynomialAlignment(C4_POLY, Qts);
    case 'ebs3': return polynomialAlignment(EBS3_POLY, Qts);
    case 'ebs6': return polynomialAlignment(EBS6_POLY, Qts);
  }
}

/** One quantity paired with the band it is judged against — the judgement itself never asks
 *  WHICH quantity it is looking at, so both checks are the same three lines. */
interface JudgedQuantity {
  readonly quantity: VentedDesignQuantity;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

function judge(q: JudgedQuantity): VentedPlausibilityIssue | null {
  if (!Number.isFinite(q.value) || q.value <= 0) {
    return nonPhysicalQuantity(q.quantity, q.value);
  }
  if (q.value < q.min || q.value > q.max) {
    return quantityOutOfBand(q.quantity, q.value, q.min, q.max);
  }
  return null;
}

export class VentedEngineImpl implements VentedEngine {
  readonly #settings: AppSettings;

  constructor(settings: AppSettings) {
    this.#settings = settings;
  }

  alignment(alignment: VentedAlignment, Fs_hz: number, QtsLoaded: number, Vas_m3: number, Ql: number): VentedDesign {
    const { alpha, h } = ventedAlphaAndH(alignment, QtsLoaded, Ql);
    return { Vb: Vas_m3 / alpha, Fb: h * Fs_hz };
  }

  plausibility(design: VentedDesign): readonly VentedPlausibilityIssue[] {
    const both = [this.volumeIssue(design.Vb), this.tuningIssue(design.Fb)];
    return both.filter((i): i is VentedPlausibilityIssue => i !== null);
  }

  volumeIssue(Vb_m3: number): VentedPlausibilityIssue | null {
    const limits = this.#settings.ventedLimits();
    return judge({ quantity: 'Vb', value: Vb_m3, min: limits.minVb_m3, max: limits.maxVb_m3 });
  }

  tuningIssue(Fb_hz: number): VentedPlausibilityIssue | null {
    const limits = this.#settings.ventedLimits();
    return judge({ quantity: 'Fb', value: Fb_hz, min: limits.minFb_hz, max: limits.maxFb_hz });
  }
}
