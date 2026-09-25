/**
 * D9 — which source's reading becomes a spec entry's `origin`, ported verbatim from
 * `winisd_tools/scrapers/scrapers/lib/crosscheck.py`'s winner-selection block (lines 258–296).
 *
 * Three tiers, in rank order. TIER 1 drops a rejected reading and one physically impossible for
 * the field (D5's own band, reached only through the `isPlausible` collaborator — nothing
 * outside `Engine` may know that table, `test/architecture-engine-boundary.test.ts`). Every
 * survivor disqualified there falls back to "every non-rejected reading", then to "every reading
 * at all": rank cannot restore a value physics rules out, but some origin must still be named.
 * TIER 2 is a STRICT majority on `read_value` among the survivors — two independent readers
 * agreeing outranks any one document's authority; a tied count proves nothing and falls through.
 * TIER 3 is source rank (D10), tie-broken alphabetically on role name.
 */
import type {Reading} from './corroboration.js';
import {sourceRank} from './sourceRank.js';

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
): string {
  const ranked = Object.entries(readings).sort(byRankThenRole);

  let candidates = ranked.filter(
    ([, r]) => r.rejected === undefined && isPlausible(field, r.read_value)
  );
  if (candidates.length === 0) {
    candidates = ranked.filter(([, r]) => r.rejected === undefined);
  }
  if (candidates.length === 0) {
    candidates = ranked;
  }

  const counts = new Map<number, number>();
  for (const [, r] of candidates) counts.set(r.read_value, (counts.get(r.read_value) ?? 0) + 1);
  const tallied = [...counts.entries()];
  const bestCount = Math.max(...tallied.map(([, n]) => n));
  const mostAgreedOn = tallied.filter(([, n]) => n === bestCount);

  if (bestCount > 1 && mostAgreedOn.length === 1) {
    const [[bestValue]] = mostAgreedOn;
    // `candidates` is rank-sorted, so the first matching role is also the most authoritative one
    // among the (possibly several) sources that share the winning value. `bestValue` came FROM
    // `candidates`, so a match always exists — falling through to tier 3 is what the compiler
    // gets instead of an assertion it cannot check.
    const agreed = candidates.find(([, r]) => r.read_value === bestValue);
    if (agreed) return agreed[0];
  }
  // TIER 3 — candidates is already rank-sorted, so the first entry is the most authoritative
  // surviving source.
  return candidates[0][0];
}
