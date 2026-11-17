/**
 * D9 — which source's reading becomes a spec entry's `origin`.
 *
 * Four tiers, in rank order, after one override rule: a usable plausible `manual` reading wins outright (ruling QO395) (John, 2026-08-30 + 2026-10-11):
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
 *   states 41, distributor_product_page states 42, supplier_note states 43. The count for 41 is 2 out of
 *   4 (50%), which is not strictly more than half (> 2), so 2/1/1 is not a strict majority and
 *   falls through to step (3) (source rank), where manufacturer_product_page wins.
 * - All-rejected: Two readings — distributor_datasheet has actual_reading 'N/A' (rejected:
 *   'no-numeric-value'), manufacturer_datasheet has actual_reading 'banana' (rejected:
 *   'no-numeric-value'). Both are rejected, leaving zero survivors, so step (4) applies and
 *   selectOrigin returns `{kind: 'none'}`.
 */
import {isUsable, type Reading} from './corroboration.js';
import type {UsableReadingJson, UsableWiringReadingJson, WiringReadingJson} from './openisdSchema.js';
import {sourceRank} from './sourceRank.js';

export type OriginResult =
  | { readonly kind: 'winner'; readonly role: string; readonly reading: UsableReadingJson }
  | { readonly kind: 'none' };

export type WiringOriginResult =
  | { readonly kind: 'winner'; readonly role: string; readonly reading: UsableWiringReadingJson }
  | { readonly kind: 'none' };

/** The role of a hand-entered override value; it outranks every other reading. */
const MANUAL_ROLE = 'manual';

/** The key of `driver.json`'s `manual_candidates` map: a person's override for a field that has no
 *  `readings` map of its own (a bare bool, a derived or bookkeeping envelope, ...). */
export const MANUAL_CANDIDATES_KEY = 'manual_candidates';

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value a top-level field of `driver.json` takes in the app (QO942, issue 523: an override works
 *  for ANY field; the scraper files it beside the scraped value and the bridge chooses). The manual
 *  candidate wins when there is one: `readings.manual` of a metadata envelope, else the record's
 *  `manual_candidates[name]`. With none the field is returned as it came, so a record without a
 *  candidate projects exactly as before. A chosen field is `{...field, value: <candidate>}` without
 *  `readings`, which stay in driver.json. */
export function chooseFieldValue(name: string, field: unknown, candidates: unknown): unknown {
  if (isPlain(field) && isPlain(field.readings) && MANUAL_ROLE in field.readings) {
    const {readings: _readings, ...rest} = field;
    return {...rest, value: field.readings[MANUAL_ROLE]};
  }
  if (isPlain(candidates) && name in candidates) {
    const candidate = candidates[name];
    return isPlain(field) && 'value' in field ? {...field, value: candidate} : candidate;
  }
  return field;
}

type RoleReading = readonly [string, unknown];

function byRankThenRole([roleA]: RoleReading, [roleB]: RoleReading): number {
  const byRank = sourceRank(roleA) - sourceRank(roleB);
  if (byRank !== 0) return byRank;
  // Role names are the keys of one record, so two never match.
  return roleA < roleB ? -1 : 1;
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

  const survivors = ranked.flatMap(([role, r]): (readonly [string, UsableReadingJson])[] =>
    isUsable(r) && isPlausible(field, r.read_value) ? [[role, r]] : []
  );

  const winner = winnerAmong(survivors);
  return winner === null ? { kind: 'none' } : { kind: 'winner', role: winner[0], reading: winner[1] };
}

/** VCCon's winning role (QO914): a reading naming the wiring survives, a rejected one does not;
 *  then the same override, majority and rank tiers as `selectOrigin`. */
export function selectWiringOrigin(readings: Readonly<Record<string, WiringReadingJson>>): WiringOriginResult {
  const survivors = Object.entries(readings).sort(byRankThenRole).flatMap(
    ([role, r]): (readonly [string, UsableWiringReadingJson])[] => 'rejected' in r ? [] : [[role, r]]);
  const winner = winnerAmong(survivors);
  return winner === null ? { kind: 'none' } : { kind: 'winner', role: winner[0], reading: winner[1] };
}

/** Tiers 0, 2 and 3 over `survivors`, already in rank order; null when there are none. */
function winnerAmong<R extends { readonly read_value: number | string }>(
  survivors: readonly (readonly [string, R])[],
): readonly [string, R] | null {
  if (survivors.length === 0) return null;

  // A manual reading is an override: it beats every other survivor (D9 tier 0).
  const override = survivors.find(([role]) => role === MANUAL_ROLE);
  if (override !== undefined) return override;

  // Only one value can hold a strict majority; the first survivor (best rank) carrying it wins.
  const majorityThreshold = survivors.length / 2;
  for (const survivor of survivors) {
    const count = survivors.filter(([, r]) => r.read_value === survivor[1].read_value).length;
    if (count > majorityThreshold) return survivor;
  }

  return survivors[0];
}
