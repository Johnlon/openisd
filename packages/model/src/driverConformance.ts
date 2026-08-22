/**
 * Whether `candidate` conforms closely enough to the canonical driver record shape that every
 * consumer downstream (`OpenISDDriver.cell`, `recordStandingIsOk`, `driverIsSimulatable`) can read its
 * required fields without throwing. Composes `driverRecordProblems` (an absent or non-object
 * `specs`) with a check that `quality.missing`/`quality.parse_errors` are both present arrays
 * — `recordStandingIsOk` reads them unconditionally, so their absence is a second throw class
 * `driverRecordProblems` alone does not catch. NOT a completeness check: a record with no
 * `Fs`, or no `quality.missing` entries, still conforms — only structural shape is verified.
 *
 * ONE shared implementation for both seams a record can enter the app through:
 * `myDrivers.ts::list()` (browser storage) and `bundleProjection.mjs::project()` (the
 * driver corpus). Neither seam may enforce a shape the other does not.
 */
import { OpenISDDriver } from './openisdDriver.js';

export function recordConforms(candidate: unknown): boolean {
  return OpenISDDriver.fromConformingRecord(candidate) !== null;
}
