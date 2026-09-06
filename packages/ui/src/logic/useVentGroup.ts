/**
 * The vent group's UI seam. The physics — which of `Vb`, `ventD`, `Fb`, `ventL` is HELD and
 * which is SOLVED, the Helmholtz relation itself, reachability — lives on `OpenISDProject`
 * (`cell()`/`enter()`/`clear()`/`solveVentGroup()`), the owner of the state. This module keeps
 * only what is genuinely a UI concern: the field vocabulary the shells bind, the E/C/N letter
 * the badges show, and the solve-suspension that parks `appState.ts`'s coarse auto-solve watch
 * so one user action produces one solve (and a wholesale restore is adopted verbatim,
 * byte-identical — docs/design/STATE_MODEL.md rule 3).
 */
import type { OpenISDProject, Provenance } from '@openisd/design';

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

const LETTER: Record<Provenance, 'E' | 'C' | 'N'> = {
  entered: 'E', calculated: 'C', 'not-available': 'N',
};

/** Re-solve every CALCULATED member from the ENTERED ones — the domain's own solver. */
export function solveVentGroup(p: OpenISDProject): void {
  p.solveVentGroup();
}

/** Enter a vent-group field — held until an explicit `clearVentField`. One user action, one
 *  solve: the domain solves inside `enter()`, and the suspension parks the auto-solve watch.
 *  `OpenISDProject` has no keyed accessor — this switch is the field-id dispatch,
 *  living here in the UI seam rather than as a generic method on the domain facade. */
export function enterVentField(p: OpenISDProject, field: VentEntryField, value: number): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'Vb': p.box.vented.volume_m3.set(value); return;
      case 'Fb': p.box.vented.tuning_hz.set(value); return;
      case 'ventD': p.box.vented.vent.diameter_m.set(value); return;
      case 'ventL': p.box.vented.vent.length_m.set(value); return;
      case 'ventW': p.box.vented.vent.width_m.set(value); return;
      case 'ventH': p.box.vented.vent.height_m.set(value); return;
    }
  });
}

/** Clear a vent-group field — it becomes `C` if the remaining entered set determines it, `N`
 *  if nothing can. */
export function clearVentField(p: OpenISDProject, field: VentField): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'Vb': p.box.vented.volume_m3.clear(); return;
      case 'Fb': p.box.vented.tuning_hz.clear(); return;
      case 'ventD': p.box.vented.vent.diameter_m.clear(); return;
      case 'ventL': p.box.vented.vent.length_m.clear(); return;
    }
  });
}

/** `E` entered and locked · `C` calculated · `N` not available — the badge letter for the
 *  domain's own provenance. */
export function ventFieldState(p: OpenISDProject, field: VentField): 'E' | 'C' | 'N' {
  switch (field) {
    case 'Vb': return LETTER[p.box.vented.volume_m3.get().state];
    case 'Fb': return LETTER[p.box.vented.tuning_hz.get().state];
    case 'ventD': return LETTER[p.box.vented.vent.diameter_m.get().state];
    case 'ventL': return LETTER[p.box.vented.vent.length_m.get().state];
  }
}

/** The tuning the CURRENT vent length actually delivers. */
export function ventAchievedFb(p: OpenISDProject): number | null {
  return p.ventAchievedFb();
}

/** The highest tuning this volume and port area can reach with ANY vent (L = 0). */
export function ventMaxReachableFb(p: OpenISDProject): number | null {
  return p.ventMaxReachableFb();
}

/** True when the solver cannot deliver the entered target tuning — see the domain method. */
export function ventTargetUnreachable(p: OpenISDProject): boolean {
  return p.ventTargetUnreachable();
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
