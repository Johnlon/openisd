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
 * just as hard — the ENTERED SET is the stored fact (`UiParams.entered`). Both `Fb` and
 * `ventL` remain fields; provenance decides which is authoritative. This is the same model
 * the driver already uses (`Driver.#inputs`, docs/DRIVER_ADT_DESIGN.md) and what
 * STATE_MODEL.md rule 7 requires: provenance recorded where entry happens, never
 * reconstructed downstream from "is the field present".
 *
 * Note this is a GENERALISATION of WinISD, not a copy of it: WinISD's Vents tab is fixed —
 * only vent count and diameter are editable, with length, cross area and port resonance
 * greyed. Letting the pair swap roles is ours, and is what the "pin any subset" vent solver
 * (BACKLOG P2) is built on.
 *
 * Lives in a composable, not in a skin and not in the store, per ARCHITECTURE.md AD-7 —
 * three skins mean three chances to get the commit boundary wrong.
 */
import { ventLength, tuningFromLength } from '@openisd/engine';
import type { UiParams } from '../types.js';

/** The four members tied by the Helmholtz relation — the set the solver solves WITHIN. */
export const VENT_GROUP = ['Vb', 'ventD', 'Fb', 'ventL'] as const;
export type VentField = typeof VENT_GROUP[number];

/**
 * What a human can ENTER — wider than what the solver solves, because a slotted vent states
 * its cross-section as width × height where a round one states a diameter.
 *
 * `ventW`/`ventH` are deliberately NOT members of VENT_GROUP. That set is what
 * `ventDerivable` walks (`VENT_GROUP.every(f => f === field || P.entered[f])`), so a slotted
 * field inside it would demand slotted geometry be entered before ANY round-vent member could
 * be solved — silently disabling the solver for the common case.
 */
export const VENT_ENTRY_FIELDS = [...VENT_GROUP, 'ventW', 'ventH'] as const;
export type VentEntryField = typeof VENT_ENTRY_FIELDS[number];

/** Cross-sectional area of a round vent of diameter `d`. */
export function ventSp(ventD: number): number {
  return Math.PI * (ventD / 2) ** 2;
}

/**
 * Can `field` be solved from the current entered set? One equation solves one unknown, so
 * every OTHER member must be entered.
 *
 * `ventD` is deliberately never derivable: it appears in both `Sp` and `Leff`, so solving for
 * it has no closed form. Cleared, it is genuinely Not-available — reporting `C` there would
 * mean showing a number nothing computed.
 */
export function ventDerivable(P: UiParams, field: VentField, box?: string): boolean {
  if (field === 'ventD') return false;
  const volEntered = box === 'bandpass4' ? true : P.entered.Vb; // Vf is always entered
  if (P.ventShape === 'slotted') {
    if (field === 'Fb') return !!(volEntered && P.entered.ventL);
    if (field === 'ventL') return !!(volEntered && P.entered.Fb);
    return false;
  }
  return VENT_GROUP.every(f => f === field || (f === 'Vb' ? volEntered : P.entered[f]));
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
export function solveVentGroup(P: UiParams, box?: string): void {
  const Sp = P.ventShape === 'slotted' ? P.ventW * P.ventH : ventSp(P.ventD);
  const V = box === 'bandpass4' ? P.Vf : P.Vb;
  if (!(V > 0) || !(Sp > 0)) return;
  if (!P.entered.ventL && ventDerivable(P, 'ventL', box)) {
    if (P.Fb > 0) P.ventL = ventLength(V, P.Fb, Sp, P.endCorrection);
  } else if (!P.entered.Fb && ventDerivable(P, 'Fb', box)) {
    if (P.ventL > 0) P.Fb = tuningFromLength(V, P.ventL, Sp, P.endCorrection);
  }
}

/**
 * Enter a vent-group field. It is held from now on and is never recomputed, until an
 * explicit `clearVentField`. Entering the second of the Fb/ventL pair does NOT evict the
 * first — it locks both, and the group then solves nothing (see solveVentGroup).
 */
export function enterVentField(P: UiParams, field: VentEntryField, value: number, box?: string): void {
  (P as unknown as Record<string, number>)[field] = value;
  P.entered[field] = true;
  if (field === 'ventD' || field === 'ventW' || field === 'ventH') {
    P.entered.Fb = true;
    delete P.entered.ventL;
  }
  solveVentGroup(P, box);
}

/**
 * Clear a vent-group field — the only way to un-hold one. It becomes `C` immediately if the
 * remaining entered set determines it, or `N` if nothing can.
 */
export function clearVentField(P: UiParams, field: VentField, box?: string): void {
  delete P.entered[field];
  solveVentGroup(P, box);
}

/**
 * `E` entered and locked · `C` calculated from the entered set · `N` not available — neither
 * entered nor derivable. Same vocabulary, and same meaning, as the driver editor's cells.
 */
export function ventFieldState(P: UiParams, field: VentField, box?: string): 'E' | 'C' | 'N' {
  if (P.entered[field]) return 'E';
  return ventDerivable(P, field, box) ? 'C' : 'N';
}

// ---- Restore suspension (STATE_MODEL.md rule 3: "Cancel means byte-identical") -----------
// A restore assigns a whole persisted `P` — both the entered set AND both members' values.
// There is nothing to recompute, and recomputing is exactly what breaks byte-identity: the
// solver would reproduce the calculated member from a value that was rounded on the way to
// storage, landing on a different double. Restores therefore run inside suspendVentSolve(),
// which parks the store's watcher while the assignment happens.
let _suspended = false;

/** True while a restore is in flight — the store's watcher checks this and does not solve. */
export function ventSolveSuspended(): boolean {
  return _suspended;
}

/**
 * Run `fn` with vent solving parked, so a wholesale `P` assignment is adopted verbatim.
 * Re-entrant-safe and exception-safe: the flag is always cleared.
 */
export function suspendVentSolve<T>(fn: () => T): T {
  const prev = _suspended;
  _suspended = true;
  try { return fn(); } finally { _suspended = prev; }
}
