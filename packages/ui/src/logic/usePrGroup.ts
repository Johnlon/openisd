/**
 * The passive-radiator tuning group's UI seam. The relation — `prFp` ↔ `prMadd`, pinning
 * either solves the other — lives on `OpenISDProject` (`cell()`/`enter()`/`clear()`/
 * `solvePrGroup()`), the owner of the state. This module keeps the field vocabulary, the
 * badge letter, and the same one-action-one-solve suspension as the vent group.
 */
import type { OpenISDProject, Provenance } from '@openisd/design';
import { suspendVentSolve } from './useVentGroup.js';

/** The two members tied by the tuning relation. */
export const PR_GROUP = ['prFp', 'prMadd'] as const;
/** One of the two names listed above. */
export type PrField = typeof PR_GROUP[number];

const LETTER: Record<Provenance, 'E' | 'C' | 'N'> = {
  entered: 'E', calculated: 'C', 'not-available': 'N',
};

/** Re-solve whichever member is CALCULATED from the entered one — the domain's own solver. */
export function solvePrGroup(p: OpenISDProject): void {
  p.solvePrGroup();
}

/** Enter a PR-group field — held until explicitly cleared. One user action, one solve.
 *  `OpenISDProject` has no keyed accessor — this switch is the field-id dispatch,
 *  living here in the UI seam rather than as a generic method on the domain facade. */
export function enterPrField(p: OpenISDProject, field: PrField, value: number): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'prFp': p.box.passiveRadiator.tuning_hz.set(value); return;
      case 'prMadd': p.box.passiveRadiator.addedMass_kg.set(value); return;
    }
  });
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(p: OpenISDProject, field: PrField): void {
  suspendVentSolve(() => {
    switch (field) {
      case 'prFp': p.box.passiveRadiator.tuning_hz.clear(); return;
      case 'prMadd': p.box.passiveRadiator.addedMass_kg.clear(); return;
    }
  });
}

/** The badge letter for the domain's own provenance. */
export function prFieldState(p: OpenISDProject, field: PrField): 'E' | 'C' | 'N' {
  switch (field) {
    case 'prFp': return LETTER[p.box.passiveRadiator.tuning_hz.get().state];
    case 'prMadd': return LETTER[p.box.passiveRadiator.addedMass_kg.get().state];
  }
}

/** True when the entered target tuning cannot be reached by ADDING mass — see the domain
 *  method: the honest answer is "this PR cannot tune that high in this box". */
export function prTargetUnreachable(p: OpenISDProject): boolean {
  return p.prTargetUnreachable();
}
