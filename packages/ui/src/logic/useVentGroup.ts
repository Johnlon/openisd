/**
 * The vent group's UI seam. The physics — which of `Vb`, `ventD`, `Fb`, `ventL` is HELD and
 * which is SOLVED, the Helmholtz relation itself, reachability — lives on `OpenISDProject`
 * (`cell()`/`enter()`/`clear()`/`solveVentGroup()`), the owner of the state. This module keeps
 * only what is genuinely a UI concern: the field vocabulary the shells bind, the E/C/N letter
 * the badges show, and the solve-suspension that parks `appState.ts`'s coarse auto-solve watch
 * so one user action produces one solve (and a wholesale restore is adopted verbatim,
 * byte-identical — docs/design/STATE_MODEL.md rule 3).
 */
import type { ManagedProject } from './managedProject.js';
import { Provenance } from '@openisd/model';

/** The four members tied by the Helmholtz relation — the set the solver solves WITHIN. */
export const VENT_GROUP = ['Vb', 'ventD', 'Fb', 'ventL'] as const;
export type VentField = typeof VENT_GROUP[number];

/**
 * What a human can ENTER — wider than what the solver solves, because a slotted vent states
 * its cross-section as width × height where a round one states a diameter.
 */
export const VENT_ENTRY_FIELDS = [...VENT_GROUP, 'ventW', 'ventH'] as const;
export type VentEntryField = typeof VENT_ENTRY_FIELDS[number];

const LETTER: Record<Provenance, 'E' | 'C' | 'N'> = {
  [Provenance.Entered]: 'E', [Provenance.Calculated]: 'C', [Provenance.NotAvailable]: 'N',
};

/** Re-solve every CALCULATED member from the ENTERED ones — the domain's own solver. */
export function solveVentGroup(mp: ManagedProject): void {
  mp.solveVentGroup();
}

/** Enter a vent-group field — held until an explicit `clearVentField`. One user action, one
 *  solve: the domain solves inside `enter()`, and the suspension parks the auto-solve watch.
 *  `ManagedProject` has no keyed accessor — this switch is the field-id dispatch,
 *  living here in the UI seam rather than as a generic method on the domain facade. */
export function enterVentField(mp: ManagedProject, field: VentEntryField, value: number): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'Vb': mp.enterBoxVolume_m3(value); return;
      case 'Fb': mp.enterBoxTuning_Fb_hz(value); return;
      case 'ventD': mp.enterVentDiameter_m(value); return;
      case 'ventL': mp.enterVentLength_m(value); return;
      case 'ventW': mp.enterVentWidth_m(value); return;
      case 'ventH': mp.enterVentHeight_m(value); return;
    }
  });
}

/** Clear a vent-group field — it becomes `C` if the remaining entered set determines it, `N`
 *  if nothing can. */
export function clearVentField(mp: ManagedProject, field: VentField): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'Vb': mp.clearBoxVolume_m3(); return;
      case 'Fb': mp.clearBoxTuning_Fb_hz(); return;
      case 'ventD': mp.clearVentDiameter_m(); return;
      case 'ventL': mp.clearVentLength_m(); return;
    }
  });
}

/** `E` entered and locked · `C` calculated · `N` not available — the badge letter for the
 *  domain's own provenance. */
export function ventFieldState(mp: ManagedProject, field: VentField): 'E' | 'C' | 'N' {
  switch (field) {
    case 'Vb': return LETTER[mp.boxVolumeProvenance()];
    case 'Fb': return LETTER[mp.boxTuningProvenance()];
    case 'ventD': return LETTER[mp.ventDiameterProvenance()];
    case 'ventL': return LETTER[mp.ventLengthProvenance()];
  }
}

/** The tuning the CURRENT vent length actually delivers. */
export function ventAchievedFb(mp: ManagedProject): number | null {
  return mp.ventAchievedFb();
}

/** The highest tuning this volume and port area can reach with ANY vent (L = 0). */
export function ventMaxReachableFb(mp: ManagedProject): number | null {
  return mp.ventMaxReachableFb();
}

/** True when the solver cannot deliver the entered target tuning — see the domain method. */
export function ventTargetUnreachable(mp: ManagedProject): boolean {
  return mp.ventTargetUnreachable();
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
