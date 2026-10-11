/**
 * D9 — which source's reading becomes a spec entry's `origin`.
 *
 * Four tiers, in rank order (John, 2026-08-30 + 2026-10-11):
 * (1) IMPOSSIBLE or REJECTED readings are dropped first (impossible = not isPlausible for the
 *     field; Rejected = a rejected reading from T017, including text-only ones).
 * (2) Among the survivors, a STRICT majority (more than half of the survivors, not just the
 *     biggest group) on the value wins; 2/1/1 is NOT a majority and falls to (3).
 * (3) Otherwise source rank (sourceRank.ts), ties alphabetical on role name.
 * (4) When every reading is impossible or rejected, NO reading wins: selectOrigin returns no
 *     winner (`{kind: 'none'}`).
 *
 * Worked examples:
 * - 2/1/1: Four surviving readings — manufacturer_product_page states 41, distributor_datasheet
 *   states 41, distributor_product_page states 42, manual states 43. The count for 41 is 2 out of
 *   4 (50%), which is not strictly more than half (> 2), so 2/1/1 is not a strict majority and
 *   falls through to step (3) (source rank), where manufacturer_product_page wins.
 * - All-rejected: Two readings — distributor_datasheet has actual_reading 'N/A' (rejected:
 *   'no-numeric-value'), manufacturer_datasheet has actual_reading 'banana' (rejected:
 *   'no-numeric-value'). Both are rejected, leaving zero survivors, so step (4) applies and
 *   selectOrigin returns `{kind: 'none'}`.
 */
import {isUsable, type Reading} from './corroboration.js';
import {sourceRank} from './sourceRank.js';

export type OriginResult =
  | { readonly kind: 'winner'; readonly role: string }
  | { readonly kind: 'none' };

type RoleReading = readonly [string, Reading];

function byRankThenRole([roleA]: RoleReading, [roleB]: RoleReading): number {
  const byRank = sourceRank(roleA) - sourceRank(roleB);
  if (byRank !== 0) return byRank;
  return roleA < roleB ? -1 : roleA > roleB ? 1 : 0;
}

/** `readings`'s winning role for `field`. `isPlausible(field, value)` is the one door into D5's
 *  physical-range table (`Engine.isPhysicallyPlausible`) — this module owns no band data of its
 *  own, and takes it as a collaborator rather than importing the engine directly. */
export function selectOrigin(
  readings: Readonly<Record<string, Reading>>,
  field: string,
  isPlausible: (field: string, value: number) => boolean,
): OriginResult {
  const ranked = Object.entries(readings).sort(byRankThenRole);

  const survivors = ranked.filter(
    ([, r]) => isUsable(r) && isPlausible(field, r.read_value)
  );

  if (survivors.length === 0) {
    return { kind: 'none' };
  }

  const counts = new Map<number, number>();
  for (const [, r] of survivors) {
    if (isUsable(r)) counts.set(r.read_value, (counts.get(r.read_value) ?? 0) + 1);
  }

  const majorityThreshold = survivors.length / 2;
  for (const [val, count] of counts.entries()) {
    if (count > majorityThreshold) {
      const agreed = survivors.find(([, r]) => isUsable(r) && r.read_value === val);
      if (agreed) return { kind: 'winner', role: agreed[0] };
    }
  }

  return { kind: 'winner', role: survivors[0][0] };
}
