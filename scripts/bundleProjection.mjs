/**
 * bundleProjection.mjs — the pure, side-effect-free half of `bundle-drivers.mjs`: row
 * metadata for one `openisd.yml` record and whether it belongs in the bundle. No filesystem
 * read or write, so a test (or another script) can import it directly with no CLI run.
 *
 * Does NOT import the domain layer — the bundling gate only needs schema validation
 * and section checks, not a wrapped domain object or an Engine.
 */
import { openISDDeviceJsonSchema } from '../packages/design/domain/openisdSchema.ts';
import { driverSectionProblems } from '../packages/design/domain/openisdTransforms.ts';

/** Whether the record is structurally readable as a driver — schema validates and
 *  the sections are not contradictory. No Engine, no domain object creation. */
function recordConforms(record) {
  const result = openISDDeviceJsonSchema.safeParse(record);
  if (!result.success) return false;
  const problems = driverSectionProblems(result.data);
  return problems.length === 0;
}

/** A record-level `{ value, origin, definition }` wrapper's value. */
const valueOf = node => (node && typeof node === 'object' && 'value' in node ? node.value : undefined);

/** Row metadata for one openisd.yml record: display name, driver_type, and whether it
 *  belongs in the bundle — computed once so the app does not redo it per render. The
 *  record itself is carried through to the caller verbatim, unmodified.
 *
 *  The final rule (QO79 amended, QO81, John — the paraphrase in this codebase is not a
 *  quotation of his exact words; see `questions.yml` QO81 for those): every structurally
 *  readable record bundles, EXCEPT devices with no woofer spec section — those are
 *  sub-box builders, not usable drivers in the main collection. Neither datasheet
 *  completeness nor simulatability is a bundling criterion — both are settled wrong,
 *  permanently. A driver missing Fs, or every T/S field,
 *  still bundles — it degrades in the app exactly like a user-created driver with those
 *  fields left blank, and `driverRepo.ts::driverHasDqIssues` (not this gate) is what flags
 *  it.
 *
 *  `recordConforms` (schema validation + section check) is checked first, before any
 *  field is read off `record` — a record failing it may not even be an object. It catches two
 *  throw classes: an absent or non-object `specs` (`readCell`/`OpenISDDriver#specs()`), and an
 *  absent `quality`/`quality.missing`/`quality.parse_errors` (`recordStandingIsOk`, which
 *  `driverHasDqIssues` reads unconditionally on every bundled row) — the same check that
 *  guards My Drivers reads (`myDrivers.ts::list()`), so neither seam enforces a shape the
 *  other does not. It does NOT catch a `specs` whose interior is not the `_SpecEntry` shape —
 *  `{specs:{woofer:{fs:12}}}` and `{specs:{woofer:'banana'}}` both conform here and still
 *  throw downstream in `readCell`/`OpenISDDriver`
 *  (open: `bugs/BUG_20260822_openisddriver_getters_throw_on_a_record_that_has_specs_but_not_the_spec_entry_shape.md`). */
export function project(record) {
  if (!record.specs?.woofer) return { record, driverType: undefined, name: '', structurallyReadable: false };
  if (!recordConforms(record)) return { record, driverType: undefined, name: '', structurallyReadable: false };

  const driverType = valueOf(record.driver_type);

  const brand = valueOf(record.brand);
  const rawModel = valueOf(record.model);
  const sku = valueOf(record.sku);
  const series = valueOf(record.series);
  const manufacturer = valueOf(record.manufacturer);

  // Model slug used for display title: uppercase SKU when present, else rawModel
  const modelSlug = sku ? sku.toUpperCase() : rawModel;
  const lead = brand || manufacturer;
  const parts = [lead, series, modelSlug].filter(Boolean);
  const name = parts.join(' - ').trim();

  return { record, driverType, name, structurallyReadable: true };
}

/**
 * Whether a projected record belongs in the bundle.
 *
 * Structural readability is the base bar (QO79/QO81 ruling — field completeness
 * and simulatability never exclude a record). Devices with no woofer spec
 * section are additionally excluded — they are sub-box builders, not usable
 * drivers in the main collection.
 */
export function isBundlable({ structurallyReadable, record }) {
  if (!structurallyReadable) return false;
  return record.specs?.woofer !== undefined;
}
