/**
 * Is a designed vented box one anyone could build?
 *
 * The five wizard alignments keep PARITY with WinISD outside their design range — WinISD does
 * not clamp, it extrapolates, and so does `ventedAlignment()` (John, 2026-09-22: "keep parity
 * and use dq"). C4 at a source-loaded Qts of 1.0 designs a 1684 L box tuned to 5.4 Hz, and that
 * is what both programs answer. Nothing here changes a designed value; this only says which of
 * them a person should not trust, so the caller can mark the cell.
 */
import type {VentedDesign} from './types.js';

/** Which of a vented design's two answers an issue is about — `VentedDesign`'s own member
 *  names, so there is one name per quantity rather than a parallel prose vocabulary. */
export type VentedDesignQuantity = 'Vb' | 'Fb';

/**
 * The plausibility band a vented design is judged against. NOT physics and NOT a constant of
 * the engine: an application setting the user owns and edits (the Settings tab), which is why
 * every call states it. `DEFAULT_VENTED_DESIGN_LIMITS` is only where that setting starts.
 */
export interface VentedDesignLimits {
  readonly minVb_m3: number;
  readonly maxVb_m3: number;
  readonly minFb_hz: number;
  readonly maxFb_hz: number;
}

/**
 * One reason a designed value should not be trusted.
 *
 * `non-physical` is absolute — zero, negative or not a finite number is not a box or a tuning,
 * and no setting makes it one. `out-of-range` is the user's own judgement: a real value that
 * falls outside the band they set.
 */
export type VentedPlausibilityIssue =
  | { readonly kind: 'non-physical'; readonly quantity: VentedDesignQuantity; readonly value: number }
  | {
      readonly kind: 'out-of-range';
      readonly quantity: VentedDesignQuantity;
      readonly value: number;
      readonly min: number;
      readonly max: number;
    };

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
    return { kind: 'non-physical', quantity: q.quantity, value: q.value };
  }
  if (q.value < q.min || q.value > q.max) {
    return { kind: 'out-of-range', quantity: q.quantity, value: q.value, min: q.min, max: q.max };
  }
  return null;
}

/** A designed box volume alone. A project CELL carries one quantity and can only be marked for
 *  that quantity's own issue, so the per-quantity judgement is the primitive and the
 *  whole-design one below is the pair of them. */
export function ventedVolumePlausibility(
  Vb_m3: number,
  limits: VentedDesignLimits,
): VentedPlausibilityIssue | null {
  return judge({ quantity: 'Vb', value: Vb_m3, min: limits.minVb_m3, max: limits.maxVb_m3 });
}

/** A designed tuning alone — `ventedVolumePlausibility`'s counterpart. */
export function ventedTuningPlausibility(
  Fb_hz: number,
  limits: VentedDesignLimits,
): VentedPlausibilityIssue | null {
  return judge({ quantity: 'Fb', value: Fb_hz, min: limits.minFb_hz, max: limits.maxFb_hz });
}

/** Every reason this design should not be trusted, volume before tuning. Empty means buildable
 *  as far as the user's own band is concerned. */
export function ventedPlausibility(
  design: VentedDesign,
  limits: VentedDesignLimits,
): readonly VentedPlausibilityIssue[] {
  const both = [
    ventedVolumePlausibility(design.Vb, limits),
    ventedTuningPlausibility(design.Fb, limits),
  ];
  return both.filter((i): i is VentedPlausibilityIssue => i !== null);
}

