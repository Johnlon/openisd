/**
 * bundleProjection.mjs — the pure, side-effect-free half of `bundle-drivers.mjs`: row
 * metadata for one `openisd.yml` record and whether it belongs in the bundle. No filesystem
 * read or write, so a test (or another script) can import it directly with no CLI run.
 */
import { recordConforms } from '@openisd/model/driverConformance';

/** A record-level `{ value, origin, definition }` wrapper's value. */
const valueOf = node => (node && typeof node === 'object' && 'value' in node ? node.value : undefined);

/** Row metadata for one openisd.yml record: display name, driver_type, and whether it
 *  belongs in the bundle — computed once so the app does not redo it per render. The
 *  record itself is carried through to the caller verbatim, unmodified.
 *
 *  THE FINAL RULE (QO79 amended, QO81, John — the paraphrase in this codebase is not a
 *  quotation of his exact words; see `questions.yml` QO81 for those): every structurally
 *  readable record bundles. Neither datasheet completeness nor simulatability is a bundling
 *  criterion — both are settled wrong, permanently. A driver missing Fs, or every T/S field,
 *  still bundles — it degrades in the app exactly like a user-created driver with those
 *  fields left blank, and `driverRepo.ts::driverHasDqIssues` (not this gate) is what flags
 *  it.
 *
 *  `recordConforms` (`packages/model/src/driverConformance.ts`) is checked FIRST, before any
 *  field is read off `record` — a record failing it may not even be an object. It catches TWO
 *  throw classes: an absent or non-object `specs` (`readCell`/`OpenISDDriver#specs()`), and an
 *  absent `quality`/`quality.missing`/`quality.parse_errors` (`recordStandingIsOk`, which
 *  `driverHasDqIssues` reads unconditionally on every bundled row) — the SAME check that
 *  guards My Drivers reads (`myDrivers.ts::list()`), so neither seam enforces a shape the
 *  other does not. It does NOT catch a `specs` whose interior is not the `_SpecEntry` shape —
 *  `{specs:{woofer:{fs:12}}}` and `{specs:{woofer:'banana'}}` both conform here and still
 *  throw downstream in `readCell`/`OpenISDDriver`
 *  (open: `bugs/BUG_20260822_openisddriver_getters_throw_on_a_record_that_has_specs_but_not_the_spec_entry_shape.md`). */
export function project(record) {
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
 * Structural readability is the ONLY bar. See the ruling above `project()` — field
 * completeness and simulatability never exclude a record from the bundle.
 */
export function isBundlable({ structurallyReadable }) {
  return structurallyReadable;
}
