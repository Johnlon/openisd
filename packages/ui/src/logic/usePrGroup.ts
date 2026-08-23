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
 *
 * Reads and writes go straight through `ManagedOpenISDProject`'s own PR/box accessors — the
 * box IS the storage (ledger QO54); there is no intermediate params object to mutate.
 */
import { prTuning, prMassForFp } from '@openisd/engine';
import type { ManagedOpenISDProject } from './managedProject.js';
import { suspendVentSolve } from './useVentGroup.js';

/** The two members tied by the tuning relation. */
export const PR_GROUP = ['prFp', 'prMadd'] as const;
export type PrField = typeof PR_GROUP[number];

function prParamsOf(mp: ManagedOpenISDProject) {
  return {
    Vb: mp.boxVolume_m3(),
    prSd: mp.prField('Sd_m2'),
    prCms: mp.prField('Cms_m_per_N'),
    prMmd: mp.prField('Mmd_kg'),
    prMadd: mp.prAddedMass_kg(),
  };
}

/** Enough of a PR to have a tuning at all — otherwise both members are Not-available. */
function prIsDefined(mp: ManagedOpenISDProject): boolean {
  return mp.boxVolume_m3() > 0 && mp.prField('Sd_m2') > 0 && mp.prField('Cms_m_per_N') > 0
    && mp.prField('Mmd_kg') > 0;
}

/**
 * Re-solve whichever member is CALCULATED from the entered one, in place. Never writes an
 * entered field, and solves nothing when both are entered — the same deliberate
 * over-determined behaviour as the vent group.
 */
export function solvePrGroup(mp: ManagedOpenISDProject): void {
  if (!prIsDefined(mp)) return;
  const fpEntered = mp.isEntered('prFp');
  const maddEntered = mp.isEntered('prMadd');
  if (fpEntered && !maddEntered) {
    const fp = mp.prFp_hz();
    if (fp > 0) {
      // prMassForFp returns TOTAL moving mass for the target; added mass is the excess over
      // the PR's own Mmd. Clamped at zero: you cannot remove mass from a radiator, so a
      // target above the PR's bare in-box resonance is simply unreachable by adding mass.
      const params = prParamsOf(mp);
      mp.setPrAddedMass_kg(Math.max(0, prMassForFp(params, fp) - params.prMmd));
    }
  } else if (!fpEntered) {
    mp.setPrFp_hz(prTuning(prParamsOf(mp)));
  }
}

/** Enter a PR-group field — held until explicitly cleared. */
export function enterPrField(mp: ManagedOpenISDProject, field: PrField, value: number): void {
  // The WHOLE transaction — value write, provenance write, AND the resulting solve — is
  // suspended: `appState.ts`'s coarse auto-solve watch fires on every `managedProject` mutation,
  // so an unguarded write-then-write would let it run on a half-updated entered set, and an
  // unguarded trailing `solvePrGroup()` call would let it re-fire a SECOND time on that call's
  // own write. One user action, one solve — the call inside this suspension is the only one.
  suspendVentSolve(() => {
    if (field === 'prFp') mp.setPrFp_hz(value);
    else mp.setPrAddedMass_kg(value);
    mp.setEntered(field, true);
    solvePrGroup(mp);
  });
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. Suspended for the
 *  same reason as `enterPrField` — one user action, one solve. */
export function clearPrField(mp: ManagedOpenISDProject, field: PrField): void {
  suspendVentSolve(() => {
    mp.setEntered(field, false);
    solvePrGroup(mp);
  });
}

/**
 * `E` entered and locked · `C` calculated from the other member · `N` not available — the PR
 * or the box is not defined enough for a tuning to exist.
 */
export function prFieldState(mp: ManagedOpenISDProject, field: PrField): 'E' | 'C' | 'N' {
  if (mp.isEntered(field)) return 'E';
  return prIsDefined(mp) ? 'C' : 'N';
}

/**
 * True when the entered target tuning cannot be reached by ADDING mass — i.e. the solver hit
 * its zero floor. The UI should say so rather than showing a mass of 0 as if it worked: the
 * honest answer is "this PR cannot tune that high in this box", and the fix is a different
 * radiator or a smaller box, not a number.
 */
export function prTargetUnreachable(mp: ManagedOpenISDProject): boolean {
  if (!mp.isEntered('prFp') || !prIsDefined(mp)) return false;
  const params = prParamsOf(mp);
  return prMassForFp(params, mp.prFp_hz()) - params.prMmd < 0;
}
