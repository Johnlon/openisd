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
export interface _SpecEntry {
  /** Names WHICH reading won. Always a key of `readings` — enforced on the Python side. */
  origin: SourceRole;
  /** Every source's own reading. ALWAYS populated, one entry or many — never empty. */
  readings: Partial<Record<SourceRole, Reading>>;
  /** Derived from `readings` on every load, never stored as an independent fact. */
  dq_status?: DQStatus;
  definition?: string;
  dq: DqMark[];
}
/** The one legal way to read a _SpecEntry's value — mirrors _SpecEntry.winning_reading
 *  (model_driver.py:415-420) rather than adding a second name for the same fact. */
export function winningReading(entry: _SpecEntry): Reading {
  const r = entry.readings[entry.origin];
  if (!r) throw new Error(`origin ${entry.origin} has no entry in readings — invalid _SpecEntry`);
  return r;
}

// ── _ScrapedField<T> — model_driver.py:141-153. Record-level metadata envelope. ─────────
export interface _ScrapedField<T> {
  value: T;
  origin: SourceRole;
  /** Only populated when >= 2 sources disagreed — NOT the "always >= 1" rule _SpecEntry
   *  follows; a single-source metadata field carries no readings at all. */
  readings?: Partial<Record<SourceRole, T>>;
  definition: string;
  dq: DqMark[];
  note?: string;
}

// ── _DerivedField<T> / _BookkeepingField<T> — model_driver.py:164-205 ────────────────────
export interface Ground {
  origin: SourceRole;
  reading: string;
  definition: string;
}
/** A value BUILT by the pipeline from evidence — not read from a source. */
export interface _DerivedField<T> {
  value: T;
  definition: string;
  /** What the derivation consumed — always at least one. */
  grounds: Ground[];
}
/** A pipeline-made fact with nothing external to point at (e.g. uuid). */
export interface _BookkeepingField<T> {
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

// ── _SpecSection / _Specs — model_driver.py:460+, 603-615 ────────────────────────────────
// Named, typed fields — NOT a Record<string, _SpecEntry> — matching CANONICAL_SPEC_FIELDS
// (record_registries.py:273-284) exactly. A field absent here has no closed-form allowlist
// slot at all (distinct from present-but-undefined, which means "not on this driver").
export interface _SpecSection {
  // T/S fields (_SPEC_TS_FIELDS)
  Fs?: _SpecEntry; Re?: _SpecEntry; Le?: _SpecEntry; fLe?: _SpecEntry; KLe?: _SpecEntry;
  Znom?: _SpecEntry; Qts?: _SpecEntry; Qes?: _SpecEntry; Qms?: _SpecEntry; Vas?: _SpecEntry;
  Sd?: _SpecEntry; BL?: _SpecEntry; Mms?: _SpecEntry; Cms?: _SpecEntry; Rms?: _SpecEntry;
  Xmax?: _SpecEntry; Xlim?: _SpecEntry;
  /** Printed sensitivity — no equivalent exists anywhere in today's engine types.
   *  Present here because it IS in the real canonical allowlist; the gap is on the
   *  OpenISDDriver/UI side, not this type. */
  SPL?: _SpecEntry;
  Pe?: _SpecEntry; Dd?: _SpecEntry; EBP?: _SpecEntry; numVC?: _SpecEntry; VCCon?: _SpecEntry;
  /**
   * The rest of what a `.wdr` can state about a driver.
   *
   * `OpenISDDriver` is a SUPERSET of a `.wdr` (ARCHITECTURE.md §"The same rule binds the
   * DRIVER"), so every field WinISD can carry has a home here. Most are ordinarily derived —
   * but WinISD lets a human type any of them, and an entered value is a fact that must not be
   * discarded just because we could also have computed it. Without these slots, cycling a real
   * `.wdr` through the model destroyed them.
   *
   * `c` (speed of sound) and `roo` (air density) are here too, and they are not a special case:
   * WinISD offers both for EDITING on the driver and saves what you type. The `.wpr` puts them
   * inside its `[Driver]` section as well (`docs/winisd/sample_project_Epique15_-_pr.wpr`,
   * lines 53-54), not in any project-level one. Whatever they describe, they are stored per
   * driver — plausibly the conditions that driver's figures were measured or computed at.
   * `OpenISDEnvironment` on the PROJECT is what a simulation runs on; these are what the
   * driver states.
   *
   * Units are WinISD's own (SI, and `Gloss` a fraction) — these keep WinISD's field names, so
   * they keep its conventions; the mm/litre naming convention applies only to the
   * `*_mm`/`*_l` fields above.
   */
  Dia?: _SpecEntry; Vd?: _SpecEntry; no?: _SpecEntry;
  SPLmax?: _SpecEntry; SPLmaxLF?: _SpecEntry; USPL?: _SpecEntry;
  alfaVC?: _SpecEntry; Rt?: _SpecEntry; Ct?: _SpecEntry; gamma?: _SpecEntry; Rme?: _SpecEntry;
  Mpow?: _SpecEntry; Mcost?: _SpecEntry; Gloss?: _SpecEntry; c?: _SpecEntry; roo?: _SpecEntry;
  // Descriptive/dimensional fields (_SPEC_DESCRIPTIVE_FIELDS)
  Vcd?: _SpecEntry; Hg?: _SpecEntry; Hc?: _SpecEntry;
  freq_low_hz?: _SpecEntry; freq_high_hz?: _SpecEntry; power_peak_W?: _SpecEntry;
  weight_kg?: _SpecEntry; Thick?: _SpecEntry; Depth?: _SpecEntry;
  MagDepth?: _SpecEntry; Magnet?: _SpecEntry; Basket?: _SpecEntry;
  Outer?: _SpecEntry; outer_x_mm?: _SpecEntry; outer_y_mm?: _SpecEntry;
  DVol?: _SpecEntry;
}
export interface _Specs {
  woofer?: _SpecSection;
  tweeter?: _SpecSection;
  passive_radiator?: _SpecSection;
}

// ── CurvesBlock — model_driver.py:891-896. Shape not yet fully verified (CurveEntry's
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
