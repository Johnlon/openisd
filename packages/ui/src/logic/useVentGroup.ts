/**
 * The vent group's UI seam. The physics — which of `Vb`, `ventD`, `Fb`, `ventL` is HELD and
 * which is SOLVED, the Helmholtz relation itself, reachability — lives on `OpenISDProject`
 * (`cell()`/`enter()`/`clear()`/`notifyVentChanged()`), the owner of the state. This module keeps
 * only what is genuinely a UI concern: the field vocabulary the shells bind, the E/C/N letter
 * the badges show, and the solve-suspension that parks `appState.ts`'s coarse auto-solve watch
 * so one user action produces one solve (and a wholesale restore is adopted verbatim,
 * byte-identical — docs/design/STATE_MODEL.md rule 3).
 */
import type {OpenISDProject} from '@openisd/design';
import type {ProvenanceLetter} from './fieldProvenance.js';
import {provenanceOfEntry} from './fieldProvenance.js';

/** The four members tied by the Helmholtz relation — the set the solver solves WITHIN. */
export const VENT_GROUP = ['Vb', 'ventD', 'Fb', 'ventL'] as const;
/** One of the four names listed above. */
export type VentField = typeof VENT_GROUP[number];

/**
 * What a human can ENTER — wider than what the solver solves, because a slotted vent states
 * its cross-section as width × height where a round one states a diameter.
 */
export const VENT_ENTRY_FIELDS = [...VENT_GROUP, 'ventW', 'ventH'] as const;
/** One of the names listed above. */
export type VentEntryField = typeof VENT_ENTRY_FIELDS[number];

/** A thin passthrough onto the domain's own reactivity ping (`usePrGroup.ts`'s
 *  `notifyPrChanged` already took this shape). S2-7d2 wires the tuning ↔ vent-length relation
 *  into `OpenISDProject#resolve()` itself, run synchronously by every `.set()`/`.clear()` this
 *  module's own `enterVentField`/`clearVentField` already make — so the manual Helmholtz solve
 *  this function used to perform (QO126's stub workaround, while the relation was unwired) is
 *  gone: it is now REDUNDANT with `#resolve()`, and worse, actively conflicting with it — calling
 *  `.set()` here on the "achieved" side re-entered it as a fresh fact, which (correctly) cleared
 *  its just-entered sibling and re-derived it a second time through the SAME formula, landing on
 *  a float a few ULPs off the value the user actually typed. */
export function notifyVentChanged(p: OpenISDProject): void {
  p.notifyVentChanged();
}

/** Enter a vent-group field — held until an explicit `clearVentField`. One user action, one
 *  solve: the domain solves inside `enter()`, and the suspension parks the auto-solve watch.
 *  `OpenISDProject` has no keyed accessor — this switch is the field-id dispatch,
 *  living here in the UI seam rather than as a generic method on the domain facade. */
let userEnteredPair: 'Fb' | 'ventL' | 'both' | 'none' = 'Fb';

export function resetVentGroupState(): void {
  userEnteredPair = 'Fb';
}

export function enterVentField(p: OpenISDProject, field: VentEntryField, value: number): void {
  suspendVentSolve(() => {
    p.batch(() => {
      switch (field) {
        case 'Vb': p.box.vented.volume_m3.set(value); break;
        case 'Fb':
          p.box.vented.tuning_goal_hz.set(value);
          userEnteredPair = (p.box.vented.vent.length_m.value !== null && userEnteredPair === 'ventL') ? 'both' : 'Fb';
          break;
        case 'ventD': p.box.vented.vent.diameter_m.set(value); break;
        case 'ventL':
          p.box.vented.vent.length_m.set(value);
          userEnteredPair = (p.box.vented.tuning_goal_hz.value !== null && userEnteredPair === 'Fb') ? 'both' : 'ventL';
          break;
        case 'ventW': p.box.vented.vent.width_m.set(value); break;
        case 'ventH': p.box.vented.vent.height_m.set(value); break;
      }
      p.notifyVentChanged();
    });
  });
}

/** Clear a vent-group field — it becomes `C` if the remaining entered set determines it, `N`
 *  if nothing can. `Vb` is mandatory on a vented box, so it has no cleared state to go to. */
export function clearVentField(p: OpenISDProject, field: Exclude<VentField, 'Vb'>): void {
  suspendVentSolve(() => {
    p.batch(() => {
      switch (field) {
        case 'Fb':
          p.box.vented.tuning_goal_hz.clear();
          if (userEnteredPair === 'both') {
            userEnteredPair = 'ventL';
          } else {
            userEnteredPair = 'none';
            p.box.vented.vent.length_m.clear();
          }
          break;
        case 'ventD': p.box.vented.vent.diameter_m.clear(); break;
        case 'ventL':
          p.box.vented.vent.length_m.clear();
          if (userEnteredPair === 'both') {
            userEnteredPair = 'Fb';
          } else {
            userEnteredPair = 'none';
            p.box.vented.tuning_goal_hz.clear();
          }
          break;
      }
      p.notifyVentChanged();
    });
  });
}

/** `E` entered and locked · `C` calculated · `N` not available — the badge letter for the
 *  domain's own provenance. */
export function ventFieldState(p: OpenISDProject, field: VentField): ProvenanceLetter {
  const fbVal = p.box.vented.tuning_goal_hz.value;
  const lenVal = p.box.vented.vent.length_m.value;

  if (field === 'Fb') {
    if (fbVal === null) return 'N';
    if (userEnteredPair === 'ventL' && lenVal !== null) return 'C';
    return 'E';
  }
  if (field === 'ventL') {
    if (lenVal === null) return 'N';
    if (userEnteredPair === 'Fb' && fbVal !== null) return 'C';
    return 'E';
  }
  // Neither field is ever derived: a volume is mandatory, a diameter is stated or absent.
  switch (field) {
    case 'Vb': return provenanceOfEntry(p.box.vented.volume_m3);
    case 'ventD': return provenanceOfEntry(p.box.vented.vent.diameter_m);
  }
}

/** The tuning the CURRENT vent length actually delivers. */
export function ventAchievedFb(p: OpenISDProject): number | null {
  return p.ventAchievedFb.value;
}

/** The highest tuning this volume and port area can reach with ANY vent (L = 0). */
export function ventMaxReachableFb(p: OpenISDProject): number | null {
  return p.ventMaxReachableFb.value;
}

// ---- Restore suspension (docs/design/STATE_MODEL.md rule 3: "Cancel means byte-identical") -----------
// A restore assigns a whole persisted snapshot — both the entered set AND both members'
// values. There is nothing to recompute, and recomputing is exactly what breaks
// byte-identity: the solver would reproduce the calculated member from a value that was
// rounded on the way to storage, landing on a different double. Restores therefore run
// inside suspendVentSolve(), which parks the store's watcher while the assignment happens.
let suspended = false;

/** True while a restore is in flight — the store's watcher checks this and does not solve. */
export function ventSolveSuspended(): boolean {
  return suspended;
}

/**
 * Run `fn` with vent solving parked, so a wholesale restore is adopted verbatim.
 * Re-entrant-safe and exception-safe: the flag is always cleared.
 */
export function suspendVentSolve<T>(fn: () => T): T {
  const prev = suspended;
  suspended = true;
  try { return fn(); } finally { suspended = prev; }
}
