/**
 * Physical/simulation sanity checks on a driver's own entered SI values (D5). The bands live on
 * the fields themselves — `NumberField.plausible` in `packages/design/fields/field.ts` — so a
 * quantity states once what a real driver's value looks like. They were ported verbatim from
 * the scraper's `SpecField.range_lo`/`range_hi` declarations
 * (`winisd_tools/scrapers/scrapers/lib/record_registries.py`, deleted there once they existed
 * here; every value's source and its own `(field, lo, hi)` triple is listed at
 * `docs/plans/PLAN_RETIRE_CALCS_FROM_SCRAPERS.md` §6).
 *
 * A field with nothing narrower known carries its entry band as its plausible band, so there is
 * no "no check at all" case — a value the input would refuse is not plausible either.
 *
 * `numVC` (Python: 1–4) is excluded — see `NOT_A_RANGED_QUANTITY`. An open gap, not silently
 * dropped.
 */
import {NumberField} from '../fields/field.js';
import type {DriverSolverParams} from './solverTypes.js';
import {outOfRange} from './consistency.js';
import type {OutOfRangeIssue} from './consistency.js';

/** Mirrors `solver.ts`'s own (private) `NumericDriverQuantityName`: every driver quantity this
 *  check can bound is a plain numeric `SolverField`. `wiring` is not a quantity; `numVC`
 *  (Python: 1–4) is a `SolverInput` carrying no `.precision`, and every numeric driver quantity
 *  excludes it — an open gap, not silently dropped.
 *
 *  Named here rather than read off the object with `Object.keys`, which answers `string[]`
 *  regardless of what the type declares, and would leave every field an `any`. */
type RangedDriverField = Exclude<keyof DriverSolverParams, 'wiring' | 'numVC'>;

const RANGED_QUANTITIES = [
  'Fs_hz', 'Re_ohm', 'Znom_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Qes', 'Qms', 'Qts', 'Vas_m3',
  'Sd_m2', 'Dd_m', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'EBP_hz', 'Xmax_m', 'Vd_m3',
  'Hc_m', 'Hg_m', 'Pe_W', 'no', 'SPLref_dB', 'SPL_dB', 'USPL_dB', 'SPLmax_dB', 'SPLmaxLF_dB',
  'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'gamma_m_per_s2_A', 'Gloss', 'Vcd_m',
  'Depth_m', 'MagDepth_m', 'Magnet_m', 'DVol_m3', 'c_m_per_s', 'roo_kg_per_m3',
  'Re_terminal_ohm', 'BL_terminal_Tm',
] as const satisfies readonly RangedDriverField[];

// Completeness, not merely validity: a quantity missing from the list above fails to compile
// here and the error NAMES it, rather than going silently unchecked.
type _MissingFromRangedQuantities = Exclude<RangedDriverField, typeof RANGED_QUANTITIES[number]>;
type _AssertRangedQuantitiesComplete = _MissingFromRangedQuantities extends never ? true : never;
const _assertRangedQuantitiesComplete: _AssertRangedQuantitiesComplete = true;
void _assertRangedQuantitiesComplete;

/** One `OutOfRangeIssue` per ENTERED numeric field whose value falls outside its field's
 *  plausible band. A not-entered field, a field with no registry member, and a value of exactly
 *  `0` (the .wdr not-present sentinel — never a real physical zero for any of these quantities)
 *  are all skipped, matching the scraper's own `semantic_dq` field-range check. */
export function checkRange(params: DriverSolverParams): readonly OutOfRangeIssue[] {
  const issues: OutOfRangeIssue[] = [];
  for (const name of RANGED_QUANTITIES) {
    const spec = NumberField.named(name);
    if (!spec) continue;
    const field = params[name];
    const value = field.value;
    if (!field.entered || value == null || value === 0) continue;
    if (value < spec.plausible.min) {
      issues.push(outOfRange(name, value, spec.plausible.min, 'below'));
    } else if (value > spec.plausible.max) {
      issues.push(outOfRange(name, value, spec.plausible.max, 'above'));
    }
  }
  return issues;
}

/**
 * Whether a single RAW value would sit inside `field`'s plausible band (D9 tier 1 —
 * `crosscheck.py`'s "impossible reading" exclusion, ported to `domain/selectOrigin.ts` via
 * `Engine.isPhysicallyPlausible`, the only door this check has out of the engine).
 *
 * Unlike `checkRange`, `field` is a plain `string` (a scraper reading names its field by the
 * same wire key `driver.yml` uses, before anything has resolved it into a `DriverSolverParams`),
 * and `0` is NOT special-cased: `checkRange`'s zero-skip is the `.wdr` not-present sentinel on
 * an already-RESOLVED field; a raw scraper reading of literal `0` is exactly the kind of failed
 * extraction this check exists to catch. A name the registry does not know is always plausible.
 */
export function isPhysicallyPlausible(field: string, value: number): boolean {
  const spec = NumberField.named(field);
  if (!spec) return true;
  return value >= spec.plausible.min && value <= spec.plausible.max;
}
