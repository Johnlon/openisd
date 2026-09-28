/**
 * `driver.yml` text → `{ openisd, wdr, errors }` — the ONE entry `winisd_tools` calls in-process
 * (embedded V8, through `bridge.ts`) to generate BOTH derived files for one corpus record.
 *
 * The design is `drivers/drivers.md` Part C. It lives in `packages/design/domain` — the `.wdr`
 * transformer (`WinISDDriver`) it calls is imported from `../winisd`, not the other way round, so
 * this file sits on the design side of that boundary (John's QO103 ruling, "opt 1", 2026-08-31).
 *
 * `openisd.yml` is `driver.yml` minus `scraper_meta`. The EMITTED KEY ORDER is sorted
 * A→Z (recursively, via `sortKeysDeep`) so the written TEXT is canonical and bytewise
 * deterministic — regenerating the corpus produces a stable diff (John, 2026-09-20).
 *
 * Every value crossing into the `.wdr` is already SI, in both directions — the record stores
 * `Vas` in m³ and `Sd` in m², and a WinISD-written `.wdr` holds the same
 * (`drivers/mysamples/winisd/John-all-manu-populated.wdr`: `Vas=0.141584099539285`,
 * `Sd=0.00177545544983551`). So this file converts no units, and a unit conversion appearing here
 * later would be a bug, not a missing feature.
 *
 * The round-trip/diff tools this file's own writers and readers are proved against
 * (`wdrDriverDiffs`, `oidDriverDiffs`, `textRoundTripDiff`, `wdrRecordRoundTripDiffs`,
 * `jsonRoundTripDiffs`) live in `driverRoundTripDiffs.ts` — this file keeps the conversion logic
 * itself.
 */
import { parse as parseYmlToJs } from "yaml"; // driver.yml input; openisd/.wdr output is JSON/INI
import {z} from "zod";

import type {Calculated, Entered, Readable} from "./cell.js";
import {OpenISDDriver} from "./driver/openISDDriver.js";
import {OpenISDPassiveRadiatorStandalone} from "./passiveRadiator/openISDPassiveRadiatorStandalone.js";
import {type DriverError, type Engine} from "../engine/index.js";

import {type WdrCell, type WdrHeader, WinISDDriver,} from "../winisd/winisdDriver.js";
import {winisdSafeText} from "../winisd/winisdSafeText.js";
import type {CellState} from "../winisd/cellState.js";
import {
  type DriverSpec,
  type DriverDeviceJson,
  readingJsonSchema,
} from "./openisdSchema.js";
import {winISDDriverToOpenISDDeviceJson} from "./winIsdDriverImport.js";
import {sortKeysDeep} from "./openIsdDeviceJsonIo.js";
import {dqMarks} from "./specEntry.js";
import {selectOrigin} from "./selectOrigin.js";
import {Corroboration, corroborate, type Reading} from "./corroboration.js";
import {roundTripProblems} from "./driverRoundTripDiffs.js";

/** Both derived artefacts and every problem found producing them. `openisd`/`wdr` are null when a
 *  blocking failure stopped that artefact being produced; `errors` is always an array. */
export interface DriverYmlProjection {
  openisd: string | null;
  wdr: string | null;
  errors: DriverError[];
}

/** The scraper-only section. It is named ONCE, here, because this is the only place that drops
 *  it — `drivers.md` Part A's structural drop is a property of `OpenISDDeviceJson`, which cannot
 *  help a caller that must also emit YAML text preserving the source's key order. */
const SCRAPER_ONLY_KEY = "scraper_meta";

/** What a field MEANS. It belongs to `driver.yml` and to nothing downstream — John, 2026-09-01:
 *  "definition is 100% dead, it has no place in our openisd work except where I strip it in the
 *  bridge". A consumer of an openisd record already knows what `Fs` is.
 *
 *  It sits at EVERY depth of a record — on each metadata envelope, on each `sku.grounds` entry and
 *  on each spec entry — so removing it is a walk, not a top-level key filter like `scraper_meta`.
 *  Stripping it HERE, before the record is checked, is what lets `OpenISDDeviceJson` refuse it
 *  outright: that type states the shape of an OPENISD record, and `definition` is not part of one. */
const DEAD_KEY = "definition";

/** The app's own findings about a spec entry. `driver.yml` has no such key — it is not in that
 *  schema, so the scraper cannot write it, and anything the bridge finds under it did not come
 *  from the scraper (an old pipeline's range marks, a hand edit, a stale copy of a previous
 *  openisd.yml). The app is the only producer (John, 2026-09-20): it recomputes the marks for
 *  every driver quantity on load, but a field the solver never touches (`weight_kg`, `VCCon`,
 *  the frequency and power limits) keeps whatever it was loaded with — so the key is dropped at
 *  the boundary, not left for the loader. */
const APP_ONLY_SPEC_ENTRY_KEY = "dq_calculated";

/** The same value with every `definition` removed, at any depth. Rebuilt rather than deleted from,
 *  for the reason `stripDefinitionField` gives: the parsed object is the round-trip's reference and
 *  must not be mutated by the thing it is checking. */
function stripDefinitionField(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDefinitionField);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (key === DEAD_KEY) continue;
    out[key] = stripDefinitionField(v);
  }
  return out;
}

/** The record's TOP-LEVEL metadata fields — `ScrapedField<T>` envelopes that carry `origin` in
 *  `driver.yml` but not in `OpenISDDeviceJson` (John, 2026-09-05: "manu is in the model - whats
 *  the problem" — the field's own name already says what it is; `origin` there is redundant with
 *  the field name, unlike a spec entry's `readings`, which genuinely needs `origin` to say which
 *  of several sources won). Named explicitly, not walked structurally: a spec entry ALSO has an
 *  `origin` key, on a shape this strip must never touch. */
const METADATA_FIELDS_WITH_DEAD_ORIGIN: readonly string[] = Object.freeze([
  "manufacturer",
  "brand",
  "model",
  "driver_type",
  "series",
  "nominal_size_cm",
  "product_image",
  "description",
  "surround_material",
  "provided_by",
  "comment",
  "added",
]);

/** The record with `origin` dropped from each named metadata field's own envelope — never from
 *  `specs`, `curves`, or `sku.grounds`, which keep it. */
function stripMetadataOrigin(
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (
      !METADATA_FIELDS_WITH_DEAD_ORIGIN.includes(key) ||
      typeof value !== "object" ||
      value === null
    ) {
      out[key] = value;
      continue;
    }
    const field: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "origin") continue;
      field[k] = v;
    }
    out[key] = field;
  }
  return out;
}

/** A spec entry's `readings` with every REJECTED reading removed (John, 2026-09-05): `rejected`
 *  marks a reading a scraper must not use — evidence for a human auditing `driver.yml`, never a
 *  value the app should see. `origin` may not name a rejected reading (the pydantic record
 *  guard already enforces that), so dropping it here can never remove the entry's winning value —
 *  only a reading that was already excluded from winning. */
/** A plain keyed object — what `Object.entries` yields for any non-null object value. Written as
 *  a guard rather than a cast so the compiler PROVES the shape instead of being told it. */
function isKeyedObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One spec entry with its rejected readings dropped. Returns the entry unchanged when it carries
 *  no `readings` object — the shape this walk makes no claim about. */
function entryWithoutRejectedReadings(entry: unknown): unknown {
  if (!isKeyedObject(entry) || !isKeyedObject(entry.readings)) return entry;
  const kept = Object.entries(entry.readings).filter(
    ([, reading]) => !isKeyedObject(reading) || !("rejected" in reading)
  );
  return { ...entry, readings: Object.fromEntries(kept) };
}

/** One spec entry without the app-only key (`APP_ONLY_SPEC_ENTRY_KEY`). Rebuilt, not deleted
 *  from, for the reason `stripDefinitionField` gives. */
function entryWithoutAppOnlyKeys(entry: unknown): unknown {
  if (!isKeyedObject(entry)) return entry;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === APP_ONLY_SPEC_ENTRY_KEY) continue;
    out[key] = value;
  }
  return out;
}

/** `origin`/`corroboration` on SCRAPER INPUT — dead on arrival, D9/D10/D11's entire point. The
 *  bridge computes both itself (`projectScraperEntry`, below) and never trusts a scraped one; a
 *  `driver.json` scraped before the scraper stopped writing them (`winisd_tools` T2/T3 deleted
 *  `SpecEntry.origin`/`.corroboration`) still carries the stale pair, which would otherwise trip
 *  `scraperEntrySchema`'s `strictObject` as an unknown key and make an otherwise-good record
 *  fail to parse. Stripped only for the SCHEMA CHECK below — the returned `readings`/`dq_scraper`
 *  never carried them anyway, since `scraperEntrySchema` has no slot for either. */
const STALE_SCRAPER_ENTRY_KEYS: readonly string[] = Object.freeze(["origin", "corroboration"]);

function entryForScraperSchema(entry: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === APP_ONLY_SPEC_ENTRY_KEY || STALE_SCRAPER_ENTRY_KEYS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/** `driver.yml`'s scraper-supplied shape for one field (D9/D11/D15) — every source's raw
 *  reading, nothing app-computed. `readingJsonSchema` is reused from `openisdSchema.ts` rather
 *  than duplicated, so a reading can never mean something different to the two schemas that
 *  read it. */
const scraperEntrySchema = z.strictObject({
  readings: z.record(z.string(), readingJsonSchema).refine(
    (r) => Object.keys(r).length > 0, "expected at least one reading"
  ),
  dq_scraper: dqMarks(),
});

/** A literal worth putting in a MISMATCH warning: what the source actually printed when we have
 *  it, the parsed number otherwise. */
function readingLiteral(r: Reading & { readonly actual_reading?: string }): string {
  return r.actual_reading ?? String(r.read_value);
}

/** One scraper-supplied spec entry — `scraperEntrySchema`'s shape — projected into the entry the
 *  app schema now requires: `{state:'E', value, origin, corroboration, readings, dq_scraper}`
 *  (D9's origin pick, D11's corroboration verdict; the app's one DQ implementation, computed HERE
 *  and nowhere else — `crosscheck.py`'s TS port). `readings` still carries every reading,
 *  rejected ones included: D9's own fallback tiers need to see them, and
 *  `entryWithoutRejectedReadings` (run after this, unchanged) is what drops them from the copy
 *  the app actually stores.
 *
 *  A MISMATCH verdict also pushes a warning naming every source's own reading — sources
 *  disagreeing is worth a human's attention even though a value still gets written.
 *
 *  An entry that is not a scraper entry at all — already typed (`state` present, e.g. from a
 *  hand-authored fixture), or shaped too strangely for `scraperEntrySchema` to accept — is
 *  returned UNCHANGED: a calculated entry has nothing here to project, and a malformed one is
 *  left for the record schema below to reject with its own real error rather than this function
 *  inventing one. */
function projectScraperEntry(
  entry: unknown,
  section: string,
  field: string,
  engine: Engine,
  warnings: DriverError[]
): unknown {
  if (!isKeyedObject(entry) || "state" in entry) return entry;
  // A stale `dq_calculated` block (D22) or a stale `origin`/`corroboration` pair from a
  // `driver.json` scraped before D9/D10/D11 (`entryForScraperSchema`, above) would otherwise trip
  // `scraperEntrySchema`'s `strictObject` and silently fall through to "return entry unchanged"
  // below.
  const parsed = scraperEntrySchema.safeParse(entryForScraperSchema(entry));
  if (!parsed.success) return entry;

  const { readings, dq_scraper } = parsed.data;
  const origin = selectOrigin(readings, field, (f, v) => engine.driver.isPhysicallyPlausible(f, v));
  const corroboration = corroborate(readings);
  // `origin` always names one of `readings`' own keys — `selectOrigin` picks it FROM this same
  // object — so this lookup can never miss.
  const winner = readings[origin];

  if (corroboration === Corroboration.Mismatch) {
    const parts = Object.entries(readings)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([role, r]) => `${role}=${readingLiteral(r)}`)
      .join(", ");
    warnings.push({
      level: "warn",
      field: `${section}.${field}`,
      message: `sources disagree: ${parts}`,
    });
  }

  const projected: Record<string, unknown> = {
    state: "E",
    value: winner.read_value,
    origin,
    corroboration: corroboration.value,
    readings,
  };
  if (dq_scraper !== undefined) projected.dq_scraper = dq_scraper;
  return projected;
}

function projectSpecs(specs: unknown, engine: Engine, warnings: DriverError[]): unknown {
  if (!isKeyedObject(specs)) return specs;
  const sections: Record<string, unknown> = {};
  for (const [sectionKey, section] of Object.entries(specs)) {
    if (!isKeyedObject(section)) {
      sections[sectionKey] = section;
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const [field, entry] of Object.entries(section)) {
      const projected = projectScraperEntry(entry, sectionKey, field, engine, warnings);
      fields[field] = entryWithoutAppOnlyKeys(entryWithoutRejectedReadings(projected));
    }
    sections[sectionKey] = fields;
  }
  return sections;
}

/**
 * Every string in the record, rewritten so WinISD can draw and store it
 * (`../winisd/winisdSafeText.ts` holds the rules and the evidence for them).
 *
 * Applied HERE, on the record, rather than on either derived file: `openisd.json` and the `.wdr`
 * are both built from this object, so one pass cleans both and they cannot disagree about a
 * driver's name. It is also why it is not a replace over the serialized JSON — a rewrite that
 * produces `"` would break the string escaping.
 *
 * Each rewrite becomes a `warn` naming the path it happened at, so a record whose model name was
 * altered says so in `dq.alert` instead of changing quietly.
 */
function makeRecordTextWinisdSafe(
  value: unknown,
  path: string,
  warnings: DriverError[]
): unknown {
  if (typeof value === "string") {
    const safe = winisdSafeText(value);
    for (const change of safe.changes) {
      warnings.push({
        level: "warn",
        field: `winisd-safe-text:${path}`,
        message:
          `WinISD cannot carry ${describeCharacter(change.from)}; wrote ` +
          `"${change.to}" in its place`,
      });
    }
    return safe.text;
  }
  if (Array.isArray(value))
    return value.map((item, index) =>
      makeRecordTextWinisdSafe(item, `${path}.${index}`, warnings)
    );
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = makeRecordTextWinisdSafe(
      v,
      path === "" ? key : `${path}.${key}`,
      warnings
    );
  }
  return out;
}

/** `«™» (U+2122)` — the character itself and its code point, so a reader of `dq.alert` can find
 *  it in the source even when the terminal cannot draw it either. */
function describeCharacter(character: string): string {
  const codePoint = character.codePointAt(0);
  const hex =
    codePoint === undefined
      ? "?"
      : codePoint.toString(16).toUpperCase().padStart(4, "0");
  return `"${character}" (U+${hex})`;
}

/**
 * `driver.yml`'s keys, in the file's own order, minus the scraper section.
 *
 * Rebuilt as a fresh object rather than `delete`d from the parsed one: the parsed object is the
 * round-trip's reference (step 4 below) and must not be mutated by the thing it is checking.
 *
 * The spec keys pass through untouched — `driver.yml` spells them the openisd way (`Fs_hz`,
 * `Vas_m3`, …), so no canonicalisation is wanted here.
 */
function stripScraperOnlyFieldsFromJavascriptObject(
  driverYml: object,
  engine: Engine,
  warnings: DriverError[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(driverYml)) {
    if (key === SCRAPER_ONLY_KEY) continue;
    out[key] =
      key === "specs"
        ? projectSpecs(stripDefinitionField(value), engine, warnings)
        : stripDefinitionField(value);
  }
  return stripMetadataOrigin(out);
}



/**
 * The `[DQ]` lines a record's marks become in `Comment=` (ARCHITECTURE.md §3).
 *
 * `.wdr` has no field for data quality, and WinISD ignores anything it does not recognise in
 * `Comment=`, so the marks ride there — the only place in the format that can carry them at all.
 * One line per mark, in record order, each naming the field, the value that offended and the
 * mark's own detail, so a person reading the file in WinISD sees why a number is suspect.
 *
 * Read off the RECORD rather than the domain object: marks are the scraper's and the engine's
 * findings ABOUT the record, not a property of the driver the file describes.
 */
function dqCommentLines(record: DriverDeviceJson): string[] {
  const lines: string[] = [];
  const specs = record.specs;
  const sections = [specs.woofer, ...(specs.tweeter ? [specs.tweeter] : [])];

  for (const section of sections) {
    for (const [field, entry] of Object.entries(section)) {
      if (entry === undefined) continue;

      const value = entry.value;
      // `dq_scraper` only ever rides on an entered value — nothing was scraped for one the
      // engine derived.
      const dqScraper = entry.state === "E" ? entry.dq_scraper ?? [] : [];
      for (const mark of [...dqScraper, ...(entry.dq_calculated ?? [])]) {
        lines.push(`[DQ] ${field}=${String(value)}: ${mark.detail}`);
      }
    }
  }
  return lines;
}

/** The `.wdr` mark an OpenISD field carries: E for entered, C for calculated, N for a null
 *  value. The one place the three-way `CellState` is derived from the field's two flags. */
function wdrStateOf(field: Readable<unknown> & Entered & Calculated): CellState {
  if (field.entered) return "entered";
  if (field.calculated) return "calculated";
  return "not-available";
}

/** A parsed YAML document that is a mapping, as opposed to a scalar, a sequence or null. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `driver.yml` TEXT to an openisd RECORD: parse the YAML, insist the document is a mapping, and
 * drop the keys an openisd record does not carry (`scraper_meta` at the top level, `definition` at
 * every depth).
 *
 * Purely textual and structural — it knows nothing about drivers, radiators or the engine, so it
 * is the transformation both device kinds share before either is built from the result.
 *
 * `{ok:false, error}` comes back in place of the record when the text is not an openisd record at
 * all — tagged rather than an untagged `record | DriverError` union, because a `DriverError` is
 * itself a plain object and so satisfies the same `isRecord` guard a caller would otherwise use
 * to tell the two apart.
 * Returned rather than thrown for the reason the entry point gives: the Python caller reads
 * `errors`, and an exception crossing the V8 boundary is not something it can read.
 */
type OpenisdRecordResult =
  | { ok: true; record: Record<string, unknown>; warnings: DriverError[] }
  | { ok: false; error: DriverError };

function driverYmlToOpenisdRecord(
  driverYmlText: string,
  engine: Engine
): OpenisdRecordResult {
  let javascriptThing: unknown;
  try {
    javascriptThing = parseYmlToJs(driverYmlText);
  } catch (err) {
    return {
      ok: false,
      error: {
        level: "error",
        field: "driver.yml",
        message:
          "could not parse as YAML: " +
          String(err),
      },
    };
  }

  if (!isRecord(javascriptThing)) {
    return {
      ok: false,
      error: {
        level: "error",
        field: "driver.yml",
        message:
          "parsed to " +
          (javascriptThing === null ? "null" : typeof javascriptThing) +
          ", not a record",
      },
    };
  }

  // D9/D11 push a warning per MISMATCH field as a side effect of the walk below — collected here
  // rather than discovered by re-walking the finished record a second time; the text pass below
  // adds one per character it had to rewrite, to the same array.
  const warnings: DriverError[] = [];
  const record = stripScraperOnlyFieldsFromJavascriptObject(javascriptThing, engine, warnings);

  const safe = makeRecordTextWinisdSafe(record, "", warnings);
  if (!isRecord(safe))
    throw new Error("the text pass must return the record it was given");

  return { ok: true, record: safe, warnings };
}

/**
 * `VCCon` — the voice-coil connection row, which is MANDATORY in a `.wdr`.
 *
 * `1` = parallel, `2` = series: `docs/design/WINISD_SCHEMA.md` §3.2, ParState slot 46.
 *
 * Under normal circumstances WinIsd always writes N and never E or C, even when VCCon is entered in WinIsd.
 * The only observed cases where an E would be emitted is
 * - if loading a WDR that has no Parstate and then resaving then it is written as E,
 * or
 * - if we manually tweaked slot 46 to E, then loaded and resave the file.
 *
 * We will use E in the serialization to WDR because OpenIsd only loads E values and not N or C.
 * If we use N like WinIsd then a non-default value like Series will fail to load into OpenIsd.
 * Given that we know that WinIsd preserves the N/E then this should enable roundtripping VCCon
 * via WDR successfully.
 */
function wdrVCCon(spec: DriverSpec): WdrCell {
  const cell = spec.VCCon;
  // A resolved driver always states a wiring — `resolve()` stores `calcVCCon()`'s default as a
  // 'C' entry — so the exporter asks the driver and does not decide this fact itself; a null
  // could only reach here from an unresolved record, and writes parallel, the same default.
  // The .wdr mark still follows WinISD's own observed behaviour (comment above): entered stays
  // E, the calculated default is written N, never C.
  return {
    value: cell.value === "series" ? "2" : "1",
    state: cell.entered ? "entered" : "not-available",
  };
}

/**
 * OpenISD driver → `WinISDDriver` ready for `.wdr` serialisation.
 * Decision table — `docs/design/WDR_LOGIC.md` "Converting OpenISD to .wdr":
 *
 * ParState fields:
 *   entered       →  stated value,   mark E
 *   calculated    →  derived value,  mark C
 *   not-available, solver derives  →  solver value,  mark C
 *   not-available, solver cannot   →  0,             mark N
 *
 * Exceptions (handled before the main loop, in file order):
 *   VCCon entered parallel   →  1,  mark E
 *   VCCon entered series     →  2,  mark E
 *   VCCon not-available      →  1,  mark N
 *   numVC entered            →  stated count,  mark E
 *   numVC not-available      →  1,             mark C  (OpenISD's own default, not the record's)
 *   Xlim  entered            →  no key written, mark E on slot 10 only
 *   Xlim  not-available      →  no key written, mark N on slot 10 only
 *   c, roo (any)             →  air model value,  mark C
 */

/** One `.wdr` row, built from the OID field directly. The `.wdr` is a FIXED 48-row structure, so
 *  each row is its own call naming the field, its `.wdr` row name, and whether WinISD derives the value (`calculable`) — the C-vs-E mark is
 *  decided here, not looked up from a list.
 *
 *  Mark per `docs/design/WDR_LOGIC.md`'s middle rule (entered → E, derivable → C, otherwise → N):
 *  an entered value is E; a derived one is C when WinISD itself would derive it, E otherwise (the
 *  Sd ruling — openisd derives Sd from Dd beyond WinISD, so it is written E, never C, John
 *  2026-09-05). An absent value is written `0` mark N. */
function wdrRow(
  errors: DriverError[],
  field: Readable<number | null> & Entered,
  calculable: boolean,
  wdrName: string
): readonly [string, WdrCell] {
  const cell = field;
  if (cell.value === null)
    return [wdrName, { value: "0", state: "not-available" }];
  // No non-finite `cell.value` reaches here to guard against: `openisdSchema.ts` types every
  // spec entry's value as a plain (finite-only, by Zod v4 default) `z.number()`, and the
  // solver's own `setVal` write gate (`engine/solver.ts`) refuses to write a calculated value
  // that is not `isFinite(val) && val > 0` — so neither an entered nor a calculated value can
  // ever be `Infinity`/`NaN` here. Deleted 2026-09-21 rather than carried as permanently-dead
  // code (proved via both invariants, not just argued).
  // An ENTERED zero is written through as an entered zero, and flagged. A scraper that
  // failed to read a number frequently yields 0, and 0 is a legitimate value for several of
  // these fields, so nothing downstream can tell the two apart from the file alone. Corpus
  // generation is the last point that still knows the value was *stated* rather than
  // defaulted.
  if (cell.entered && cell.value === 0) {
    errors.push({
      level: "warn",
      field: wdrName,
      message:
        `${wdrName}: entered value is 0 - written as an entered 0; verify this is real and ` +
        `not a failed extraction`,
    });
  }
  const state =
    cell.entered
      ? "entered"
      : calculable
      ? "calculated"
      : "entered";
  return [wdrName, { value: String(cell.value), state }];
}

export function openIsdDriverToWinIsdDriver(
  driver: OpenISDDriver,
  errors: DriverError[],
  dqLines: readonly string[] = []
): WinISDDriver {
  const header: WdrHeader = {
    brand: driver.brand.value,
    model: driver.model.value,
    manufacturer: driver.manufacturer.value,
    providedBy: driver.providedBy.value ?? "",
    comment: driver.comment.value ?? "",
    dateAdded: driver.added.value ?? "",
  };

  const spec = driver.specs;

  // XLIM CROSSES AS A MARK AND NOTHING ELSE. WinISD's writer has no `Xlim=` key — it holds the
  // field in its editor, gives it ParState slot 10, and discards the value on save
  // (`XLIM_PARSTATE_SLOT`). The structure's last entry carries the mark alone.
  const xlim = spec.Xlim_m;

  // THE AIR THE FIGURES ASSUME. `c` and `roo` are the only two `.wdr` keys WinISD itself never
  // leaves at zero: its own New → Save writes 343.684120962152 and 1.20095217714682, marked
  // COMPUTED (`drivers/mysamples/winisd/john-all-defaults.wdr`). A driver that states neither is
  // not a driver measured in a vacuum — it is one measured in ordinary air — so writing 0 would
  // publish a claim no record makes and no physics allows. This holds even for an embedded
  // driver, whose own `c`/`roo` fields are always blank by design going forward (the project is
  // their sole source while embedded, `OpenISDDriverEmbedded.update()`) — the file still needs
  // a concrete pair for WinISD compatibility.
  //
  // THE WRITTEN VALUE comes from `solveConsistencyGroup()`, not the raw field getter: for a
  // standalone driver it resolves to the same bare-reference default the field itself would
  // report, but for an embedded driver it goes through `OpenISDDriverEmbedded`'s override of
  // that method, which always reflects the project's CURRENT environment — including for a
  // driver embedded before this rule existed and still carrying a stale entered value in its
  // raw record (every project's `.owpr`/browser-storage load bypasses `update()`, so nothing
  // retroactively clears that stale value; reading the raw field here would silently export it).
  // The ENTERED/CALCULATED mark still comes from the plain field's own state, unchanged — the
  // driver's record is the one source of truth for whether a human stated a value, the exporter
  // does not decide that itself.
  const cCell = spec.c_m_per_s;
  const rooCell = spec.roo_kg_per_m3;

  // `cell.value` is never null: an unstated coil count reads back as the driver's own
  // calculated default (`calcNumVC()`), not absence — the exporter asks the driver, it does
  // not decide this fact itself. WinISD's own New -> Save writes E here from a hardcoded store
  // in its blank-driver init; that claims a reading nobody supplied, and this is the one slot
  // where the writer parts company with it (SPEC_ENGINE.md "openisd writes C in the numVC
  // slot, not E").
  const numVC = spec.numVC;

  // THE FIXED 48-ROW STRUCTURE, each row written explicitly in WinISD's file order, plus Xlim's
  // slot-10 mark last. `.wdr` is a FIXED structure — no loops, no row-order list: the sequence
  // IS the order, and each row names the field, its `.wdr` key and whether WinISD derives it
  // (`calculable`).
  const wdrCells: Array<readonly [string, WdrCell]> = [
    wdrRow(errors, spec.Qts, true, "Qts"),
    wdrRow(errors, spec.Znom_ohm, true, "Znom"),
    wdrRow(errors, spec.Fs_hz, true, "Fs"),
    wdrRow(errors, spec.Pe_W, true, "Pe"),
    wdrRow(errors, spec.SPL_dB, true, "SPL"),
    wdrRow(errors, spec.Re_ohm, true, "Re"),
    wdrRow(errors, spec.Le_H, false, "Le"),
    wdrRow(errors, spec.fLe_hz, false, "fLe"),
    wdrRow(errors, spec.KLe_H_sqrtHz, true, "KLe"),
    wdrRow(errors, spec.BL_Tm, true, "BL"),
    wdrRow(errors, spec.Xmax_m, false, "Xmax"),
    wdrRow(errors, spec.Cms_m_per_N, true, "Cms"),
    wdrRow(errors, spec.Qms, true, "Qms"),
    wdrRow(errors, spec.Qes, true, "Qes"),
    wdrRow(errors, spec.Rms_kg_per_s, true, "Rms"),
    wdrRow(errors, spec.Mms_kg, true, "Mms"),
    wdrRow(errors, spec.Sd_m2, false, "Sd"),
    wdrRow(errors, spec.Vas_m3, true, "Vas"),
    wdrRow(errors, spec.Dia_m, true, "Dia"),
    wdrRow(errors, spec.Vd_m3, true, "Vd"),
    wdrRow(errors, spec.no, true, "no"),
    wdrRow(errors, spec.Dd_m, true, "Dd"),
    wdrRow(errors, spec.EBP_hz, true, "EBP"),
    [
      "numVC",
      {
        value: String(numVC.value),
        state: numVC.entered ? "entered" : "calculated",
      },
    ],
    wdrRow(errors, spec.Hc_m, true, "Hc"),
    wdrRow(errors, spec.Hg_m, true, "Hg"),
    wdrRow(errors, spec.SPLmax_dB, true, "SPLmax"),
    wdrRow(errors, spec.SPLmaxLF_dB, true, "SPLmaxLF"),
    wdrRow(errors, spec.USPL_dB, true, "USPL"),
    wdrRow(errors, spec.alfaVC_per_K, false, "alfaVC"),
    wdrRow(errors, spec.Rt_K_per_W, false, "Rt"),
    wdrRow(errors, spec.Ct_J_per_K, false, "Ct"),
    wdrRow(errors, spec.gamma_m_per_s2_A, true, "gamma"),
    wdrRow(errors, spec.Rme_kg_per_s, true, "Rme"),
    wdrRow(errors, spec.Mpow_N_per_sqrtW, true, "Mpow"),
    wdrRow(errors, spec.Mcost_kg_per_s, true, "Mcost"),
    wdrRow(errors, spec.Gloss, true, "Gloss"),
    ["VCCon", wdrVCCon(spec)],
    [
      "c",
      {
        value: String(cCell.value),
        state: cCell.entered ? "entered" : "calculated",
      },
    ],
    [
      "roo",
      {
        value: String(rooCell.value),
        state: rooCell.entered ? "entered" : "calculated",
      },
    ],
    wdrRow(errors, spec.Thick_m, false, "Thick"),
    wdrRow(errors, spec.Depth_m, true, "Depth"),
    wdrRow(errors, spec.MagDepth_m, true, "MagDepth"),
    wdrRow(errors, spec.Magnet_m, true, "Magnet"),
    wdrRow(errors, spec.Basket_m, false, "Basket"),
    wdrRow(errors, spec.Outer_m, false, "Outer"),
    wdrRow(errors, spec.Vcd_m, false, "Vcd"),
    wdrRow(errors, spec.DVol_m3, true, "DVol"),
    // Xlim crosses as its slot-10 mark and nothing else — its own state (a cell with no value
    // reads `not-available`), never a value.
    ["Xlim", { value: "", state: wdrStateOf(xlim) }],
  ];

  // NO `[DRIVERTYPE ...]` TAG IS EVER WRITTEN HERE: `driver: OpenISDDriver`'s own `section` is
  // `readonly section = 'woofer' as const` — the only type this function's parameter accepts —
  // so a tag naming any OTHER type could never be produced (deleted 2026-09-22 rather than
  // carried as permanently-dead code: proved via the class's own literal field, not argued). The
  // tag mechanism itself still exists and is still read back (`winISDDriverToOpenISDDeviceJson`
  // recovers it from `Comment=` when present) — a driver-only `.wdr` has no dedicated field for
  // the type (bugs/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md),
  // so `Comment=` is where it would ride — but nothing on THIS write side ever has a non-woofer
  // `OpenISDDriver` to tag.
  return WinISDDriver.build(header, wdrCells, dqLines);
}

/** `.wdr` text -> `OpenISDDriver` — the reverse of `openIsdDriverToWinIsdDriver`, for a caller
 *  (a `.wdr`/`.owdr` file import) holding raw `.wdr` text rather than an already-parsed
 *  `WinISDDriver`. Three steps, same chain `winIsdProjectToOpenIsdProject` uses for the driver
 *  embedded in a `.wpr`'s `[Driver]` section: parse the INI, read it into an openisd record
 *  (`winISDDriverToOpenISDDeviceJson` — recovers `driverType` from the `[DRIVERTYPE ...]` tag in
 *  `Comment=` when present, `'woofer'` otherwise), then validate that record into a driver. */
export function winIsdDriverTextToOpenIsdDriver(
  text: string,
  engine: Engine
): { value: OpenISDDriver | null; errors: DriverError[] } {
  const errors: DriverError[] = [];
  const wdrDriver = WinISDDriver.fromWdrIni(text);
  const { record, warnings } = winISDDriverToOpenISDDeviceJson(wdrDriver);
  errors.push(...warnings);

  const driverOrErrors = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driverOrErrors)) {
    for (const problem of driverOrErrors)
      errors.push({ level: "error", field: "driver", message: problem });
    return { value: null, errors };
  }
  return { value: driverOrErrors, errors };
}

/**
 * `driver.yml` text in; `openisd.yml` text, `.wdr` text and every problem out.
 * Never throws for bad INPUT: a record the caller could not have known was malformed comes back as
 * an `errors` entry, because the Python caller's whole job is "call this, check `errors`" and an
 * exception crossing the V8 boundary is not something it can read. A defect in THIS code is a
 * different matter and is left to throw.
 */
export function driverYmlToOpenisdAndWdr(
  driverYmlText: string,
  engine: Engine,
): DriverYmlProjection {
  const parsed = driverYmlToOpenisdRecord(driverYmlText, engine);
  if (!parsed.ok) {
    return { openisd: null, wdr: null, errors: [parsed.error] };
  }
  const openisdJson = parsed.record;

  const driverOrErrors = OpenISDDriver.fromConformingRecord(
    openisdJson,
    engine
  );
  if (Array.isArray(driverOrErrors)) {
    // its an array of errors not a driver
    const radiatorOrErrors =
      OpenISDPassiveRadiatorStandalone.fromConformingRecord(
        openisdJson,
        engine
      );
    if (!Array.isArray(radiatorOrErrors)) {
      // not an array so its the PR
      return {
        openisd: JSON.stringify(sortKeysDeep(radiatorOrErrors.toOpenIsdDeviceJson()), null, 2),
        wdr: null,
        errors: parsed.warnings,
      };
    }

    const errors: DriverError[] = [...parsed.warnings];
    // dedupe
    for (const problem of new Set([...driverOrErrors, ...radiatorOrErrors])) {
      errors.push({ level: "error", field: "record", message: problem });
    }
    return { openisd: JSON.stringify(sortKeysDeep(openisdJson), null, 2), wdr: null, errors };
  }

  // ONE `dq_calculated` PRODUCER (John, 2026-09-20): what the pipeline writes is what the app
  // exports for this record — the app's loader has already resolved it and marked every
  // finding. So the record on disk carries the marks the app would write, and the bundler's
  // round-trip gate (`scripts/roundTripGate.mjs`) passes it by construction.
  const exported = driverOrErrors.toOpenIsdDeviceJson();
  const openisd = JSON.stringify(sortKeysDeep(exported), null, 2);

  const errors: DriverError[] = [...parsed.warnings];
  // The `.wdr` comment carries the SAME marks the openisd.yml does — the app's, not the parsed
  // driver.yml's — so the two derived files never disagree about a record's quality.
  const wdrDriver = openIsdDriverToWinIsdDriver(
    driverOrErrors,
    errors,
    dqCommentLines(exported)
  );

  const wdr = wdrDriver.toWdrIni();
  errors.push(...roundTripProblems(driverOrErrors, openisd, wdr, engine));
  return { openisd, wdr, errors };
}
