/**
 * Whether `candidate` conforms closely enough to the canonical driver record shape that every
 * consumer downstream (`OpenISDDriver.cell`, `recordStandingIsOk`, `driverIsSimulatable`) can read its
 * required fields without throwing. Composes `driverRecordProblems` (an absent or non-object
 * `specs`) with a check that `quality.missing`/`quality.parse_errors` are both present arrays
 * — `recordStandingIsOk` reads them unconditionally, so their absence is a second throw class
 * `driverRecordProblems` alone does not catch. NOT a completeness check: a record with no
 * `Fs`, or no `quality.missing` entries, still conforms — only structural shape is verified.
 *
 * ONE shared implementation for every seam a record can enter the app through: `myDrivers.ts`
 * (browser storage), `bundleProjection.mjs` (the driver corpus), `OpenISDProject.fromJsonRecord`
 * (a project's embedded driver), and `projectRepo.ts` (a saved/shared project's driver slot).
 * No seam may enforce a shape another does not.
 */
import { OpenISDDriver, driverRecordProblems } from './openisdDriver.js';
import type { OpenISDDriverJson } from './openisdDriver.js';

export function recordConforms(candidate: unknown): boolean {
  return driverFromConformingRecord(candidate) !== null;
}

/** `candidate` → a live `OpenISDDriver`, or `null` when it does not conform. Only this file
 *  casts to `OpenISDDriverJson` — a caller with an untrusted `candidate` never casts itself. */
export function driverFromConformingRecord(candidate: unknown): OpenISDDriver | null {
  if (driverRecordProblems(candidate).length > 0) return null;
  const quality = (candidate as { quality?: unknown }).quality;
  if (quality == null || typeof quality !== 'object') return null;
  const q = quality as { missing?: unknown; parse_errors?: unknown };
  if (!Array.isArray(q.missing) || !Array.isArray(q.parse_errors)) return null;
  return OpenISDDriver.fromJsonRecord(candidate as OpenISDDriverJson);
}
