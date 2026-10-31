/**
 * The passive-radiator tuning group's UI seam. The relation — `tuning_goal_hz` ↔ `addedMass_kg`,
 * pinning either solves the other — lives on `OpenISDProject` (`cell()`/`enter()`/`clear()`/
 * `recalc()`), the owner of the state. This module keeps the field names, the
 * badge letter, and the same one-action-one-solve suspension as the vent group.
 *
 * The two members ARE the field-table keys, so there is no dispatch: `enterPrField`/`clearPrField`
 * reach the domain field directly, and a rename in the field table or the domain is a compile
 * error here, not a second table to keep in step.
 */
import type {OpenISDProject} from '@openisd/design';
import {suspendVentSolve} from './ventGroup.js';
import type {ProvenanceLetter} from '@openisd/design';

/** The two members tied by the tuning relation, named as the field-table keys them. */
export const PR_GROUP = ['tuning_goal_hz', 'addedMass_kg'] as const;
/** One of the two names listed above. */
export type PrField = typeof PR_GROUP[number];

/** Enter a PR-group field — held until explicitly cleared. One user action, one solve. */
export function enterPrField(p: OpenISDProject, field: PrField, value: number): void {
  suspendVentSolve(() => p.box.passiveRadiator[field].set(value));
}

/** Clear a PR-group field — the domain settles the pair: added mass entered 0, tuning calculated. */
export function clearPrField(p: OpenISDProject, field: PrField): void {
  suspendVentSolve(() => p.box.passiveRadiator[field].clear());
}

/** The badge letter for the domain's own provenance. */
export function prFieldState(p: OpenISDProject, field: PrField): ProvenanceLetter {
  return p.box.passiveRadiator[field].provenance;
}
