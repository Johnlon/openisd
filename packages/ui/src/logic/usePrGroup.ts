/**
 * The passive-radiator tuning group's UI seam. The relation — `prFp` ↔ `prMadd`, pinning
 * either solves the other — lives on `OpenISDProject` (`cell()`/`enter()`/`clear()`/
 * `solvePrGroup()`), the owner of the state. This module keeps the field vocabulary, the
 * badge letter, and the same one-action-one-solve suspension as the vent group.
 */
import type { ManagedProject } from './managedProject.js';
import { Provenance } from '@openisd/model';
import { suspendVentSolve } from './useVentGroup.js';

/** The two members tied by the tuning relation. */
export const PR_GROUP = ['prFp', 'prMadd'] as const;
export type PrField = typeof PR_GROUP[number];

const LETTER: Record<Provenance, 'E' | 'C' | 'N'> = {
  [Provenance.Entered]: 'E', [Provenance.Calculated]: 'C', [Provenance.NotAvailable]: 'N',
};

/** Re-solve whichever member is CALCULATED from the entered one — the domain's own solver. */
export function solvePrGroup(mp: ManagedProject): void {
  mp.solvePrGroup();
}

/** Enter a PR-group field — held until explicitly cleared. One user action, one solve.
 *  `ManagedProject` has no keyed accessor — this switch is the field-id dispatch,
 *  living here in the UI seam rather than as a generic method on the domain facade. */
export function enterPrField(mp: ManagedProject, field: PrField, value: number): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'prFp': mp.enterPrFp_hz(value); return;
      case 'prMadd': mp.enterPrAddedMass_kg(value); return;
    }
  });
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(mp: ManagedProject, field: PrField): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'prFp': mp.clearPrFp_hz(); return;
      case 'prMadd': mp.clearPrAddedMass_kg(); return;
    }
  });
}

/** The badge letter for the domain's own provenance. */
export function prFieldState(mp: ManagedProject, field: PrField): 'E' | 'C' | 'N' {
  switch (field) {
    case 'prFp': return LETTER[mp.prFpProvenance()];
    case 'prMadd': return LETTER[mp.prAddedMassProvenance()];
  }
}

/** True when the entered target tuning cannot be reached by ADDING mass — see the domain
 *  method: the honest answer is "this PR cannot tune that high in this box". */
export function prTargetUnreachable(mp: ManagedProject): boolean {
  return mp.prTargetUnreachable();
}
