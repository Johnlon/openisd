/**
 * Physical/simulation sanity bounds on a driver's own entered SI values (D5) — ported verbatim
 * from the scraper's `SpecField.range_lo`/`range_hi` declarations
 * (`winisd_tools/scrapers/scrapers/lib/record_registries.py`, deleted there once this table
 * existed here; every value's source and its own `(field, lo, hi)` triple is listed at
 * `docs/plans/PLAN_RETIRE_CALCS_FROM_SCRAPERS.md` §6). A field absent from `PHYSICAL_RANGE`
 * carries no range check at all — matching the Python source, where a `SpecField` member without
 * a trailing `range_lo`/`range_hi` pair had none either.
 *
 * `numVC` (Python: 1–4) has no band here: `numVC` is a `SolverInput`, not a `SolverField`, so it
 * carries no `.precision` and is excluded from every numeric driver quantity this module (and
 * `solver.ts`'s own `NumericDriverQuantityName`) can name. Flagged as an open gap, not silently
 * dropped.
 */
import type {DriverSolverParams} from './solverTypes.js';
import type {OutOfRangeIssue} from './consistency.js';

/** Mirrors `solver.ts`'s own (private) `NumericDriverQuantityName`: every driver quantity this
 *  table can bound is a plain numeric `SolverField`, never `wiring` or `numVC`. */
type RangedDriverField = Exclude<keyof DriverSolverParams, 'wiring' | 'numVC'>;

interface RangeBand {
  readonly field: RangedDriverField;
  readonly lo?: number;
  readonly hi?: number;
}

const PHYSICAL_RANGE: readonly Readonly<RangeBand>[] = Object.freeze([
  Object.freeze({ field: 'Fs_hz', lo: 1.0, hi: 5000.0 }),
  Object.freeze({ field: 'Re_ohm', lo: 0.1, hi: 64.0 }),
  Object.freeze({ field: 'Le_H', lo: 0.0, hi: 0.1 }),
  Object.freeze({ field: 'fLe_hz', lo: 0.0 }),
  Object.freeze({ field: 'KLe_H_sqrtHz', lo: 0.0 }),
  Object.freeze({ field: 'Znom_ohm', lo: 1.0, hi: 64.0 }),
  Object.freeze({ field: 'Qts', lo: 0.01, hi: 5.0 }),
  Object.freeze({ field: 'Qes', lo: 0.01, hi: 5.0 }),
  Object.freeze({ field: 'Qms', lo: 0.1, hi: 50.0 }),
  Object.freeze({ field: 'Vas_m3', lo: 1e-6, hi: 1.0 }),
  Object.freeze({ field: 'Sd_m2', lo: 1e-5, hi: 0.3 }),
  Object.freeze({ field: 'BL_Tm', lo: 0.1, hi: 50.0 }),
  Object.freeze({ field: 'Mms_kg', lo: 1e-5, hi: 2.0 }),
  Object.freeze({ field: 'Cms_m_per_N', lo: 1e-6, hi: 0.1 }),
  Object.freeze({ field: 'Rms_kg_per_s', lo: 0.0, hi: 200.0 }),
  Object.freeze({ field: 'Xmax_m', lo: 0.0001, hi: 0.15 }),
  Object.freeze({ field: 'SPL_dB', lo: 50.0, hi: 150.0 }),
  Object.freeze({ field: 'Pe_W', lo: 1.0, hi: 20000.0 }),
  Object.freeze({ field: 'Dd_m', lo: 0.0, hi: 2.0 }),
  Object.freeze({ field: 'EBP_hz', lo: 0.0 }),
  Object.freeze({ field: 'Hg_m', lo: 0.0 }),
  Object.freeze({ field: 'Hc_m', lo: 0.0 }),
]);

/** One `OutOfRangeIssue` per ENTERED numeric field whose value falls outside `PHYSICAL_RANGE`'s
 *  band for it. A not-entered field, a field `PHYSICAL_RANGE` has no band for, and a value of
 *  exactly `0` (the .wdr not-present sentinel — never a real physical zero for any of these
 *  quantities) are all skipped, matching the scraper's own `semantic_dq` field-range check. */
export function checkRange(params: DriverSolverParams): readonly OutOfRangeIssue[] {
  const issues: OutOfRangeIssue[] = [];
  for (const band of PHYSICAL_RANGE) {
    const field = params[band.field];
    if (!field.entered || field.value == null || field.value === 0) continue;
    const value = field.value;
    if (band.lo != null && value < band.lo) {
      issues.push({ kind: 'out-of-range', field: band.field, value, limit: band.lo, side: 'below' });
    } else if (band.hi != null && value > band.hi) {
      issues.push({ kind: 'out-of-range', field: band.field, value, limit: band.hi, side: 'above' });
    }
  }
  return issues;
}

/**
 * Whether a single RAW value would sit inside `PHYSICAL_RANGE`'s band for `field` (D9 tier 1 —
 * `crosscheck.py`'s "impossible reading" exclusion, ported to `domain/selectOrigin.ts` via
 * `Engine.isPhysicallyPlausible`, the only door this table has out of the engine).
 *
 * Unlike `checkRange`, `field` is a plain `string` (a scraper reading names its field by the same
 * wire key `driver.yml` uses, before anything has resolved it into a `DriverSolverParams`), and
 * `0` is NOT special-cased: `checkRange`'s zero-skip is the `.wdr` not-present sentinel on an
 * already-RESOLVED field; a raw scraper reading of literal `0` is exactly the kind of failed
 * extraction this check exists to catch. A field name `PHYSICAL_RANGE` has no band for — known or
 * unknown to the record at all — is always plausible, the same "absent band, no check" rule
 * `checkRange` follows.
 */
export function isPhysicallyPlausible(field: string, value: number): boolean {
  const band = PHYSICAL_RANGE.find((b) => b.field === field);
  if (!band) return true;
  if (band.lo != null && value < band.lo) return false;
  if (band.hi != null && value > band.hi) return false;
  return true;
}
