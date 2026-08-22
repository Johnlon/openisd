/**
 * A driver record's standing, derived from what its `quality` block carries — mirrors
 * winisd_tools `model_driver.py::QualityBlock.stamp_disposition`'s `missing`/`parse_errors`
 * branch. `no_ts_published` plays no part here: it is excluded from every serialised record
 * (QT47), so openisd has no way to read it and this function answers only the distinction
 * every openisd consumer actually needs — usable or not.
 *
 * NOT a bundling gate. Nothing but structural readability (`driverRecordProblems`) gates
 * bundling (QO79 amended / QO81, John, final) — neither datasheet completeness nor
 * simulatability excludes a record. This function's one caller is
 * `packages/ui/src/db/driverRepo.ts::driverHasDqIssues`, where it supplies the DQ-flag input:
 * a record bundles regardless, and this is what flags it. It derives unconditionally from
 * `missing` and `parse_errors` — never from a stored `disposition`/`quality.disposition` key,
 * which may be absent (post-B10 records) or stale (an older record whose evidence lists
 * changed since it was last derived).
 */
export interface StandingEvidence {
  missing: string[];
  parse_errors: string[];
}

export function recordStandingIsOk(evidence: StandingEvidence): boolean {
  return evidence.missing.length === 0 && evidence.parse_errors.length === 0;
}
