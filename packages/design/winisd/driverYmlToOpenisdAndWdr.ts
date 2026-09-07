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
 * (`drivers/sample/winisd/John-all-manu-populated.wdr`: `Vas=0.141584099539285`,
 * `Sd=0.00177545544983551`). So this file converts no units, and a unit conversion appearing here
 * later would be a bug, not a missing feature.
 */
import {parse as parseYmlToJs, stringify} from 'yaml';

import type {FieldHandle, PassiveRadiatorSpec} from '@openisd/design';
import {conformingRecordToDriver, type OpenISDDriver, conformingRecordToPassiveRadiator,} from '@openisd/design';
import {type DriverError, Engine} from '@openisd/design/engine';

import {dqCalculated, withDqCalculated} from './dqCalculated.js';
import {INI_ROWS, WINISD_CALCULABLE, type WdrCell, type WdrHeader, WinISDDriver} from './winisdDriver.js';
import {type DriverSpec, wdrFields, winISDDriverToOpenISDDeviceJson} from '../domain/openisdRecordSchema.js';

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
const SCRAPER_ONLY_KEY = 'scraper_meta';

/** What a field MEANS. It belongs to `driver.yml` and to nothing downstream — John, 2026-09-01:
 *  "definition is 100% dead, it has no place in our openisd work except where I strip it in the
 *  bridge". A consumer of an openisd record already knows what `Fs` is.
 *
 *  It sits at EVERY depth of a record — on each metadata envelope, on each `sku.grounds` entry and
 *  on each spec entry — so removing it is a walk, not a top-level key filter like `scraper_meta`.
 *  Stripping it HERE, before the record is checked, is what lets `OpenISDDeviceJson` refuse it
 *  outright: that type states the shape of an OPENISD record, and `definition` is not part of one. */
const DEAD_KEY = 'definition';

/** The same value with every `definition` removed, at any depth. Rebuilt rather than deleted from,
 *  for the reason `stripDefinitionField` gives: the parsed object is the round-trip's reference and
 *  must not be mutated by the thing it is checking. */
function stripDefinitionField(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDefinitionField);
    if (value === null || typeof value !== 'object') return value;
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
const METADATA_FIELDS_WITH_DEAD_ORIGIN = new Set([
    'manufacturer', 'brand', 'model', 'driver_type', 'series', 'nominal_size_cm',
    'product_image', 'description', 'surround_material', 'provided_by', 'comment', 'added',
]);

/** The record with `origin` dropped from each named metadata field's own envelope — never from
 *  `specs`, `curves`, or `sku.grounds`, which keep it. */
function stripMetadataOrigin(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
        if (!METADATA_FIELDS_WITH_DEAD_ORIGIN.has(key) || typeof value !== 'object' || value === null) {
            out[key] = value;
            continue;
        }
        const field: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === 'origin') continue;
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
function stripRejectedReadings(specs: unknown): unknown {
    if (specs === null || typeof specs !== 'object') return specs;
    const sections: Record<string, unknown> = {};
    for (const [sectionKey, section] of Object.entries(specs)) {
        if (typeof section !== 'object' || section === null) {
            sections[sectionKey] = section;
            continue;
        }
        const fields: Record<string, unknown> = {};
        for (const [field, entry] of Object.entries(section)) {
            if (typeof entry !== 'object' || entry === null || !('readings' in entry)) {
                fields[field] = entry;
                continue;
            }
            // Permitted by human intent (John, 2026-09-05): this function runs on the raw YAML
            // parse, before conformingRecordToDriver validates it into an OpenISDDeviceJson —
            // there is no typed object yet for this cast to bypass.
            const e = entry as Record<string, unknown>;
            const readings = e.readings as Record<string, unknown>;
            const keptReadings = Object.fromEntries(
                Object.entries(readings).filter(([, reading]) =>
                    typeof reading !== 'object' || reading === null || !('rejected' in reading)));
            fields[field] = { ...e, readings: keptReadings };
        }
        sections[sectionKey] = fields;
    }
    return sections;
}

/** `.wdr` provenance marks, from the domain's own three-state provenance. WinISD's format has
 *  exactly these three, so the mapping is total and needs no fallback. */

/**
 * `driver.yml`'s keys, in the file's own order, minus the scraper section.
 *
 * Rebuilt as a fresh object rather than `delete`d from the parsed one: the parsed object is the
 * round-trip's reference (step 4 below) and must not be mutated by the thing it is checking.
 */
function stripScraperOnlyFieldsFromJavascriptObject(driverYml: object): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(driverYml)) {
        if (key === SCRAPER_ONLY_KEY) continue;
        out[key] = key === 'specs'
            ? stripRejectedReadings(stripDefinitionField(value))
            : stripDefinitionField(value);
    }
    return stripMetadataOrigin(out);
}

/** A RADIATOR's stated values, keyed the way its record keys them.
 *
 *  Its own list rather than `wdrFields`': a radiator has no motor and no voice coil, so
 *  `PassiveRadiatorSpec` is a different type with a different field set (John, 2026-08-27:
 *  "different schema"). Naming the pairs here makes a renamed field a build error, exactly as
 *  `wdrFields` does for a driver.
 */
function radiatorStatedValues(spec: PassiveRadiatorSpec): Array<readonly [string, number]> {
    const pairs: ReadonlyArray<readonly [string, FieldHandle<number>]> = [
        ['Fs', spec.Fs_hz], ['Qms', spec.Qms], ['Cms', spec.Cms_m_per_N], ['Mms', spec.Mms_kg],
        ['Rms', spec.Rms_kg_per_s], ['Sd', spec.Sd_m2], ['Vas', spec.Vas_m3], ['Vd', spec.Vd_m3],
        ['Xmax', spec.Xmax_m], ['Xlim', spec.Xlim_m], ['Dia', spec.Dia_m], ['Dd', spec.Dd_m],
        ['DVol', spec.DVol_m3], ['Thick', spec.Thick_m], ['Depth', spec.Depth_m],
        ['Basket', spec.Basket_m], ['Outer', spec.Outer_m], ['OuterX', spec.OuterX_m],
        ['OuterY', spec.OuterY_m], ['weight_kg', spec.weight_kg],
    ];
    const stated: Array<readonly [string, number]> = [];
    for (const [key, field] of pairs) {
        const cell = field.get();
        if (cell.state === 'entered' && cell.value != null && isFinite(cell.value)) {
            stated.push([key, cell.value]);
        }
    }
    return stated;
}

/**
 * Every spec value the RECORD ITSELF states, paired with the record's own key for it — what the
 * range half of `dq_calculated` is asked about.
 *
 * ENTERED ONLY. A calculated cell holds a number the engine derived from other cells, so a range
 * mark on it would report the derivation rather than the record, and the field it belongs to may
 * not even have a spec entry for the mark to land on. The disagreement that produced the odd
 * derived value is what `checkConsistency()` reports, on the fields that actually caused it.
 *
 * Reuses `wdrFields`'s pairing rather than declaring a second one: those record keys are the same
 * keys `openisd.yml` states, so a field renamed there is a build error in one place.
 */
function statedValues(spec: DriverSpec): Array<readonly [string, number]> {
    const stated: Array<readonly [string, number]> = [];
    for (const [key, field] of wdrFields(spec)) {
        const cell = field.get();
        if (cell.state === 'entered' && cell.value != null && isFinite(cell.value)) {
            stated.push([key, cell.value]);
        }
    }
    return stated;
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
    if (typeof specs !== 'object' || specs === null) return lines;

    for (const section of Object.values(specs)) {
        if (typeof section !== 'object' || section === null) continue;
        for (const [field, entry] of Object.entries(section)) {
            if (typeof entry !== 'object' || entry === null) continue;
            const e = entry as {
                origin?: string;
                readings?: Record<string, { read_value?: unknown }>;
                dq_scraper?: { detail?: string }[];
                dq_calculated?: { detail?: string }[];
            };
            const value = e.origin != null ? e.readings?.[e.origin]?.read_value : undefined;
            for (const mark of [...(e.dq_scraper ?? []), ...(e.dq_calculated ?? [])]) {
                lines.push(`[DQ] ${field}=${String(value)}: ${mark.detail ?? ''}`);
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
        'brand', 'model', 'manufacturer', 'providedBy', 'comment', 'dateAdded',
    ];
    for (const field of HEADER_FIELDS) {
        const av = a.headerField(field) ?? '';
        const bv = b.headerField(field) ?? '';
        if (av !== bv) diffs.push(`header.${field}: ${JSON.stringify(av)} vs ${JSON.stringify(bv)}`);
    }
    for (const key of [...INI_ROWS, 'Xlim']) {
        const ca = a.cell(key);
        const cb = b.cell(key);
        if (ca.value !== cb.value) {
            diffs.push(`${key}: value ${JSON.stringify(ca.value)} vs ${JSON.stringify(cb.value)}`);
        }
        if (key === 'VCCon' || key === 'Xlim') continue; // the two documented exceptions above
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
function roundTripProblems(openisd: string, wdr: string | null, engine: Engine): DriverError[] {
    const found: DriverError[] = [];

    // openisd.yml: text -> record -> text. The record is what a reader gets; the text is what we
    // wrote. If re-serialising the reader's record does not reproduce our text, one of the two is
    // losing something.
    try {
        if (stringify(parseYmlToJs(openisd)) !== openisd) {
            found.push({
                level: 'error', field: 'yml-round-trip',
                message: 'the openisd.yml we wrote does not survive being read back and rewritten',
            });
        }
    } catch (err) {
        found.push({
            level: 'error', field: 'yml-round-trip',
            message: 'the openisd.yml we wrote cannot be parsed back: '
                + (err instanceof Error ? err.message : String(err)),
        });
    }

    // .wdr: text -> WinISDDriver -> text. Same question of the INI writer and its reader.
    if (wdr !== null) {
        let w2: WinISDDriver | undefined;
        try {
            w2 = WinISDDriver.fromWdrIni(wdr);
            if (w2.toWdrIni() !== wdr) {
                found.push({
                    level: 'error', field: 'wdr-round-trip',
                    message: 'the .wdr we wrote does not survive being read back and rewritten',
                });
            }
        } catch (err) {
            found.push({
                level: 'error', field: 'wdr-round-trip',
                message: 'the .wdr we wrote cannot be read back: '
                    + (err instanceof Error ? err.message : String(err)),
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
                const {record: i3} = winISDDriverToOpenISDDeviceJson(w2);
                const driver3 = conformingRecordToDriver(i3, engine);
                if (Array.isArray(driver3)) {
                    found.push({
                        level: 'error', field: 'wdr-record-round-trip',
                        message: 'the .wdr we wrote reads back as a record the driver seam refuses: '
                            + driver3.join('; '),
                    });
                } else {
                    const w3 = openIsdDriverToWinIsdDriver(driver3, engine, []);
                    for (const diff of wdrDriverDiffs(w2, w3)) {
                        found.push({level: 'error', field: 'wdr-record-round-trip', message: diff});
                    }
                }
            } catch (err) {
                found.push({
                    level: 'error', field: 'wdr-record-round-trip',
                    message: 'the .wdr -> record -> .wdr chain threw: '
                        + (err instanceof Error ? err.message : String(err)),
                });
            }
        }
    }
    return found;
}

/** A parsed YAML document that is a mapping, as opposed to a scalar, a sequence or null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
function driverYmlToOpenisdRecord(driverYmlText: string): Record<string, unknown> | DriverError {
    let javascriptThing: unknown;
    try {
        javascriptThing = parseYmlToJs(driverYmlText);
    } catch (err) {
        return {
            level: 'error', field: 'driver.yml',
            message: 'could not parse as YAML: ' + (err instanceof Error ? err.message : String(err)),
        };
    }

    if (!isRecord(javascriptThing)) {
        return {
            level: 'error', field: 'driver.yml',
            message: 'parsed to ' + (javascriptThing === null ? 'null' : typeof javascriptThing)
                + ', not a record',
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
        value: cell.value === 'series' ? '2' : '1',
        state: cell.state === 'entered' ? 'entered' : 'not-available',
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
export function openIsdDriverToWinIsdDriver(
    driver: OpenISDDriver,
    engine: Engine,
    errors: DriverError[],
    dqLines: readonly string[] = [],
): WinISDDriver {
    const header: WdrHeader = {
        brand: driver.brand.get().value ?? '',
        model: driver.model.get().value ?? '',
        manufacturer: driver.manufacturer.get().value ?? '',
        providedBy: driver.providedBy.get().value ?? '',
        comment: driver.comment.get().value ?? '',
        dateAdded: driver.added.get().value ?? '',
    };

    const cells = new Map<string, WdrCell>();
    cells.set('VCCon', wdrVCCon(driver.spec[driver.section]));

    // XLIM CROSSES AS A MARK AND NOTHING ELSE. WinISD's writer has no `Xlim=` key — it holds the
    // field in its editor, gives it ParState slot 10, and discards the value on save
    // (`XLIM_PARSTATE_SLOT`). So the cell exists to carry its STATE into the row; `toWdrIni`
    // writes no line for it, and a record stating an Xlim is the difference between slot 10
    // reading `E` and reading `N`.
    const xlim = driver.spec[driver.section].Xlim_m.get();
    if (xlim.value != null) cells.set('Xlim', {value: String(xlim.value), state: xlim.state});

    // THE AIR THE FIGURES ASSUME. `c` and `roo` are the only two `.wdr` keys WinISD itself never
    // leaves at zero: its own New → Save writes 343.684120962152 and 1.20095217714682, marked
    // COMPUTED (`drivers/sample/winisd/john-all-defaults.wdr`). A driver that states neither is
    // not a driver measured in a vacuum — it is one measured in ordinary air — so writing 0 would
    // publish a claim no record makes and no physics allows.
    //
    // Read from the driver's own getter, which already reports the live air model at reference
    // conditions when unstated — the exporter asks the driver, it does not decide this fact
    // itself. A record stating its own `c`/`roo` reads back `entered` from the same getter.
    const c = driver.spec[driver.section].c_m_per_s.get();
    const roo = driver.spec[driver.section].roo_kg_per_m3.get();
    cells.set('c', {value: String(c.value), state: c.state === 'entered' ? 'entered' : 'calculated'});
    cells.set('roo', {value: String(roo.value), state: roo.state === 'entered' ? 'entered' : 'calculated'});

    // `cell.value` is never null: an unstated coil count reads back as the driver's own
    // calculated default (`calcNumVC()`), not absence — the exporter asks the driver, it does
    // not decide this fact itself. WinISD's own New -> Save writes E here from a hardcoded store
    // in its blank-driver init; that claims a reading nobody supplied, and this is the one slot
    // where the writer parts company with it (SPEC_ENGINE.md "openisd writes C in the numVC
    // slot, not E").
    const numVC = driver.spec[driver.section].numVC.get();
    cells.set('numVC', {
        value: String(numVC.value),
        state: numVC.state === 'entered' ? 'entered' : 'calculated',
    });

    for (const [key, field] of wdrFields(driver.spec[driver.section])) {
        const cell = field.get();
        if (cell.value == null) continue;

        if (!isFinite(cell.value)) {
            errors.push({
                level: 'warn', field: key,
                message: `${key}: value is not finite — field dropped, WinISD's own default applies`
            });
            continue;
        }
        // An ENTERED zero is written through as an entered zero, and flagged. A scraper that
        // failed to read a number frequently yields 0, and 0 is a legitimate value for several of
        // these fields, so nothing downstream can tell the two apart from the file alone. Corpus
        // generation is the last point that still knows the value was *stated* rather than
        // defaulted.
        if (cell.state === 'entered' && cell.value === 0) {
            errors.push({
                level: 'warn', field: key,
                message: `${key}: entered value is 0 — written as an entered 0; verify this is real and ` +
                    `not a failed extraction`
            });
        }
        cells.set(key, {value: String(cell.value), state: cell.state});
    }

    // DERIVABLE FIELDS, MARKED C — `docs/design/WDR_LOGIC.md`'s middle rule:
    //
    //     entered   -> value, mark E
    //     derivable -> calculated value, mark C
    //     otherwise -> 0, mark N
    //
    // The solver takes what the driver states and returns a SUPERSET: everything it could work
    // out from those. A key the record already states is left alone — an entered value is a fact
    // and is never overwritten by a derivation of it.
    const solved = engine.solveConsistencyGroup(driver.fields());
    for (const [quantity, value] of Object.entries(solved)) {
        if (typeof value !== 'number' || !isFinite(value)) continue;
        // `Fs_hz` -> `Fs`, `Cms_m_per_N` -> `Cms`, `Qts` -> `Qts`. The unit suffix is the domain's
        // (`AGENTS.md`: "THE UNIT LIVES ON THE PUBLIC API"); the `.wdr` key is the bare name, and
        // a quantity whose bare name is not a `.wdr` key simply has no row to write.
        const key = quantity.split('_')[0];
        if (cells.has(key) || !INI_ROWS.includes(key)) continue;
        const mark = WINISD_CALCULABLE.includes(key) ? 'calculated' : 'entered';
        cells.set(key, {value: String(value), state: mark});
    }

    // `otherwise -> 0, mark N` (WDR_LOGIC.md, above): entered and derivable are both tried above,
    // in that order. Whatever the record neither states nor the engine can derive gets an
    // EXPLICIT not-available cell — `WinISDDriver.build()` requires a decision for every one of
    // the 48 keys, and "no value" is a decision, not an omission.
    for (const key of INI_ROWS) {
        if (!cells.has(key)) cells.set(key, {value: '0', state: 'not-available'});
    }

    // `driver.section` is the OID record's real type discriminator (`sectionOf()` in
    // `project.ts`), so it is what must survive the round trip — not a separate `driver_type`
    // string. A driver-only `.wdr` has no field for it (bugs/
    // BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md), so it
    // rides in `Comment=` the same way as `[DQ]` and `[ENV]`. `woofer` is the read side's own
    // fallback, so a woofer record needs no tag and `Comment=` stays byte-identical to a plain
    // writer (ARCHITECTURE.md §3) — only a non-default type is worth spending a tag on.
    const driverType = driver.section === 'woofer' ? undefined : driver.section;
    return WinISDDriver.build(header, cells, dqLines, undefined, driverType);
}

/**
 * `driver.yml` text in; `openisd.yml` text, `.wdr` text and every problem out.
 * Never throws for bad INPUT: a record the caller could not have known was malformed comes back as
 * an `errors` entry, because the Python caller's whole job is "call this, check `errors`" and an
 * exception crossing the V8 boundary is not something it can read. A defect in THIS code is a
 * different matter and is left to throw.
 */
export function driverYmlToOpenisdAndWdr(driverYmlText: string): DriverYmlProjection {
    const openisdJson = driverYmlToOpenisdRecord(driverYmlText);
    if (!isRecord(openisdJson)) {
        return {openisd: null, wdr: null, errors: [openisdJson]};
    }

    const engine = new Engine();

    const driverOrErrors = conformingRecordToDriver(openisdJson, engine);
    if (Array.isArray(driverOrErrors)) {
        // its an array of errors not a driver
        const radiatorOrErrors = conformingRecordToPassiveRadiator(openisdJson, engine);
        if (!Array.isArray(radiatorOrErrors)) {
            // not an array so its the PR
            const radiatorMarks = dqCalculated(radiatorStatedValues(radiatorOrErrors.spec), []);
            return {
                openisd: stringify(withDqCalculated(openisdJson, radiatorOrErrors.section, radiatorMarks)),
                wdr: null,
                errors: [],
            };
        }

        const errors: DriverError[] = [];
        // dedupe
        for (const problem of new Set([...driverOrErrors, ...radiatorOrErrors])) {
            errors.push({level: 'error', field: 'record', message: problem});
        }
        return {openisd: stringify(openisdJson), wdr: null, errors};
    }

    const openisd = stringify(
        withDqCalculated(openisdJson, driverOrErrors.section,
            dqCalculated(statedValues(driverOrErrors.spec[driverOrErrors.section]), driverOrErrors.checkConsistency())));

    const errors: DriverError[] = [];
    const wdrDriver = openIsdDriverToWinIsdDriver(driverOrErrors, engine, errors, dqCommentLines(openisdJson));

    const wdr = wdrDriver.toWdrIni();
    errors.push(...roundTripProblems(openisd, wdr, engine));
    return {openisd, wdr, errors};
}

