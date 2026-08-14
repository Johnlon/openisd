/**
 * The `openisd.yml` record shape — TypeScript types matching
 * `winisd_tools/scrapers/scrapers/lib/model_driver.py` and `model_openisd.py`'s
 * `MetaFile` (the actual `driver.yml → openisd.yml` projection) FIELD FOR FIELD.
 * Hand-transcribed against the real pydantic models (no schema-export tooling exists
 * yet on the Python side — ARCHITECTURE.md AD-8 flags this as drift-risk).
 *
 * NOT one uniform envelope. Four distinct kinds, matched to what kind of fact a field
 * is (ARCHITECTURE.md AD-8):
 *
 *   SpecEntry        T/S fields, inside `specs` only. NO flat value — `origin` names
 *                    the winning source, a REQUIRED `readings` dict (>= 1 source) holds
 *                    each source's own reading; the number lives at
 *                    `readings[origin].read_value`, nowhere else.
 *   ScrapedField<T>  record-level metadata (manufacturer, brand, model). HAS a flat
 *                    `value`, plus `origin`; `readings` is only populated when >= 2
 *                    sources disagreed.
 *   DerivedField<T>  pipeline-computed (sku, name). `value` + `grounds` (evidence the
 *                    pipeline consumed) — no `origin`/`readings`, it was built, not read.
 *   BookkeepingField<T>  a pure pipeline fact with nothing external to point at (uuid).
 *                    Just `value` + `definition`.
 *
 * Package placement is provisional: this is neither `calc` (AD-6, WinISD-free physics)
 * nor `winisd` interop proper (AD-6's own definition) — it sits here only because that
 * is where the class it replaces (`Driver`, AD-8) currently lives, to keep the Step 5/6
 * migration reviewable. May warrant its own package later.
 */

// ── SourceRole — record_registries.py:36 ──────────────────────────────────────────────
// `manual` is the ONE non-URL role — a hand-entered value, nothing to index. This is the
// origin a live OpenISDDriver edit gets (ARCHITECTURE.md AD-8, "the lifecycle of origin
// for a live edit").
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

// ── SpecEntry — model_driver.py:362-460. The T/S-field envelope. No flat value. ────────
export type DQStatus = 'MATCH' | 'MISMATCH' | 'NOT_MATCHABLE' | 'UNMATCHED';
export interface SpecEntry {
  /** Names WHICH reading won. Always a key of `readings` — enforced on the Python side. */
  origin: SourceRole;
  /** Every source's own reading. ALWAYS populated, one entry or many — never empty. */
  readings: Partial<Record<SourceRole, Reading>>;
  /** Derived from `readings` on every load, never stored as an independent fact. */
  dq_status?: DQStatus;
  definition?: string;
  dq: DqMark[];
}
/** The one legal way to read a SpecEntry's value — mirrors SpecEntry.winning_reading
 *  (model_driver.py:415-420) rather than adding a second name for the same fact. */
export function winningReading(entry: SpecEntry): Reading {
  const r = entry.readings[entry.origin];
  if (!r) throw new Error(`origin ${entry.origin} has no entry in readings — invalid SpecEntry`);
  return r;
}

// ── ScrapedField<T> — model_driver.py:141-153. Record-level metadata envelope. ─────────
export interface ScrapedField<T> {
  value: T;
  origin: SourceRole;
  /** Only populated when >= 2 sources disagreed — NOT the "always >= 1" rule SpecEntry
   *  follows; a single-source metadata field carries no readings at all. */
  readings?: Partial<Record<SourceRole, T>>;
  definition: string;
  dq: DqMark[];
  note?: string;
}

// ── DerivedField<T> / BookkeepingField<T> — model_driver.py:164-205 ────────────────────
export interface Ground {
  origin: SourceRole;
  reading: string;
  definition: string;
}
/** A value BUILT by the pipeline from evidence — not read from a source. */
export interface DerivedField<T> {
  value: T;
  definition: string;
  /** What the derivation consumed — always at least one. */
  grounds: Ground[];
}
/** A pipeline-made fact with nothing external to point at (e.g. uuid). */
export interface BookkeepingField<T> {
  value: T;
  definition: string;
}

// ── DispositionField — model_driver.py:207-222 ─────────────────────────────────────────
export type Disposition =
  | 'ok' | 'no-ts-published' | 'no-wdr-projection' | 'awaiting-datasheet'
  | 'terminal-artifact' | 'excluded' | 'out-of-scope';
export interface DispositionField {
  value: Disposition;
  definition: string;
  /** Registered template text for `value` — free prose is rejected on the Python side. */
  detail: string;
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

// ── SpecSection / Specs — model_driver.py:460+, 603-615 ────────────────────────────────
// Named, typed fields — NOT a Record<string, SpecEntry> — matching CANONICAL_SPEC_FIELDS
// (record_registries.py:273-284) exactly. A field absent here has no closed-form allowlist
// slot at all (distinct from present-but-undefined, which means "not on this driver").
export interface SpecSection {
  // T/S fields (_SPEC_TS_FIELDS)
  Fs?: SpecEntry; Re?: SpecEntry; Le?: SpecEntry; fLe?: SpecEntry; KLe?: SpecEntry;
  Znom?: SpecEntry; Qts?: SpecEntry; Qes?: SpecEntry; Qms?: SpecEntry; Vas?: SpecEntry;
  Sd?: SpecEntry; BL?: SpecEntry; Mms?: SpecEntry; Cms?: SpecEntry; Rms?: SpecEntry;
  Xmax?: SpecEntry; Xlim?: SpecEntry;
  /** Printed sensitivity — ARCHITECTURE.md AD-8's named blocking gap: no equivalent
   *  exists anywhere in today's engine types. Present here because it IS in the real
   *  canonical allowlist; the gap is on the OpenISDDriver/UI side, not this type. */
  SPL?: SpecEntry;
  Pe?: SpecEntry; Dd?: SpecEntry; EBP?: SpecEntry; numVC?: SpecEntry; VCCon?: SpecEntry;
  // Descriptive/dimensional fields (_SPEC_DESCRIPTIVE_FIELDS)
  voice_coil_dia_mm?: SpecEntry; Hg_mm?: SpecEntry; Hc_mm?: SpecEntry;
  freq_low_hz?: SpecEntry; freq_high_hz?: SpecEntry; power_peak_W?: SpecEntry;
  weight_kg?: SpecEntry; thick_mm?: SpecEntry; depth_mm?: SpecEntry;
  magnet_depth_mm?: SpecEntry; magnet_dia_mm?: SpecEntry; basket_dia_mm?: SpecEntry;
  outer_dia_mm?: SpecEntry; outer_x_mm?: SpecEntry; outer_y_mm?: SpecEntry;
  driver_volume_l?: SpecEntry;
}
export interface Specs {
  woofer?: SpecSection;
  tweeter?: SpecSection;
  passive_radiator?: SpecSection;
}

// ── CurvesBlock — model_driver.py:891-896. Shape not yet fully verified (CurveEntry's
// own fields were not checked this pass) — typed loosely, flagged rather than guessed. ─
export interface CurveEntry { [key: string]: unknown }
export interface CurvesBlock {
  frequency_response?: CurveEntry;
  impedance?: CurveEntry;
}

/**
 * THE openisd.yml record — model_openisd.py:19-49 (`MetaFile`), field for field. This is
 * `OpenISDDriver`'s on-disk shape (ARCHITECTURE.md AD-8: `.owdr` is this, byte-identical).
 */
export interface OpenISDRecord {
  uuid: BookkeepingField<string>;
  quality: QualityBlock;
  manufacturer: ScrapedField<string>;
  brand: ScrapedField<string>;
  model: ScrapedField<string>;
  sku: DerivedField<string>;
  name?: DerivedField<string>;
  series?: ScrapedField<string>;
  driver_type: ScrapedField<string>;
  nominal_size_cm?: ScrapedField<number>;
  disposition: DispositionField;
  data_sources: BookkeepingField<Partial<Record<SourceRole, string>>>;
  authoritative: BookkeepingField<SourceRole>;
  product_image?: ScrapedField<string>;
  description?: ScrapedField<string>;
  surround_material?: ScrapedField<string>;
  specs: Specs;
  curves?: CurvesBlock;
}
