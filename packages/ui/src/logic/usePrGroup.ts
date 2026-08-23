/**
 * The passive-radiator tuning group's UI seam. The relation — `prFp` ↔ `prMadd`, pinning
 * either solves the other — lives on `OpenISDProject` (`cell()`/`enter()`/`clear()`/
 * `solvePrGroup()`), the owner of the state. This module keeps the field vocabulary, the
 * badge letter, and the same one-action-one-solve suspension as the vent group.
 */
import type { ManagedOpenISDProject } from './managedProject.js';
import { Provenance } from '@openisd/model';
import { suspendVentSolve } from './useVentGroup.js';

/** The two members tied by the tuning relation. */
export const PR_GROUP = ['prFp', 'prMadd'] as const;
export type PrField = typeof PR_GROUP[number];

const LETTER: Record<Provenance, 'E' | 'C' | 'N'> = {
  [Provenance.Entered]: 'E', [Provenance.Calculated]: 'C', [Provenance.NotAvailable]: 'N',
};

/** Re-solve whichever member is CALCULATED from the entered one — the domain's own solver. */
export function solvePrGroup(mp: ManagedOpenISDProject): void {
  mp.solvePrGroup();
}

/** Enter a PR-group field — held until explicitly cleared. One user action, one solve. */
export function enterPrField(mp: ManagedOpenISDProject, field: PrField, value: number): void {
  suspendVentSolve(() => mp.enterProjectField(field, value));
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(mp: ManagedOpenISDProject, field: PrField): void {
  suspendVentSolve(() => mp.clearProjectField(field));
}

/** The badge letter for the domain's own provenance. */
export function prFieldState(mp: ManagedOpenISDProject, field: PrField): 'E' | 'C' | 'N' {
  return LETTER[mp.projectCell(field).state];
}

/** True when the entered target tuning cannot be reached by ADDING mass — see the domain
 *  method: the honest answer is "this PR cannot tune that high in this box". */
export function prTargetUnreachable(mp: ManagedOpenISDProject): boolean {
  return mp.prTargetUnreachable();
}
