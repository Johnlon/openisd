/**
 * The passive-radiator tuning group's UI seam. The relation — `tuning_hz` ↔ `addedMass_kg`,
 * pinning either solves the other — lives on `OpenISDProject` (`cell()`/`enter()`/`clear()`/
 * `notifyPrChanged()`), the owner of the state. This module keeps the field vocabulary, the
 * badge letter, and the same one-action-one-solve suspension as the vent group.
 *
 * The two members ARE the vocabulary keys, so there is no dispatch: `enterPrField`/`clearPrField`
 * reach the domain field directly, and a rename in the vocabulary or the domain is a compile
 * error here, not a second table to keep in step.
 */
import type {OpenISDProject} from '@openisd/design';
import type {CellState} from '@openisd/design/winisd';
import {suspendVentSolve} from './useVentGroup.js';

/** The two members tied by the tuning relation, named as the vocabulary keys them. */
export const PR_GROUP = ['tuning_hz', 'addedMass_kg'] as const;
/** One of the two names listed above. */
export type PrField = typeof PR_GROUP[number];

const LETTER: Record<CellState, 'E' | 'C' | 'N'> = {
  entered: 'E', calculated: 'C', 'not-available': 'N',
};

/** Re-solve whichever member is CALCULATED from the entered one — the domain's own solver. */
export function notifyPrChanged(p: OpenISDProject): void {
  p.notifyPrChanged();
}

/** Enter a PR-group field — held until explicitly cleared. One user action, one solve. */
export function enterPrField(p: OpenISDProject, field: PrField, value: number): void {
  suspendVentSolve(() => p.box.passiveRadiator[field].set(value));
}

/** Clear a PR-group field — it becomes C if the other determines it, else N. */
export function clearPrField(p: OpenISDProject, field: PrField): void {
  suspendVentSolve(() => p.box.passiveRadiator[field].clear());
}

/** The badge letter for the domain's own provenance. */
export function prFieldState(p: OpenISDProject, field: PrField): 'E' | 'C' | 'N' {
  return LETTER[p.box.passiveRadiator[field].get().state];
}

/** True when the entered target tuning cannot be reached by ADDING mass — see the domain
 *  method: the honest answer is "this PR cannot tune that high in this box". */
export function prTargetUnreachable(p: OpenISDProject): boolean {
  return p.prTargetUnreachable.value ?? false;
}