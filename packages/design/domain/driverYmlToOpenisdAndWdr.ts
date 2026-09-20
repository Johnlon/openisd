/**
 * `driver.yml` text → `{ openisd, wdr, errors }` — the ONE entry `winisd_tools` calls in-process
 * (embedded V8, through `bridge.ts`) to generate BOTH derived files for one corpus record.
 *
 * The design is `drivers/drivers.md` Part C. It lives in `packages/design/winisd` rather than
 * `packages/design` by John's QO103 ruling ("opt 1", 2026-08-31): the `.wdr` transformer
 * (`WinISDDriver`) is here, `packages/design` declares no dependencies, and a design-side entry
 * would have to import `@openisd/design/winisd` — closing a design → winisd → design cycle.
 *
 * `openisd.yml` is `driver.yml` minus `scraper_meta`. The KEY ORDER is `driver.yml`'s own, so
 * regenerating the corpus produces a stable diff (John, 2026-08-31: "in order that we have
 * deterministic consistent ordering please follow the same ordering seen in driver.yml").
 *
 * Every value crossing into the `.wdr` is already SI, in both directions — the record stores
 * `Vas` in m³ and `Sd` in m², and a WinISD-written `.wdr` holds the same
 * (`drivers/mysamples/winisd/John-all-manu-populated.wdr`: `Vas=0.141584099539285`,
 * `Sd=0.00177545544983551`). So this file converts no units, and a unit conversion appearing here
 * later would be a bug, not a missing feature.
 */
import {parse as parseYmlToJs, stringify} from "yaml";

import type {Field} from "./index.js";
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from "./index.js";
import {type DriverError, Engine} from "../engine/index.js";

import {type WdrCell, type WdrHeader, WinISDDriver,} from "../winisd/winisdDriver.js";
import {OPENISD_FIELDS, type WdrFieldKey} from "../fields/index.js";
import {
  type DriverSpec,
  type SpecEntryJson,
  specEntryJsonSchema,
  winISDDriverToOpenISDDeviceJson,
} from "./openisdSchema.js";

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

function stripRejectedReadings(specs: unknown): unknown {
  if (!isKeyedObject(specs)) return specs;
  const sections: Record<string, unknown> = {};
  for (const [sectionKey, section] of Object.entries(specs)) {
    if (!isKeyedObject(section)) {
      sections[sectionKey] = section;
      continue;
    }
    const fields: Record<string, unknown> = {};
    for (const [field, entry] of Object.entries(section)) {
      fields[field] = entryWithoutAppOnlyKeys(entryWithoutRejectedReadings(entry));
    }
    sections[sectionKey] = fields;
  }
  return sections;
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
  driverYml: object
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(driverYml)) {
    if (key === SCRAPER_ONLY_KEY) continue;
    out[key] =
      key === "specs"
        ? stripRejectedReadings(stripDefinitionField(value))
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
function dqCommentLines(record: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const specs = record.specs;
  if (typeof specs !== "object" || specs === null) return lines;

  for (const section of Object.values(specs)) {
    if (typeof section !== "object" || section === null) continue;
    for (const [field, rawEntry] of Object.entries(section)) {
      // Validated into the record's OWN type, so every read below is a typed field access:
      // `read_value` is a number, `detail` is a string, and neither needs a guard.
      const parsed = specEntryJsonSchema.safeParse(rawEntry);
      if (!parsed.success) continue;
      const entry: SpecEntryJson = parsed.data;

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

/**
 * Every difference between two `WinISDDriver`s that is NOT one of the documented, one-directional
 * moves `docs/design/WDR_LOGIC.md` describes — the round-trip check's own "which differences are
 * expected" list (John, 2026-09-02: "do i1/2 match or different only where we expect them to").
 *
 * ONE EXCEPTION, and it is named in `WDR_LOGIC.md` "VCCon exception — read on presence, not
 * mark": VCCon's ParState slot (46) is UNPROVEN — no probing shows WinISD ever writing it — so a
 * reader never consults the mark for this field at all, only whether `VCCon=` is present
 * (`wdrVCConEntry`). Our own writer marks an UNSTATED wiring `not-available` (`wdrVCCon`);
 * reading that `.wdr` back then reads the `1` it finds as entered, because presence is the only
 * thing this field is ever read on. A second round trip is stable at `entered` — this is a
 * one-time, DOCUMENTED gain of certainty, not a loss, and not a coding error, so it is the one
 * field compared by value only.
 *
 * A SECOND EXCEPTION, same reasoning: `Xlim`. `WDR_LOGIC.md`: "Xlim has no key... Writing
 * OpenISD to `.wdr`... discards its value on save." `w2`'s Xlim mark is a residue of the
 * ORIGINAL record's entered value, carried by ParState slot 10 alone with no `Xlim=` line to
 * anchor it; nothing can rebuild an entered-but-valueless cell, so `w3` (built from a real
 * record) is always `not-available` there. That is the documented loss, not a coding error.
 *
 * Everything else — every other `.wdr` key's value AND mark, the six header fields — is compared
 * exactly. A difference anywhere else means the reader and the writer disagree about what the
 * SAME record means, which is exactly the coding error this check exists to catch.
 */
function wdrDriverDiffs(a: WinISDDriver, b: WinISDDriver): string[] {
  const diffs: string[] = [];
  const HEADER_FIELDS: ReadonlyArray<keyof WdrHeader> = [
    "brand",
    "model",
    "manufacturer",
    "providedBy",
    "comment",
    "dateAdded",
  ];
  for (const field of HEADER_FIELDS) {
    const av = a.headerField(field) ?? "";
    const bv = b.headerField(field) ?? "";
    if (av !== bv)
      diffs.push(
        `header.${field}: ${JSON.stringify(av)} vs ${JSON.stringify(bv)}`
      );
  }
  for (const [key, ca] of a.rows()) {
    const cb = b.cell(key);
    if (ca.value !== cb.value) {
      diffs.push(
        `${key}: value ${JSON.stringify(ca.value)} vs ${JSON.stringify(
          cb.value
        )}`
      );
    }
    if (key === "VCCon" || key === "Xlim") continue; // the two documented exceptions above
    if (ca.state !== cb.state) {
      diffs.push(`${key}: mark ${ca.state} vs ${cb.state}`);
    }
  }
  return diffs;
}

/**
 * THE ROUND TRIPS (`drivers.md` Part C step 6). Both texts this function is about to return are
 * read back and re-written; a difference means our own writer and reader disagree, and every file
 * on disk is then a lossy copy of a record nobody can reconstruct.
 *
 * Reported through `errors`, not thrown: the bridge's contract with its Python caller is
 * never-throws across the V8 boundary, and an exception there is unreadable to it (`openisd_js.py`
 * raises `BridgeFault` and aborts the whole run). A `level:'error'` entry reaches the caller,
 * names the file that failed, and stops that record being written — which is what a coding error
 * on this path deserves. NONE OF THESE IS EXPECTED TO FIRE (John, 2026-09-02: "we do not expect
 * any issues, issues are a coding error").
 */
function roundTripProblems(
  openisd: string,
  wdr: string | null,
  engine: Engine
): DriverError[] {
  const found: DriverError[] = [];

  // openisd.yml: text -> record -> text. The record is what a reader gets; the text is what we
  // wrote. If re-serialising the reader's record does not reproduce our text, one of the two is
  // losing something.
  try {
    if (stringify(parseYmlToJs(openisd)) !== openisd) {
      found.push({
        level: "error",
        field: "yml-round-trip",
        message:
          "the openisd.yml we wrote does not survive being read back and rewritten",
      });
    }
  } catch (err) {
    found.push({
      level: "error",
      field: "yml-round-trip",
      message:
        "the openisd.yml we wrote cannot be parsed back: " +
        (err instanceof Error ? err.message : String(err)),
    });
  }

  // .wdr: text -> WinISDDriver -> text. Same question of the INI writer and its reader.
  if (wdr !== null) {
    let w2: WinISDDriver | undefined;
    try {
      w2 = WinISDDriver.fromWdrIni(wdr);
      if (w2.toWdrIni() !== wdr) {
        found.push({
          level: "error",
          field: "wdr-round-trip",
          message:
            "the .wdr we wrote does not survive being read back and rewritten",
        });
      }
    } catch (err) {
      found.push({
        level: "error",
        field: "wdr-round-trip",
        message:
          "the .wdr we wrote cannot be read back: " +
          (err instanceof Error ? err.message : String(err)),
      });
    }

    // THE EXTENDED CHAIN: T1 -> W2 -> I3 -> (a domain driver) -> W3 -> T3. W2 is the
    // `.wdr` reader's own opinion of what we wrote; I3 is that opinion projected into a
    // record; W3 is what OUR record→.wdr writer makes of I3. If W3 disagrees with W2, the
    // reader and the writer disagree about what the SAME record means — a defect neither
    // the text-only check above nor the openisd.yml check can see, because both of those
    // stay on one side of the record boundary.
    //
    // I1 vs I3 is NOT compared here: the difference is BY DESIGN — only `entered` cells
    // cross into a `.wdr` (`WDR_LOGIC.md`), `Xlim` never crosses as a value, and `Dia` is
    // always 0 — so I1 and I3 disagreeing on exactly those points is the format's own
    // limit, not a defect in this code, and asserting I1 === I3 would fail on every real
    // record.
    if (w2 !== undefined) {
      try {
        const { record: i3 } = winISDDriverToOpenISDDeviceJson(w2);
        const driver3 = OpenISDDriver.fromConformingRecord(i3, engine);
        if (Array.isArray(driver3)) {
          found.push({
            level: "error",
            field: "wdr-record-round-trip",
            message:
              "the .wdr we wrote reads back as a record the driver seam refuses: " +
              driver3.join("; "),
          });
        } else {
          const w3 = openIsdDriverToWinIsdDriver(driver3, []);
          for (const diff of wdrDriverDiffs(w2, w3)) {
            found.push({
              level: "error",
              field: "wdr-record-round-trip",
              message: diff,
            });
          }
        }
      } catch (err) {
        found.push({
          level: "error",
          field: "wdr-record-round-trip",
          message:
            "the .wdr -> record -> .wdr chain threw: " +
            (err instanceof Error ? err.message : String(err)),
        });
      }
    }
  }
  return found;
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
 * A `DriverError` comes back in place of the record when the text is not an openisd record at all.
 * Returned rather than thrown for the reason the entry point gives: the Python caller reads
 * `errors`, and an exception crossing the V8 boundary is not something it can read.
 */
function driverYmlToOpenisdRecord(
  driverYmlText: string
): Record<string, unknown> | DriverError {
  let javascriptThing: unknown;
  try {
    javascriptThing = parseYmlToJs(driverYmlText);
  } catch (err) {
    return {
      level: "error",
      field: "driver.yml",
      message:
        "could not parse as YAML: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }

  if (!isRecord(javascriptThing)) {
    return {
      level: "error",
      field: "driver.yml",
      message:
        "parsed to " +
        (javascriptThing === null ? "null" : typeof javascriptThing) +
        ", not a record",
    };
  }

  // noinspection UnnecessaryLocalVariableJS
  const record = stripScraperOnlyFieldsFromJavascriptObject(javascriptThing);

  return record;
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
  const cell = spec.VCCon.get();
  // `cell.value` is never null: an unstated wiring reads back as the driver's own calculated
  // default (`calcVCCon()`), not absence — the exporter asks the driver, it does not decide
  // this fact itself. The .wdr mark still follows WinISD's own observed behaviour (comment
  // above): entered stays E, the calculated default is written N, never C.
  return {
    value: cell.value === "series" ? "2" : "1",
    state: cell.state === "entered" ? "entered" : "not-available",
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
 *  each row is its own call naming the field, its field-table key (whose FieldDef supplies the
 *  `.wdr` row name), and whether WinISD derives the value (`calculable`) — the C-vs-E mark is
 *  decided here, not looked up from a list.
 *
 *  Mark per `docs/design/WDR_LOGIC.md`'s middle rule (entered → E, derivable → C, otherwise → N):
 *  an entered value is E; a derived one is C when WinISD itself would derive it, E otherwise (the
 *  Sd ruling — openisd derives Sd from Dd beyond WinISD, so it is written E, never C, John
 *  2026-09-05). An absent value is written `0` mark N. */
function wdrRow(
  errors: DriverError[],
  field: Field<number>,
  calculable: boolean,
  schemaKey: WdrFieldKey
): readonly [string, WdrCell] {
  const wdrName = OPENISD_FIELDS[schemaKey].wdr;
  const cell = field.get();
  if (cell.value == null)
    return [wdrName, { value: "0", state: "not-available" }];
  if (!isFinite(cell.value)) {
    errors.push({
      level: "warn",
      field: wdrName,
      message: `${wdrName}: value is not finite — field dropped, WinISD's own default applies`,
    });
    return [wdrName, { value: "0", state: "not-available" }];
  }
  // An ENTERED zero is written through as an entered zero, and flagged. A scraper that
  // failed to read a number frequently yields 0, and 0 is a legitimate value for several of
  // these fields, so nothing downstream can tell the two apart from the file alone. Corpus
  // generation is the last point that still knows the value was *stated* rather than
  // defaulted.
  if (cell.state === "entered" && cell.value === 0) {
    errors.push({
      level: "warn",
      field: wdrName,
      message:
        `${wdrName}: entered value is 0 — written as an entered 0; verify this is real and ` +
        `not a failed extraction`,
    });
  }
  const state =
    cell.state === "entered"
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
    brand: driver.brand.get().value ?? "",
    model: driver.model.get().value ?? "",
    manufacturer: driver.manufacturer.get().value ?? "",
    providedBy: driver.providedBy.get().value ?? "",
    comment: driver.comment.get().value ?? "",
    dateAdded: driver.added.get().value ?? "",
  };

  const spec = driver.spec[driver.section];

  // XLIM CROSSES AS A MARK AND NOTHING ELSE. WinISD's writer has no `Xlim=` key — it holds the
  // field in its editor, gives it ParState slot 10, and discards the value on save
  // (`XLIM_PARSTATE_SLOT`). The structure's last entry carries the mark alone.
  const xlim = spec.Xlim_m.get();

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
  const cCell = spec.c_m_per_s.get();
  const rooCell = spec.roo_kg_per_m3.get();

  // `cell.value` is never null: an unstated coil count reads back as the driver's own
  // calculated default (`calcNumVC()`), not absence — the exporter asks the driver, it does
  // not decide this fact itself. WinISD's own New -> Save writes E here from a hardcoded store
  // in its blank-driver init; that claims a reading nobody supplied, and this is the one slot
  // where the writer parts company with it (SPEC_ENGINE.md "openisd writes C in the numVC
  // slot, not E").
  const numVC = spec.numVC.get();

  // THE FIXED 48-ROW STRUCTURE, each row written explicitly in WinISD's file order, plus Xlim's
  // slot-10 mark last. `.wdr` is a FIXED structure — no loops, no row-order list: the sequence
  // IS the order, and each row names the field, its `.wdr` key and whether WinISD derives it
  // (`calculable`).
  const wdrCells: Array<readonly [string, WdrCell]> = [
    wdrRow(errors, spec.Qts, true, "Qts"),
    wdrRow(errors, spec.Znom_ohm, true, "Znom_ohm"),
    wdrRow(errors, spec.Fs_hz, true, "Fs_hz"),
    wdrRow(errors, spec.Pe_W, true, "Pe_W"),
    wdrRow(errors, spec.SPL_dB, true, "SPL_dB"),
    wdrRow(errors, spec.Re_ohm, true, "Re_ohm"),
    wdrRow(errors, spec.Le_H, false, "Le_H"),
    wdrRow(errors, spec.fLe_hz, false, "fLe_hz"),
    wdrRow(errors, spec.KLe_H_sqrtHz, true, "KLe_H_sqrtHz"),
    wdrRow(errors, spec.BL_Tm, true, "BL_Tm"),
    wdrRow(errors, spec.Xmax_m, false, "Xmax_m"),
    wdrRow(errors, spec.Cms_m_per_N, true, "Cms_m_per_N"),
    wdrRow(errors, spec.Qms, true, "Qms"),
    wdrRow(errors, spec.Qes, true, "Qes"),
    wdrRow(errors, spec.Rms_kg_per_s, true, "Rms_kg_per_s"),
    wdrRow(errors, spec.Mms_kg, true, "Mms_kg"),
    wdrRow(errors, spec.Sd_m2, false, "Sd_m2"),
    wdrRow(errors, spec.Vas_m3, true, "Vas_m3"),
    wdrRow(errors, spec.Dia_m, true, "Dia_m"),
    wdrRow(errors, spec.Vd_m3, true, "Vd_m3"),
    wdrRow(errors, spec.no, true, "no"),
    wdrRow(errors, spec.Dd_m, true, "Dd_m"),
    wdrRow(errors, spec.EBP_hz, true, "EBP_hz"),
    [
      "numVC",
      {
        value: String(numVC.value),
        state: numVC.state === "entered" ? "entered" : "calculated",
      },
    ],
    wdrRow(errors, spec.Hc_m, true, "Hc_m"),
    wdrRow(errors, spec.Hg_m, true, "Hg_m"),
    wdrRow(errors, spec.SPLmax_dB, true, "SPLmax_dB"),
    wdrRow(errors, spec.SPLmaxLF_dB, true, "SPLmaxLF_dB"),
    wdrRow(errors, spec.USPL_dB, true, "USPL_dB"),
    wdrRow(errors, spec.alfaVC_per_K, false, "alfaVC_per_K"),
    wdrRow(errors, spec.Rt_K_per_W, false, "Rt_K_per_W"),
    wdrRow(errors, spec.Ct_J_per_K, false, "Ct_J_per_K"),
    wdrRow(errors, spec.gamma_m_per_s2_A, true, "gamma_m_per_s2_A"),
    wdrRow(errors, spec.Rme_kg_per_s, true, "Rme_kg_per_s"),
    wdrRow(errors, spec.Mpow_N_per_sqrtW, true, "Mpow_N_per_sqrtW"),
    wdrRow(errors, spec.Mcost_kg_per_s, true, "Mcost_kg_per_s"),
    wdrRow(errors, spec.Gloss, true, "Gloss"),
    ["VCCon", wdrVCCon(spec)],
    [
      "c",
      {
        value: String(cCell.value),
        state: cCell.state === "entered" ? "entered" : "calculated",
      },
    ],
    [
      "roo",
      {
        value: String(rooCell.value),
        state: rooCell.state === "entered" ? "entered" : "calculated",
      },
    ],
    wdrRow(errors, spec.Thick_m, false, "Thick_m"),
    wdrRow(errors, spec.Depth_m, true, "Depth_m"),
    wdrRow(errors, spec.MagDepth_m, true, "MagDepth_m"),
    wdrRow(errors, spec.Magnet_m, true, "Magnet_m"),
    wdrRow(errors, spec.Basket_m, false, "Basket_m"),
    wdrRow(errors, spec.Outer_m, false, "Outer_m"),
    wdrRow(errors, spec.Vcd_m, false, "Vcd_m"),
    wdrRow(errors, spec.DVol_m3, true, "DVol_m3"),
    // Xlim crosses as its slot-10 mark and nothing else — its own state (a cell with no value
    // reads `not-available`), never a value.
    ["Xlim", { value: "", state: xlim.state }],
  ];

  // `driver.section` is the OID record's real type discriminator (`sectionOf()` in
  // `project.ts`), so it is what must survive the round trip — not a separate `driver_type`
  // string. A driver-only `.wdr` has no field for it (bugs/
  // BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md), so it
  // rides in `Comment=` the same way as `[DQ]` and `[ENV]`. `woofer` is the read side's own
  // fallback, so a woofer record needs no tag and `Comment=` stays byte-identical to a plain
  // writer (ARCHITECTURE.md §3) — only a non-default type is worth spending a tag on.
  const driverType = driver.section === "woofer" ? undefined : driver.section;
  return WinISDDriver.build(header, wdrCells, dqLines, undefined, driverType);
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
  driverYmlText: string
): DriverYmlProjection {
  const openisdJson = driverYmlToOpenisdRecord(driverYmlText);
  if (!isRecord(openisdJson)) {
    return { openisd: null, wdr: null, errors: [openisdJson] };
  }

  const engine = new Engine();

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
        openisd: stringify(radiatorOrErrors.toOpenIsdDeviceJson()),
        wdr: null,
        errors: [],
      };
    }

    const errors: DriverError[] = [];
    // dedupe
    for (const problem of new Set([...driverOrErrors, ...radiatorOrErrors])) {
      errors.push({ level: "error", field: "record", message: problem });
    }
    return { openisd: stringify(openisdJson), wdr: null, errors };
  }

  // ONE `dq_calculated` PRODUCER (John, 2026-09-20): what the pipeline writes is what the app
  // exports for this record — the app's loader has already resolved it and marked every
  // finding. So the record on disk carries the marks the app would write, and the bundler's
  // round-trip gate (`scripts/roundTripGate.mjs`) passes it by construction.
  const exported = driverOrErrors.toOpenIsdDeviceJson();
  const openisd = stringify(exported);

  const errors: DriverError[] = [];
  // The `.wdr` comment carries the SAME marks the openisd.yml does — the app's, not the parsed
  // driver.yml's — so the two derived files never disagree about a record's quality.
  const wdrDriver = openIsdDriverToWinIsdDriver(
    driverOrErrors,
    errors,
    dqCommentLines(exported)
  );

  const wdr = wdrDriver.toWdrIni();
  errors.push(...roundTripProblems(openisd, wdr, engine));
  return { openisd, wdr, errors };
}
