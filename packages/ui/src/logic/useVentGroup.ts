/**
 * The vent group — which of `Vb`, `ventD`, `Fb`, `ventL` is HELD and which is SOLVED.
 *
 * One relation ties all four:
 *
 *     Fb = (c/2π)·√( Sp / (Vb · Leff) )        Sp = π(d/2)²,  Leff = L + k·d
 *
 * One equation solves one unknown, so three of the four are chosen and the fourth follows.
 * WinISD chooses `Vb`, `Fb` and the diameter and returns the LENGTH — you design to a tuning,
 * then build the port that delivers it. OpenISD historically chose the length and returned
 * the tuning, inverting that. **WinISD's direction is what ships as the default.**
 *
 * Rather than swap which field the schema holds — which would bake the opposite direction in
 * just as hard — the ENTERED SET is the stored fact (`_OpenISDProjectJson.target.entered`).
 * Both `Fb` and `ventL` remain fields; provenance decides which is authoritative. This is the
 * same model the driver already uses (`Driver.#inputs`, docs/DRIVER_ADT_DESIGN.md) and what
 * docs/design/STATE_MODEL.md rule 7 requires: provenance recorded where entry happens, never
 * reconstructed downstream from "is the field present".
 *
 * Note this is a GENERALISATION of WinISD, not a copy of it: WinISD's Vents tab is fixed —
 * only vent count and diameter are editable, with length, cross area and port resonance
 * greyed. Letting the pair swap roles is ours, and is what the "pin any subset" vent solver
 * (BACKLOG P2) is built on.
 *
 * Lives in a composable, not in a skin and not in the store, per ARCHITECTURE.md AD-7 —
 * three skins mean three chances to get the commit boundary wrong.
 *
 * Reads and writes go straight through `ManagedOpenISDProject`'s own box/vent accessors — the
 * box IS the storage (ledger QO54); there is no intermediate params object to mutate.
 */
import { ventLength, tuningFromLength } from '@openisd/engine';
import { ventArea_m2 } from '@openisd/model';
import type { ManagedOpenISDProject } from './managedProject.js';

/** The four members tied by the Helmholtz relation — the set the solver solves WITHIN. */
export const VENT_GROUP = ['Vb', 'ventD', 'Fb', 'ventL'] as const;
export type VentField = typeof VENT_GROUP[number];

/**
 * What a human can ENTER — wider than what the solver solves, because a slotted vent states
 * its cross-section as width × height where a round one states a diameter.
 *
 * `ventW`/`ventH` are deliberately NOT members of VENT_GROUP. That set is what
 * `ventDerivable` walks (`VENT_GROUP.every(f => f === field || mp.isEntered(f))`), so a
 * slotted field inside it would demand slotted geometry be entered before ANY round-vent
 * member could be solved — silently disabling the solver for the common case.
 */
export const VENT_ENTRY_FIELDS = [...VENT_GROUP, 'ventW', 'ventH'] as const;
export type VentEntryField = typeof VENT_ENTRY_FIELDS[number];

/** Cross-sectional area of a round vent of diameter `d` — delegates to the model package's
 *  `ventArea_m2()`, the one place this formula lives (bugs/BUG_20260818_vent_area_formula_
 *  duplicated_four_times_no_engine_source_of_truth.md). */
function ventSp(ventD: number): number {
  return ventArea_m2({ shape: 'round', diameter_m: ventD, width_m: 0, height_m: 0, length_m: 0, endCorrection: 0 });
}

/** The vent's cross-section as currently shaped — a round diameter, or a slot's W×H. */
export function ventCrossArea(mp: ManagedOpenISDProject): number {
  return mp.activeVentField('shape') === 'slotted'
    ? mp.activeVentField('width_m') * mp.activeVentField('height_m')
    : ventSp(mp.activeVentField('diameter_m'));
}

/**
 * The volume this vent tunes. Per-chamber, not per-box: a bandpass4's port belongs to its
 * FRONT chamber and tunes `Vf`; every other vented type ports the whole box, `Vb`.
 */
function ventVolume(mp: ManagedOpenISDProject, box?: string): number {
  return box === 'bandpass4' ? mp.frontVolume_m3() : mp.boxVolume_m3();
}

/**
 * Can `field` be solved from the current entered set? One equation solves one unknown, so
 * every OTHER member must be entered.
 *
 * `ventD` is deliberately never derivable: it appears in both `Sp` and `Leff`, so solving for
 * it has no closed form. Cleared, it is genuinely Not-available — reporting `C` there would
 * mean showing a number nothing computed.
 */
function ventDerivable(mp: ManagedOpenISDProject, field: VentField, box?: string): boolean {
  if (field === 'ventD') return false;
  const volEntered = box === 'bandpass4' ? true : mp.isEntered('Vb'); // Vf is always entered
  if (mp.activeVentField('shape') === 'slotted') {
    if (field === 'Fb') return !!(volEntered && mp.isEntered('ventL'));
    if (field === 'ventL') return !!(volEntered && mp.isEntered('Fb'));
    return false;
  }
  return VENT_GROUP.every(f => f === field || (f === 'Vb' ? volEntered : mp.isEntered(f)));
}

/**
 * Re-solve every CALCULATED member from the ENTERED ones, in place. Never writes a field
 * that is entered.
 *
 * An OVER-DETERMINED set (both `Fb` and `ventL` entered) solves nothing and is left exactly
 * as the user typed it. Deliberate, and it matches WinISD: live testing found it accepts
 * contradictory entered values silently — it took `Qts=0.9` alongside `Qms=3.3`/`Qes=0.44`,
 * which is mathematically impossible, with no warning and no correction.
 */
export function solveVentGroup(mp: ManagedOpenISDProject, box?: string): void {
  const Sp = ventCrossArea(mp);
  const V = ventVolume(mp, box);
  if (!(V > 0) || !(Sp > 0)) return;
  const endCorrection = mp.activeVentField('endCorrection');
  if (!mp.isEntered('ventL') && ventDerivable(mp, 'ventL', box)) {
    const Fb = mp.boxTuning_Fb_hz();
    if (Fb > 0) mp.setActiveVentField('length_m', ventLength(V, Fb, Sp, endCorrection));
  } else if (!mp.isEntered('Fb') && ventDerivable(mp, 'Fb', box)) {
    const ventL = mp.activeVentField('length_m');
    if (ventL > 0) mp.setBoxTuning_Fb_hz(tuningFromLength(V, ventL, Sp, endCorrection));
  }
}

const VENT_ENTRY_TO_MODEL_KEY = {
  Vb: null, ventD: 'diameter_m', Fb: null, ventL: 'length_m', ventW: 'width_m', ventH: 'height_m',
} as const;

/**
 * Enter a vent-group field. It is held from now on and is never recomputed, until an
 * explicit `clearVentField`. Entering the second of the Fb/ventL pair does NOT evict the
 * first — it locks both, and the group then solves nothing (see solveVentGroup).
 */
export function enterVentField(mp: ManagedOpenISDProject, field: VentEntryField, value: number, box?: string): void {
  // The WHOLE transaction — value write, provenance write(s), AND the resulting solve — is
  // suspended, so `store.ts`'s own auto-solve watch (which fires on every `managedProject`
  // mutation, coarse by design — `docs/design/REACTIVITY.md`) never runs for any write this
  // function makes: not on a half-updated entered set mid-transaction (it would clobber the
  // value this function is trying to set), and not a SECOND time on `solveVentGroup`'s own
  // write below (the store watch is not suspension-aware of ITS OWN future firing — its next
  // synchronous run, once suspension lifts, would otherwise re-solve a design that is already
  // solved, one user action producing two solves). One user action, one solve — the call
  // inside this suspension is the only one that runs.
  suspendVentSolve(() => {
    if (field === 'Vb') mp.setBoxVolume_m3(value);
    else if (field === 'Fb') mp.setBoxTuning_Fb_hz(value);
    else mp.setActiveVentField(VENT_ENTRY_TO_MODEL_KEY[field]!, value);
    mp.setEntered(field, true);
    if (field === 'ventD' || field === 'ventW' || field === 'ventH') {
      mp.setEntered('Fb', true);
      mp.setEntered('ventL', false);
    }
    solveVentGroup(mp, box);
  });
}

/**
 * Clear a vent-group field — the only way to un-hold one. It becomes `C` immediately if the
 * remaining entered set determines it, or `N` if nothing can.
 *
 * Suspended for the same reason as `enterVentField`: without it, the provenance write and this
 * function's own trailing `solveVentGroup` call would each independently trigger `store.ts`'s
 * auto-solve watch, producing two solves for one user action.
 */
export function clearVentField(mp: ManagedOpenISDProject, field: VentField, box?: string): void {
  suspendVentSolve(() => {
    mp.setEntered(field, false);
    solveVentGroup(mp, box);
  });
}

/**
 * `E` entered and locked · `C` calculated from the entered set · `N` not available — neither
 * entered nor derivable. Same vocabulary, and same meaning, as the driver editor's cells.
 */
export function ventFieldState(mp: ManagedOpenISDProject, field: VentField, box?: string): 'E' | 'C' | 'N' {
  if (mp.isEntered(field)) return 'E';
  return ventDerivable(mp, field, box) ? 'C' : 'N';
}

/**
 * The tuning the CURRENT vent length actually delivers. Asks `tuningFromLength()` — the
 * same relation `ventLength()` inverts — so there is one copy of the physics, not two.
 */
export function ventAchievedFb(mp: ManagedOpenISDProject, box?: string): number | null {
  const Sp = ventCrossArea(mp);
  const V = ventVolume(mp, box);
  const ventL = mp.activeVentField('length_m');
  if (!(V > 0) || !(Sp > 0) || !(ventL > 0)) return null;
  return tuningFromLength(V, ventL, Sp, mp.activeVentField('endCorrection'));
}

/**
 * The highest tuning this volume and port area can reach with ANY vent — the tuning at L = 0.
 * The end correction alone contributes acoustic mass, so a zero-length aperture still
 * resonates, and there is nothing shorter than nothing. Asks `tuningFromLength()`, so this is
 * the same single copy of the physics the solver inverts.
 */
export function ventMaxReachableFb(mp: ManagedOpenISDProject, box?: string): number | null {
  const Sp = ventCrossArea(mp);
  const V = ventVolume(mp, box);
  if (!(V > 0) || !(Sp > 0)) return null;
  return tuningFromLength(V, 0, Sp, mp.activeVentField('endCorrection'));
}

/**
 * True when the SOLVER cannot deliver the entered target tuning with this volume and port
 * area. Two ways it fails, and both are checked by CONSEQUENCE rather than by re-deriving a
 * limit — there is no second copy of the physics here:
 *
 *   - the solved length is not positive. No vent is shorter than nothing, so a zero or
 *     negative root means the target sits at or above the L = 0 ceiling.
 *   - the solved length is positive but feeding it back through `tuningFromLength()` does
 *     not reproduce the target. Nothing in the engine clamps today; this arm keeps the
 *     detector honest if any caller ever hands the group a length it did not solve.
 *
 * Reported only while the length is the SOLVED member. An entered length is the user's own
 * choice sitting alongside an entered tuning — over-determined, deliberately left alone
 * (see `solveVentGroup`), and no claim of the solver's to contradict.
 */
export function ventTargetUnreachable(mp: ManagedOpenISDProject, box?: string): boolean {
  const Fb = mp.boxTuning_Fb_hz();
  if (!mp.isEntered('Fb') || mp.isEntered('ventL')) return false;
  if (!ventDerivable(mp, 'ventL', box) || !(Fb > 0)) return false;
  if (ventMaxReachableFb(mp, box) == null) return false;   // no volume or area — nothing to judge
  const ventL = mp.activeVentField('length_m');
  if (!(ventL > 0)) return true;
  const achieved = ventAchievedFb(mp, box);
  if (achieved == null) return false;
  return Math.abs(achieved - Fb) > 1e-6 * Fb;
}

// ---- Restore suspension (docs/design/STATE_MODEL.md rule 3: "Cancel means byte-identical") -----------
// A restore assigns a whole persisted snapshot — both the entered set AND both members'
// values. There is nothing to recompute, and recomputing is exactly what breaks
// byte-identity: the solver would reproduce the calculated member from a value that was
// rounded on the way to storage, landing on a different double. Restores therefore run
// inside suspendVentSolve(), which parks the store's watcher while the assignment happens.
let _suspended = false;

/** True while a restore is in flight — the store's watcher checks this and does not solve. */
export function ventSolveSuspended(): boolean {
  return _suspended;
}

/**
 * Run `fn` with vent solving parked, so a wholesale restore is adopted verbatim.
 * Re-entrant-safe and exception-safe: the flag is always cleared.
 */
export function suspendVentSolve<T>(fn: () => T): T {
  const prev = _suspended;
  _suspended = true;
  try { return fn(); } finally { _suspended = prev; }
}
