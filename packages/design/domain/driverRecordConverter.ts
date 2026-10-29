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
import {sourceRank} from "./sourceRank.js";
import {Corroboration, ReaderAgreement, corroborate, isRecognisedRejection, isUsable, readerVerdict, type Reading} from "./corroboration.js";
import {Reader} from "./reader.js";
import {DriverRoundTripCheck} from "./driverRoundTripDiffs.js";

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

/** The scraper's list of everything it read that no field took (QT93). It is the scraper's own
 *  store: accepted here and dropped, so it never reaches `openisd.json` or a `.wdr`. */
const SCRAPER_PRINTED_KEY = "printed";

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
  "categories",
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

/** A plain keyed object — what `Object.entries` yields for any non-null object value. Written as
 *  a guard rather than a cast so the compiler PROVES the shape instead of being told it. */
function isKeyedObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

const scraperVoiceCoilTupleSchema = z.strictObject({
  basis: z.strictObject({
    Re_ohm: z.enum(["per-coil", "for-stated-connection", "unknown"]),
    BL_Tm: z.enum(["per-coil", "for-stated-connection", "unknown"]),
  }),
  Re_ohm: scraperEntrySchema.nullable().optional(),
  BL_Tm: scraperEntrySchema.nullable().optional(),
  numVC: z.union([scraperEntrySchema, z.strictObject({state: z.literal("not-stated")})]),
  connection: z.enum(["series", "parallel", "unknown", "not-stated"]),
  connection_reading: scraperEntrySchema.nullable(),
});

/** A literal worth putting in a MISMATCH warning: what the source actually printed when we have
 *  it, the parsed number otherwise. */
function readingLiteral(r: Reading): string {
  if (r.actual_reading !== undefined) return r.actual_reading;
  return isUsable(r) ? String(r.read_value) : r.rejected;
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
      if (entry === undefined || entry.state === "N") continue;

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


/**
 * `VCCon` — the voice-coil connection row, which is MANDATORY in a `.wdr`.
 *
 * `1` = parallel, `2` = series: `docs/design/WINISD_SCHEMA.md` §3.2, ParState slot 46.
 *
 * Always marked E (John, 2026-10-05). WinISD writes N here whatever the wiring, so the mark carries
 * nothing and the reader takes the value on presence as entered (`winIsdDriverImport.ts`). Writing
 * N for a default would make the second save differ from the first: the reader turns the written
 * `1` into an entered parallel, which the next save marks E. Writing E every time is a fixed point.
 */
function wdrVCCon(spec: DriverSpec): WdrCell {
  const cell = spec.VCCon;
  // A resolved driver always states a wiring — `resolve()` stores `calcVCCon()`'s default as a
  // 'C' entry — so the exporter asks the driver and does not decide this fact itself; a null
  // could only reach here from an unresolved record, and writes parallel, the same default.
  return {
    value: cell.value === "series" ? "2" : "1",
    state: "entered",
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
 *   VCCon calculated default →  1,  mark E
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
/** A per-coil field written as its terminal value: the value is the terminal one, the entered
 *  mark is the field's own. */
function terminalCell(
  perCoil: Entered,
  value: number | null
): Pick<Readable<number | null>, "value"> & Entered {
  return { value, entered: perCoil.entered };
}

function wdrRow(
  errors: DriverError[],
  field: Pick<Readable<number | null>, "value"> & Entered,
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

function rejectedReadingCommentLines(driver: OpenISDDriver): string[] {
  const record = driver.toOpenIsdDeviceJson();
  const specs = record.specs;
  const sections = [specs.woofer, ...(specs.tweeter ? [specs.tweeter] : [])];
  const lines: string[] = [];
  for (const section of sections) {
    for (const [field, entry] of Object.entries(section)) {
      if (entry === undefined || entry.state !== "N") continue;
      const readings = entry.readings;
      if (!readings) continue;
      const roles = Object.keys(readings).sort((a, b) => {
        const diff = sourceRank(a) - sourceRank(b);
        if (diff !== 0) return diff;
        return a.localeCompare(b);
      });
      for (const role of roles) {
        const r = readings[role];
        if (!r) continue;
        const reason = !isUsable(r) ? r.rejected : `impossible for ${field}`;
        const textOrValue = r.actual_reading ?? (isUsable(r) || "read_value" in r ? String(r.read_value) : "");
        const printedPart = textOrValue ? ` ${textOrValue}` : "";
        lines.push(`${field}: ${role}${printedPart} — ${reason}`);
      }
    }
  }
  return lines;
}

/**
 * What `Comment=` holds before any `[DQ]` lines: the driver's own comment when it has one (an
 * incoming `.wdr` Comment returns unchanged), else its source URL — the manufacturer datasheet,
 * else the product page, else the listing page — else nothing; plus any rejected readings
 * (one line per field, plain text).
 */
function wdrCommentOf(driver: OpenISDDriver): string {
  const own = driver.comment.value;
  const baseComment =
    own !== null && own !== ""
      ? own
      : (driver.dataSource("manufacturer_datasheet") ??
        driver.dataSource("manufacturer_product_page") ??
        driver.dataSource("manufacturer_listing_page") ??
        "");
  const rejectedLines = rejectedReadingCommentLines(driver);
  const missingLines = rejectedLines.filter((l) => !baseComment.includes(l));
  if (missingLines.length === 0) return baseComment;
  return baseComment ? `${baseComment}\n${missingLines.join("\n")}` : missingLines.join("\n");
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
    comment: wdrCommentOf(driver),
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

  // `Re` and `BL` in a `.wdr` are TERMINAL values (WINISD_PARITY.md section 11b); the record holds
  // them per coil. The entered mark stays the per-coil field's own.
  const terminal = spec.solverParams();

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
    wdrRow(errors, terminalCell(spec.Re_ohm, terminal.Re_terminal_ohm.value), true, "Re"),
    wdrRow(errors, spec.Le_H, false, "Le"),
    wdrRow(errors, spec.fLe_hz, false, "fLe"),
    wdrRow(errors, spec.KLe_H_sqrtHz, true, "KLe"),
    wdrRow(errors, terminalCell(spec.BL_Tm, terminal.BL_terminal_Tm.value), true, "BL"),
    wdrRow(errors, spec.Xmax_m, false, "Xmax"),
    wdrRow(errors, spec.Cms_m_per_N, true, "Cms"),
    wdrRow(errors, spec.Qms, true, "Qms"),
    wdrRow(errors, spec.Qes, true, "Qes"),
    wdrRow(errors, spec.Rms_kg_per_s, true, "Rms"),
    wdrRow(errors, spec.Mms_kg, true, "Mms"),
    wdrRow(errors, spec.Sd_m2, true, "Sd"),
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

  return WinISDDriver.build(header, wdrCells, dqLines);
}

/** Driver file conversion — `driver.yml` to openisd + `.wdr`, and `.wdr` text back to a driver —
 *  holding the one engine every driver it builds is given. */
export class DriverRecordConverter {
  readonly #roundTrip: DriverRoundTripCheck;

  constructor(private readonly engine: Engine) {
    this.#roundTrip = new DriverRoundTripCheck(engine);
  }

  /**
   * `driver.yml` text in; `openisd.yml` text, `.wdr` text and every problem out.
   * Never throws for bad INPUT: a record the caller could not have known was malformed comes back as
   * an `errors` entry, because the Python caller's whole job is "call this, check `errors`" and an
   * exception crossing the V8 boundary is not something it can read. A defect in THIS code is a
   * different matter and is left to throw.
   */
  driverYmlToOpenisdAndWdr(
    driverYmlText: string
  ): DriverYmlProjection {
    const parsed = this.#driverYmlToOpenisdRecord(driverYmlText);
    if (!parsed.ok) {
      return { openisd: null, wdr: null, errors: [parsed.error] };
    }
    const openisdJson = parsed.record;

    const driverOrErrors = OpenISDDriver.fromConformingRecord(
      openisdJson,
      this.engine
    );
    if (Array.isArray(driverOrErrors)) {
      // its an array of errors not a driver
      const radiatorOrErrors =
        OpenISDPassiveRadiatorStandalone.fromConformingRecord(openisdJson);
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

    const errors: DriverError[] = [...parsed.warnings, ...driverOrErrors.dataQualityWarnings()];
    // The `.wdr` comment carries the SAME marks the openisd.yml does — the app's, not the parsed
    // driver.yml's — so the two derived files never disagree about a record's quality.
    const wdrDriver = openIsdDriverToWinIsdDriver(
      driverOrErrors,
      errors,
      dqCommentLines(exported)
    );

    const wdr = wdrDriver.toWdrIni();
    errors.push(...this.#roundTrip.roundTripProblems(driverOrErrors, openisd, wdr));
    return { openisd, wdr, errors };
  }

  /** `.wdr` text -> `OpenISDDriver` — the reverse of `openIsdDriverToWinIsdDriver`, for a caller
   *  (a `.wdr`/`.owdr` file import) holding raw `.wdr` text rather than an already-parsed
   *  `WinISDDriver`. Three steps, same chain `winIsdProjectToOpenIsdProject` uses for the driver
   *  embedded in a `.wpr`'s `[Driver]` section: parse the INI, read it into an openisd record
   *  (`winISDDriverToOpenISDDeviceJson` — recovers `driverType` from the `[DRIVERTYPE ...]` tag in
   *  `Comment=` when present, `'woofer'` otherwise), then validate that record into a driver. */
  winIsdDriverToOpenIsdDriver(
    text: string
  ): { value: OpenISDDriver | null; errors: DriverError[] } {
    const errors: DriverError[] = [];
    const wdrDriver = WinISDDriver.fromWdrIni(text);
    const { record, warnings } = winISDDriverToOpenISDDeviceJson(wdrDriver);
    errors.push(...warnings);

    const driverOrErrors = OpenISDDriver.fromConformingRecord(record, this.engine);
    if (Array.isArray(driverOrErrors)) {
      for (const problem of driverOrErrors)
        errors.push({ level: "error", field: "driver", message: problem });
      return { value: null, errors };
    }
    return { value: driverOrErrors, errors };
  }

  #driverYmlToOpenisdRecord(
    driverYmlText: string
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
    const record = this.#stripScraperOnlyFieldsFromJavascriptObject(javascriptThing,  warnings);

    const safe = makeRecordTextWinisdSafe(record, "", warnings);
    if (!isRecord(safe))
      throw new Error("the text pass must return the record it was given");

    return { ok: true, record: safe, warnings };
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
  #stripScraperOnlyFieldsFromJavascriptObject(
    driverYml: object,
    warnings: DriverError[]
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(driverYml)) {
      if (key === SCRAPER_ONLY_KEY || key === SCRAPER_PRINTED_KEY) continue;
      out[key] =
        key === "specs"
          ? this.#projectSpecs(stripDefinitionField(value),  warnings)
          : stripDefinitionField(value);
    }
    return stripMetadataOrigin(out);
  }

  #projectSpecs(specs: unknown, warnings: DriverError[]): unknown {
    if (!isKeyedObject(specs)) return specs;
    const sections: Record<string, unknown> = {};
    for (const [sectionKey, section] of Object.entries(specs)) {
      if (!isKeyedObject(section)) {
        sections[sectionKey] = section;
        continue;
      }
      const fields: Record<string, unknown> = {};
      const hasVoiceCoilTuple = (sectionKey === "woofer" || sectionKey === "tweeter") && Object.hasOwn(section, "voice_coil");
      const flatVoiceCoilFields = ["Re_ohm", "BL_Tm", "numVC", "VCCon"];
      const hasMixedVoiceCoilShape = hasVoiceCoilTuple && flatVoiceCoilFields.some(field => Object.hasOwn(section, field));
      for (const [field, entry] of Object.entries(section)) {
        if (field === "voice_coil" && (sectionKey === "woofer" || sectionKey === "tweeter")) {
          if (hasMixedVoiceCoilShape) {
            // Keep the illegal key in place so OpenISD's strict record schema rejects the mixed
            // tuple-plus-flat representation. Neither representation wins by precedence.
            fields.voice_coil = entry;
          } else {
            Object.assign(fields, this.#projectVoiceCoilTuple(entry, sectionKey, warnings));
          }
          continue;
        }
        const projected = this.#projectScraperEntry(entry, sectionKey, field,  warnings);
        fields[field] = entryWithoutAppOnlyKeys(projected);
      }
      sections[sectionKey] = fields;
    }
    return sections;
  }

  #projectVoiceCoilTuple(
    value: unknown,
    section: string,
    warnings: DriverError[]
  ): Record<string, unknown> {
    if (!isKeyedObject(value)) return {voice_coil: value};
    const tupleForSchema: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value)) {
      if (key === "Re_ohm" || key === "BL_Tm" || key === "numVC" || key === "connection_reading") {
        if (member === null || !isKeyedObject(member) || "state" in member) {
          tupleForSchema[key] = member;
        } else {
          tupleForSchema[key] = entryForScraperSchema(member);
        }
      } else {
        tupleForSchema[key] = member;
      }
    }
    const parsed = scraperVoiceCoilTupleSchema.safeParse(tupleForSchema);
    if (!parsed.success) return {voice_coil: value};

    const tuple = parsed.data;
    const result: Record<string, unknown> = {};
    let coilCount: number | undefined;
    if ("readings" in tuple.numVC) {
      const projectedCount = this.#projectScraperEntry(tuple.numVC, section, "numVC", warnings);
      if (isKeyedObject(projectedCount) && projectedCount.state === "E" && typeof projectedCount.value === "number") {
        coilCount = projectedCount.value;
        result.numVC = projectedCount;
      } else {
        result.numVC = projectedCount;
      }
    }
    if (coilCount !== undefined && (!Number.isInteger(coilCount) || coilCount < 1 || coilCount > 4)) {
      coilCount = undefined;
      warnings.push({level: "warn", field: `${section}.numVC`, message: "voice-coil scaling unavailable: coil count is not an integer from 1 through 4"});
    }

    if (tuple.connection === "series" || tuple.connection === "parallel") {
      const projectedConnection = this.#projectScraperEntry(
        tuple.connection_reading,
        section,
        "numVC",
        warnings
      );
      if (isKeyedObject(projectedConnection)) {
        result.VCCon = {
          ...projectedConnection,
          ...(projectedConnection.state === "E" ? {value: tuple.connection === "series" ? 2 : 1} : {}),
        };
      }
    } else if (tuple.connection === "unknown" && tuple.connection_reading !== null) {
      result.VCCon = {state: "N", readings: tuple.connection_reading.readings};
      warnings.push({level: "warn", field: `${section}.VCCon`, message: "voice-coil connection is unclassified; source reading is retained and no wiring is inferred"});
    }

    for (const field of ["Re_ohm", "BL_Tm"] as const) {
      const sourceEntry = tuple[field];
      if (sourceEntry === undefined || sourceEntry === null) continue;
      const projected = this.#projectScraperEntry(sourceEntry, section, field, warnings);
      if (!isKeyedObject(projected)) {
        result[field] = projected;
        continue;
      }
      const basis = tuple.basis[field];
      if (basis === "per-coil") {
        result[field] = projected;
        continue;
      }
      if (basis === "unknown") {
        result[field] = this.#unavailableVoiceCoilEntry(projected);
        warnings.push({level: "warn", field: `${section}.${field}`, message: "voice-coil reading basis is unknown; raw source readings are retained without per-coil scaling"});
        continue;
      }
      if (coilCount === undefined || (tuple.connection !== "series" && tuple.connection !== "parallel")) {
        result[field] = this.#unavailableVoiceCoilEntry(projected);
        warnings.push({level: "warn", field: `${section}.${field}`, message: "voice-coil reading is for a stated connection, but a supported connection and stated coil count are required for per-coil scaling"});
        continue;
      }
      if (projected.state !== "E" || typeof projected.value !== "number") {
        result[field] = projected;
        continue;
      }
      const factor = field === "Re_ohm"
        ? tuple.connection === "series" ? 1 / coilCount : coilCount
        : tuple.connection === "series" ? 1 / coilCount : 1;
      result[field] = {...projected, value: projected.value * factor};
    }
    return result;
  }

  #unavailableVoiceCoilEntry(projected: Record<string, unknown>): Record<string, unknown> {
    const unavailable: Record<string, unknown> = {state: "N"};
    if (projected.readings !== undefined) unavailable.readings = projected.readings;
    if (projected.dq_scraper !== undefined) unavailable.dq_scraper = projected.dq_scraper;
    return unavailable;
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
  #projectScraperEntry(
    entry: unknown,
    section: string,
    field: string,
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
    const originResult = selectOrigin(readings, field, (f, v) => this.engine.driver.isPhysicallyPlausible(f, v));
    // A reading outside the field's physical band never becomes a value (T018: the field is N
    // and the .wdr comment lists it), but the tools still read the range mark as a warning
    // (winisd_tools BUG_20260823 range/calc marks; AI triage of calculation-field failures).
    for (const [, r] of Object.entries(readings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!isUsable(r)) continue;
      const issue = this.engine.driver.rangeIssue(field, r.read_value);
      if (issue) warnings.push({ level: "warn", field, message: issue.text });
    }
    const corroboration = corroborate(readings);
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

    // Reader agreement is derived from each datasheet reading's `reads` and never stored. Readers
    // that disagree are a DQ warning showing every reader's read; a value only OCR read, with no
    // text layer behind it, is a warning that it is unverified.
    for (const [role, reading] of Object.entries(readings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const reads = reading.reads;
      if (reads === undefined) continue;
      const verdict = readerVerdict(reads);
      if (verdict.agreement === ReaderAgreement.Disagree) {
        const shown = Reader.ALL.flatMap((reader) => {
          const read = reads[reader.value];
          return read === undefined ? [] : [`${reader.value}=${read.actual_reading}`];
        }).join(", ");
        warnings.push({
          level: "warn",
          field: `${section}.${field}`,
          message: `readers disagree on ${role}: ${shown}`,
        });
      }
      if (verdict.unverified) {
        warnings.push({
          level: "warn",
          field: `${section}.${field}`,
          message: `${role} read by OCR only (${verdict.numbered.join(", ")}): no text layer confirmed it`,
        });
      }
    }

    for (const [role, r] of Object.entries(readings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!isUsable(r) && !isRecognisedRejection(r)) {
        warnings.push({
          level: "warn",
          field: `${section}.${field}`,
          message: `unrecognised rejection reason on ${role}: "${r.rejected}" (reading kept as written)`,
        });
      }
    }

    switch (originResult.kind) {
      case "none": {
        const notAvailable: Record<string, unknown> = { state: "N", readings };
        if (dq_scraper !== undefined) notAvailable.dq_scraper = dq_scraper;
        return notAvailable;
      }
      case "winner": {
        const winner = originResult.reading;
        const projected: Record<string, unknown> = {
          state: "E",
          value: winner.read_value,
          origin: originResult.role,
          corroboration: corroboration.value,
          readings,
        };
        if (dq_scraper !== undefined) projected.dq_scraper = dq_scraper;
        return projected;
      }
    }
  }
}
