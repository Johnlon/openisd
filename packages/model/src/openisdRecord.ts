/**
 * The envelope kinds an `OpenISDDriver` field is built from — `OpenISDDriver`
 * (`openisdDriver.ts`) is the one external form; this file supplies its parts, not a
 * second record type. OpenISD owns the `openisd.yml` schema outright (ARCHITECTURE.md
 * "`openisd.yml` is read and written exclusively by JS/TS owned by OpenISD").
 *
 * It currently matches `winisd_tools/scrapers/scrapers/lib/model_driver.py` and
 * `model_openisd.py`'s `MetaFile` field for field because the `driver.yml → openisd.yml`
 * projection still runs in Python. That projection is moving into this package, called
 * by `winisd_tools` across the embedded-V8 boundary ARCHITECTURE.md describes; the
 * Python model is retired once it does, not schema-exported-from.
 *
 * NOT one uniform envelope. Four distinct kinds, matched to what kind of fact a field
 * is:
 *
 *   _SpecEntry        T/S fields, inside `specs` only. NO flat value — `origin` names
 *                    the winning source, a REQUIRED `readings` dict (>= 1 source) holds
 *                    each source's own reading; the number lives at
 *                    `readings[origin].read_value`, nowhere else.
 *   _ScrapedField<T>  record-level metadata (manufacturer, brand, model). HAS a flat
 *                    `value`, plus `origin`; `readings` is only populated when >= 2
 *                    sources disagreed.
 *   _DerivedField<T>  pipeline-computed (sku, name). `value` + `grounds` (evidence the
 *                    pipeline consumed) — no `origin`/`readings`, it was built, not read.
 *   _BookkeepingField<T>  a pure pipeline fact with nothing external to point at (uuid).
 *                    Just `value` + `definition`.
 *
 * Lives in `@openisd/model`, distinct from `@openisd/engine` (WinISD-free physics) and
 * `@openisd/winisd` (WinISD serialisation) — ARCHITECTURE.md's module table.
 */

// ── SourceRole — record_registries.py:36 ──────────────────────────────────────────────
// `manual` is the ONE non-URL role — a hand-entered value, nothing to index. This is the
// origin a live OpenISDDriver edit gets.
export type SourceRole =
  | 'manufacturer_datasheet'
  | 'manufacturer_product_page'
  | 'manufacturer_listing_page'
  | 'distributor_datasheet'
  | 'distributor_product_page'
  | 'distributor_listing_page'
  | 'manual';

// ── Reading — model_driver.py:272-306 ──────────────────────────────────────────────────
// What ONE source published for a field: the literal it printed, and the two numbers
// parsed out of that literal. `actual_reading` and `read_value` are NOT two names for one
// fact — one is the printed literal, the other its SI-canonical parse. Neither is derived
// from the other; both come from one parse of the literal.
export interface Reading {
  /** The literal the source printed, verbatim: "8.55 Cm2", "32.5 g", "88 dB @ 1W/1m".
   *  ABSENT on a `manual` reading: a typed value has no source text to echo, and
   *  synthesising one would fabricate provenance (ledger QO36 ruling B3). */
  actual_reading?: string;
  /** SI-canonical parse of actual_reading: 0.000855, 0.0325, 0.40. */
  read_value: number;
  /** SI half-width of the rounding interval the printed digits assert.
   *  ABSENT on a `manual` reading — nothing stated a precision (QO36 B3). */
  read_precision?: number;
  conformed_reading?: string;
  conformed_by?: string;
  /** Present ⇒ this reading must NOT be used (e.g. an OCR mistranslation) — kept, not
   *  dropped, because a refused read is still what the document was read as. */
  rejected?: string;
  /** Closed vocabulary (record_registries.MeasurementNote) — e.g. '2.83V/1m', '1W/1m'. */
  note?: string;
}

// ── DqMark — record_registries.py:647-657 ──────────────────────────────────────────────
export type DqKind = 'calc' | 'range';
export type DqSeverity = 'info' | 'error';
export interface DqMark {
  kind: DqKind;
  severity: DqSeverity;
  rule: string;
  params: Record<string, unknown>;
  /** The registered rule's rendered template — record_registries.py `DqMark.detail`
   *  (record_registries.py:660-671). Free prose is banned on the Python side; this is
   *  always the rule's own template rendering, never composed here. */
  detail: string;
}

// ── _SpecEntry — model_driver.py:362-460. The T/S-field envelope. No flat value. ────────
export type DQStatus = 'MATCH' | 'MISMATCH' | 'NOT_MATCHABLE' | 'UNMATCHED';
// ── _DerivedField<T> / _BookkeepingField<T> — model_driver.py:164-205 ────────────────────
export interface Ground {
  origin: SourceRole;
  reading: string;
  definition: string;
}
// ── QualityBlock — model_driver.py:697-716 ─────────────────────────────────────────────
export type Rating = 'M' | 'L';
export interface CrossSourceReading {
  field: string;
  origin: SourceRole;
  reading: Reading;
}
export interface QualityBlock {
  rating: Rating;
  issue?: string;
  confirmed_fields: string[];
  fields_with_issues: string[];
  missing: string[];
  invalid: string[];
  parse_errors: string[];
  cross_source_only: CrossSourceReading[];
}

// ── _SpecSection / _Specs — model_driver.py:460+, 603-615 ────────────────────────────────
// Named, typed fields — NOT a Record<string, _SpecEntry> — matching CANONICAL_SPEC_FIELDS
// (record_registries.py:273-284) exactly. A field absent here has no closed-form allowlist
// own fields were not checked this pass) — typed loosely, flagged rather than guessed. ─
export interface CurveEntry { [key: string]: unknown }
export interface CurvesBlock {
  frequency_response?: CurveEntry;
  impedance?: CurveEntry;
}

// The openisd.yml record shape itself is not declared here — it is
// `OpenISDDriver`'s own constructor parameter (openisdDriver.ts). There is one
// external form, `OpenISDDriver`; everything above this line is the set of envelope
// kinds its fields are built from, not a competing record type.
