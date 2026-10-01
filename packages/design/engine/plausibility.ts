/**
 * Is a designed vented box one anyone could build?
 *
 * The five wizard alignments keep PARITY with WinISD at every Qts — WinISD does
 * not clamp, and neither does `VentedEngine.alignment()` (John, 2026-09-22: "keep parity
 * and use dq"). C4 at a source-loaded Qts of 1.0 designs a 1684 L box tuned to 5.4 Hz, and that
 * is what both programs answer. Nothing here changes a designed value; this only says which of
 * them fall outside the band, so the caller can mark the cell.
 */
import {PARITY, quantified, subject} from './issueText.js';

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
  | {
      readonly kind: 'non-physical';
      readonly quantity: VentedDesignQuantity;
      readonly value: number;
      readonly text: string;
    }
  | {
      readonly kind: 'out-of-range';
      readonly quantity: VentedDesignQuantity;
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly text: string;
    };

/** A quantity that cannot be physical at all. The sentence is built here, with the issue, so a
 *  reader of `DqIssue.text` never needs the engine to render it.
 *
 *  Deliberately WITHOUT the `PARITY` suffix: the 60-capture WinISD evidence covers what the
 *  alignments answer for ordinary inputs (Qts 0.15–1.0, Ql 10), not their behaviour at the
 *  degenerate inputs that produce a non-physical value (BB4 at Qts' = Ql → Vb = ∞), so this
 *  sentence may not claim it (BUG_20261001 nonphysical-parity-text-overreach). */
export function nonPhysicalQuantity(quantity: VentedDesignQuantity, value: number): VentedPlausibilityIssue {
  return {
    kind: 'non-physical', quantity, value,
    text: `${subject(quantity)} is ${quantified(quantity, value)} - not a physical value. ` +
      `The alignment was evaluated outside the range it was validated for; the raw result is shown, not changed.`,
  };
}

/** A quantity outside the plausible band the user set in Settings. */
export function quantityOutOfBand(
  quantity: VentedDesignQuantity, value: number, min: number, max: number,
): VentedPlausibilityIssue {
  const band = `${quantified(quantity, min)} - ${quantified(quantity, max)}`;
  return {
    kind: 'out-of-range', quantity, value, min, max,
    text: `${subject(quantity)} is ${quantified(quantity, value)}, outside the plausible ${band} `
      + `band set in Settings. ${PARITY}`,
  };
}
