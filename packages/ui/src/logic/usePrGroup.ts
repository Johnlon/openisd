/**
 * The passive-radiator tuning group — the two things about a PR design that are NOT
 * intrinsic to the part you bought.
 *
 * A PR's Sd, Cms, Mmd, Rms and Xmax are specifications of a physical component: you read
 * them off a datasheet once and they never change while designing. Vas, Fs and Qms are the
 * same facts in datasheet vocabulary. None of them is a design variable.
 *
 * What you actually flex is the SYSTEM TUNING — and the knob that moves it is added mass:
 *
 *     Fp = 1 / (2π·√(Map · Cpar))     Map = (Mmd + Madd)/Sd²,  Cpar = Cab·Cap/(Cab+Cap)
 *
 * One relation, two members: `prFp` and `prMadd`. Given the PR's intrinsics and the box
 * volume, pinning either solves the other. `prTuning()` goes one way and `prMassForFp()` —
 * its exact inverse — goes the other; both already existed, and only the second was wired,
 * to a single one-shot button.
 *
 * Same entered-set model as the vent group (`useVentGroup.ts`) and the driver
 * (`Driver.#inputs`), for the same reason: docs/design/STATE_MODEL.md rule 7 puts provenance where entry
 * happens rather than reconstructing it downstream. The default set is `{prMadd}` — mass
 * entered, tuning solved — which is the behaviour the panel has always had.
 *
 * PR count is deliberately NOT in this group: more radiators change the output but not the
 * tuning, so it is an independent entered value, not a member of this relation.
 */
import { prTuning, prMassForFp } from '@openisd/engine';
import type { UiParams } from '../types.js';

/** The two members tied by the tuning relation. */
export const PR_GROUP = ['prFp', 'prMadd'] as const;
export type PrField = typeof PR_GROUP[number];

/** Enough of a PR to have a tuning at all — otherwise both members are Not-available. */
function prIsDefined(P: UiParams): boolean {
  return P.Vb > 0 && P.prSd > 0 && P.prCms > 0 && P.prMmd > 0;
}

/**
 * Re-solve whichever member is CALCULATED from the entered one, in place. Never writes an
 * entered field, and solves nothing when both are entered — the same deliberate
 * over-determined behaviour as the vent group.
 */
export function solvePrGroup(P: UiParams): void {
  if (!prIsDefined(P)) return;
  if (P.entered.prFp && !P.entered.prMadd) {
    if (P.prFp > 0) {
      // prMassForFp returns TOTAL moving mass for the target; added mass is the excess over
      // the PR's own Mmd. Clamped at zero: you cannot remove mass from a radiator, so a
      // target above the PR's bare in-box resonance is simply unreachable by adding mass.
      P.prMadd = Math.max(0, prMassForFp(P, P.prFp) - P.prMmd);
    }
  } else if (!P.entered.prFp) {
    P.prFp = prTuning(P);
  }
}

/** Enter a PR-group field — held until explicitly cleared. */
export function enterPrField(P: UiParams, field: PrField, value: number): void {
  (P as unknown as Record<string, number>)[field] = value;
  P.entered[field] = true;
  solvePrGroup(P);
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(P: UiParams, field: PrField): void {
  delete P.entered[field];
  solvePrGroup(P);
}

/**
 * `E` entered and locked · `C` calculated from the other member · `N` not available — the PR
 * or the box is not defined enough for a tuning to exist.
 */
export function prFieldState(P: UiParams, field: PrField): 'E' | 'C' | 'N' {
  if (P.entered[field]) return 'E';
  return prIsDefined(P) ? 'C' : 'N';
}

/**
 * True when the entered target tuning cannot be reached by ADDING mass — i.e. the solver hit
 * its zero floor. The UI should say so rather than showing a mass of 0 as if it worked: the
 * honest answer is "this PR cannot tune that high in this box", and the fix is a different
 * radiator or a smaller box, not a number.
 */
export function prTargetUnreachable(P: UiParams): boolean {
  if (!P.entered.prFp || !prIsDefined(P)) return false;
  return prMassForFp(P, P.prFp) - P.prMmd < 0;
}
