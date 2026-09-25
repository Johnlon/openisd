/**
 * One WinISD `.wdr` driver file — the in/out object for the format, exactly as `WinISDProject`
 * is for `.wpr`. Build one from values, or read one from file text; either way you hold the
 * same thing and can ask it for its text or for any field it carries.
 *
 * A `.wdr` is INI text: a `[Driver]` header, seven free-text lines (Brand … DateModified),
 * 48 numeric `key=value` rows in a fixed order, and a 49-character `ParState` row marking each
 * field E (a person or datasheet stated it), C (WinISD computed it) or N (not in play).
 *
 * This class does no physics and no unit conversion. `build()` takes every field the caller
 * can answer for, keyed by WinISD's own spelling (`Fs`, `BL`, `Znom`, …) — the caller has
 * already computed the numbers. The 48-key order, WinISD's defaults, the ParState row and the
 * `[DQ]`-suffixed `Comment=` line all live here once, not once per producer — which is what
 * fixed `bugs/BUG_20260813_parstate-writer-emits-n-for-the-34-slots-the-driver-does-not-model.md`.
 *
 * Reading keeps only the 48 known keys, each becoming a cell with its ParState mark. A key
 * outside that set is discarded: `.wdr` has no extension mechanism, so a foreign key is
 * evidence of a corrupt or non-WinISD file, not a field to preserve.
 */
import {parseIni, stringifyIni} from '../ini/index.js';
import {markOf, parseParState} from './parstate.js';
import {WINISD_NEWLINE_SENTINEL} from './winisdBytes.js';
import type {CellState} from "./cellState.js";

/** One `.wdr` field: the text that will be written, and its provenance mark. */
export interface WdrCell {
    value: string;
    state: CellState;
}

/** Every `.wdr` field, in WinISD's OWN file order — the fixed 48-row structure, one entry per row
 *  (`Fs`, `BL`, `Znom`, …), never an internal field name, so no producer's naming choices leak
 *  into the format layer. Order is the file's order; serialization writes the array as it is. */
type WdrCells = ReadonlyArray<readonly [string, WdrCell]>;

/** The seven free-text header lines every `.wdr` carries, in file order. */
export interface WdrHeader {
    brand?: string;
    model?: string;
    manufacturer?: string;
    providedBy?: string;
    comment?: string;
    dateAdded?: string;
    dateModified?: string;
}

/**
 * ParState slot 10 — Xlim's MARK, and the only trace of Xlim a `.wdr` carries.
 *
 * WinISD offers Xlim in its UI and then FAILS TO SAVE IT — a WinISD bug, not a design.
 * Probe evidence, two files differing in exactly one respect: `s-fs.wdr` (Fs typed in, saved)
 * writes `Fs=123` AND sets slot 1 to `E`; `s-xlim-123.wdr` (Xlim set to 123, saved) writes no
 * key whatsoever — every numeric line is still `0` — and sets ONLY slot 10 to `E`. Its own
 * comment records the observation: "xlim set to 123 in UI but not written".
 *
 * We reproduce the bug rather than route around it. `.wdr` has no extension mechanism, so an
 * `Xlim=` line is a key WinISD cannot read: it is dropped the moment WinISD saves over the
 * file, while slot 10 goes on claiming a value was entered — and it breaks the byte
 * comparison against WinISD's own output that everything downstream is checked by.
 * `openisd.yml` is where Xlim's value lives, and it is not lossy.
 */
const XLIM_PARSTATE_SLOT = 10;

/**
 * The value WinISD writes for a key nothing has set — read off the oracle
 * `drivers/mysamples/winisd/john-all-defaults.wdr` (driver editor → New → Save, nothing typed).
 *
 * ALMOST every key defaults to `0`, and the three that do not are the point of this table:
 * `numVC` and `VCCon` default to `1`, because a driver has at least one voice coil and a single
 * coil has no wiring to state. A blanket `0` filler wrote `numVC=0` into every generated file —
 * not a WinISD quirk to copy but a nonsense value, since no driver has zero coils.
 *
 * `c` and `roo` are absent here on purpose: they are COMPUTED from the air model, never defaulted
 * (`engine/air.ts`), so a stated default would freeze a number the app derives.
 */
const WDR_DEFAULT: Readonly<Record<string, string>> = Object.freeze({numVC: '1', VCCon: '1'});

/** What `key=` reads when no cell supplies a value. */
function wdrDefault(key: string): string {
    return WDR_DEFAULT[key] ?? '0';
}

/** One `.wdr` row, read from the file's raw section and ParState mark. A row the file omits is
 *  `0`/N (absent, not a value); a row present without a ParState line is E (the scraper-authored
 *  shape, where presence itself means entered).
 *
 *  `slot` is the row's position in the 49-mark ParState row — named at every call site, so no
 *  key-to-slot table exists to drift from the format. */
function readWdrRow(
    raw: Record<string, string>,
    marks: readonly CellState[] | null,
    wdrKey: string,
    slot: number,
): readonly [string, WdrCell] {
    if (!(wdrKey in raw)) return [wdrKey, {value: '', state: 'not-available'}];
    const state: CellState = marks ? marks[slot] : 'entered';
    return [wdrKey, {value: raw[wdrKey], state}];
}


/** `Comment=` with `[DQ]` lines appended, one per mark, after any existing text. A record
 *  with no marks leaves the text byte-identical (ARCHITECTURE.md §3). */
function commentWithDq(base: string, dqLines: readonly string[]): string {
    if (dqLines.length === 0) return base;
    return [base, ...dqLines].filter(l => l.length > 0).join('\n');
}

/** The environment `c`/`roo` were computed under, for a driver-only `.wdr` (no `[Box]` section,
 *  so no other field can carry it). Real WinISD never writes or reads this — see
 *  `bugs/BUG_20260907_wdr_c_roo_environment_not_recoverable_on_round_trip.md`. */
export interface WdrEnv {
    tempK: number;
    pressurePa: number;
    humidityPct: number;
}

const ENV_TAG = /\[ENV T=([^ \]]+) p=([^ \]]+) RH=([^\]]+)\]/;

/** `Comment=` with an `[ENV ...]` line appended, same shape as `commentWithDq`. Absent `env`,
 *  or `base` already carrying the tag (a file read with one and written back unchanged), leaves
 *  the text byte-identical. */
function commentWithEnv(base: string, env: WdrEnv | undefined): string {
    if (env === undefined || ENV_TAG.test(base)) return base;
    const tag = `[ENV T=${env.tempK} p=${env.pressurePa} RH=${env.humidityPct}]`;
    return [base, tag].filter(l => l.length > 0).join('\n');
}

/** `[ENV ...]` parsed out of a `Comment=` value, or `undefined` if the value carries none. */
function envFromComment(comment: string | undefined): WdrEnv | undefined {
    if (comment === undefined) return undefined;
    const m = ENV_TAG.exec(comment);
    if (!m) return undefined;
    return { tempK: Number(m[1]), pressurePa: Number(m[2]), humidityPct: Number(m[3]) };
}

/** The OID `driver_type` a driver-only `.wdr` has no field for — see
 *  `bugs/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`.
 *  Real WinISD never writes or reads this tag. */
const DRIVERTYPE_TAG = /\[DRIVERTYPE ([^\]]+)\]/;

/** `Comment=` with a `[DRIVERTYPE ...]` line appended, same shape as `commentWithEnv`. Absent
 *  `driverType`, or `base` already carrying the tag, leaves the text byte-identical. */
function commentWithDriverType(base: string, driverType: string | undefined): string {
    if (driverType === undefined || DRIVERTYPE_TAG.test(base)) return base;
    const tag = `[DRIVERTYPE ${driverType}]`;
    return [base, tag].filter(l => l.length > 0).join('\n');
}

/** `[DRIVERTYPE ...]` parsed out of a `Comment=` value, or `undefined` if the value carries
 *  none. */
function driverTypeFromComment(comment: string | undefined): string | undefined {
    if (comment === undefined) return undefined;
    const m = DRIVERTYPE_TAG.exec(comment);
    return m ? m[1] : undefined;
}

/** A string field's value as one PHYSICAL line: every newline becomes the sentinel the format
 *  reserves for exactly this, so `Comment=` cannot break the line structure around it. */
function oneLine(value: string): string {
    return value.replace(/\r\n|\r|\n/g, WINISD_NEWLINE_SENTINEL);
}

export class WinISDDriver {
    readonly #header: WdrHeader;

    readonly #cells: WdrCells;

    readonly #dqLines: readonly string[];

    readonly #env: WdrEnv | undefined;

    readonly #driverType: string | undefined;

    private constructor(
        header: WdrHeader, cells: WdrCells, dqLines: readonly string[], env?: WdrEnv,
        driverType?: string,
    ) {
        this.#header = header;
        this.#cells = cells;
        this.#dqLines = dqLines;
        this.#env = env;
        this.#driverType = driverType;
    }

    /**
     * The fixed `.wdr` structure, as a caller built it: the 48 rows in file order plus Xlim's
     * slot-10 mark (last). There is no completeness check to run — the structure IS the order
     * and the contents; a caller that omitted a row built the wrong structure.
     */
    static build(
        header: WdrHeader,
        cells: WdrCells,
        dqLines: readonly string[] = [],
        env?: WdrEnv,
        driverType?: string,
    ): WinISDDriver {
        return new WinISDDriver(header, cells, dqLines, env, driverType);
    }

    // ── IMPORT — `.wdr` text → WinISDDriver, as read (no derivation) ─────────────────────

    /**
     * Parse a `.wdr`'s `[Driver]` section into a `WinISDDriver` holding exactly what the file
     * states — the raw text of every key, and its E/C/N mark taken directly from the source
     * ParState (or, for a file with none, presence ⇒ E, matching a scraper-authored file with
     * no ParState line). This performs NO derivation.
     */
    static fromWdrIni(text: string): WinISDDriver {
        // `parseIni` gives every `key=value` of the `[Driver]` section (the only section a `.wdr`
        // carries), split on the first `=`, VALUE verbatim — trimming it would destroy real
        // content in the free-text header fields (`s-xlim-123.wdr` carries `Comment=…written `
        // with a trailing space WinISD wrote and reads back); `Number(' 0 ')` is 0 so numeric
        // parsing is unaffected. `''` is where `parseIni` files any lines before the `[Driver]`
        // header, so a block passed without its header still reads.
        const parsed = parseIni(text);
        const section = parsed.Driver ?? parsed[''] ?? {};
        const raw: Record<string, string> = {};
        let parState: string | undefined;
        for (const [key, rawVal] of Object.entries(section)) {
            // A newline embedded in a string field arrives as WINISD_NEWLINE_SENTINEL (the file's
            // single 0xA4 byte, re-expanded by `winisdBytesToText`). Decoding it per value, after
            // the section is parsed, keeps a comment's newlines from being mistaken for line
            // structure while the file is being read.
            const val = rawVal.replaceAll(WINISD_NEWLINE_SENTINEL, '\n');
            if (key === 'ParState') {
                parState = val;
                continue;
            }
            raw[key] = val;
        }

        // A malformed ParState row is IGNORED, never a reason to refuse the file: the values are
        // in the `Key=` lines, ParState only records who authored each one, and real-world files
        // have been seen with a broken row (`s-xlim-123.wdr`). Unusable marks fall back to
        // presence ⇒ E, exactly like a file with no ParState line at all.
        const marks = parState === undefined ? null : parseParState(parState);

        // THE FIXED 48-ROW STRUCTURE, each row read explicitly in WinISD's file order, plus Xlim's
        // slot-10 mark last. `.wdr` is a FIXED structure — no loops, no row-order list: the
        // sequence IS the order, and each call names the row's `.wdr` key.
        const cells: WdrCells = [
            readWdrRow(raw, marks, 'Qts', 14),
            readWdrRow(raw, marks, 'Znom', 0),
            readWdrRow(raw, marks, 'Fs', 1),
            readWdrRow(raw, marks, 'Pe', 2),
            readWdrRow(raw, marks, 'SPL', 3),
            readWdrRow(raw, marks, 'Re', 4),
            readWdrRow(raw, marks, 'Le', 5),
            readWdrRow(raw, marks, 'fLe', 6),
            readWdrRow(raw, marks, 'KLe', 7),
            readWdrRow(raw, marks, 'BL', 8),
            readWdrRow(raw, marks, 'Xmax', 9),
            readWdrRow(raw, marks, 'Cms', 11),
            readWdrRow(raw, marks, 'Qms', 12),
            readWdrRow(raw, marks, 'Qes', 13),
            readWdrRow(raw, marks, 'Rms', 15),
            readWdrRow(raw, marks, 'Mms', 16),
            readWdrRow(raw, marks, 'Sd', 17),
            readWdrRow(raw, marks, 'Vas', 19),
            readWdrRow(raw, marks, 'Dia', 20),
            readWdrRow(raw, marks, 'Vd', 18),
            readWdrRow(raw, marks, 'no', 22),
            readWdrRow(raw, marks, 'Dd', 21),
            readWdrRow(raw, marks, 'EBP', 33),
            readWdrRow(raw, marks, 'numVC', 23),
            readWdrRow(raw, marks, 'Hc', 24),
            readWdrRow(raw, marks, 'Hg', 25),
            readWdrRow(raw, marks, 'SPLmax', 26),
            readWdrRow(raw, marks, 'SPLmaxLF', 27),
            readWdrRow(raw, marks, 'USPL', 28),
            readWdrRow(raw, marks, 'alfaVC', 29),
            readWdrRow(raw, marks, 'Rt', 30),
            readWdrRow(raw, marks, 'Ct', 31),
            readWdrRow(raw, marks, 'gamma', 32),
            readWdrRow(raw, marks, 'Rme', 34),
            readWdrRow(raw, marks, 'Mpow', 35),
            readWdrRow(raw, marks, 'Mcost', 36),
            readWdrRow(raw, marks, 'Gloss', 37),
            readWdrRow(raw, marks, 'VCCon', 46),
            readWdrRow(raw, marks, 'c', 47),
            readWdrRow(raw, marks, 'roo', 48),
            readWdrRow(raw, marks, 'Thick', 38),
            readWdrRow(raw, marks, 'Depth', 39),
            readWdrRow(raw, marks, 'MagDepth', 40),
            readWdrRow(raw, marks, 'Magnet', 41),
            readWdrRow(raw, marks, 'Basket', 42),
            readWdrRow(raw, marks, 'Outer', 43),
            readWdrRow(raw, marks, 'Vcd', 44),
            readWdrRow(raw, marks, 'DVol', 45),
            // Xlim occupies ParState slot 10 but has no key, so the rows never reach it. The mark
            // still has to survive: writing `N` where the file said `E` is a positive claim
            // ("not in play") that the source contradicts. There is no value to read.
            ['Xlim', {
                value: '',
                state: marks && marks[XLIM_PARSTATE_SLOT] !== 'not-available'
                    ? marks[XLIM_PARSTATE_SLOT]
                    : 'not-available',
            }],
        ];

        const header: WdrHeader = {
            brand: raw.Brand, model: raw.Model, manufacturer: raw.Manufacturer,
            providedBy: raw.ProvidedBy, comment: raw.Comment, dateAdded: raw.DateAdded,
            dateModified: raw.DateModified,
        };

        // A key the file states that is neither a `.wdr` row nor a header line is discarded
        // (John, 2026-09-02): `.wdr` has no extension mechanism, so a foreign key is a corrupt or
        // non-WinISD file, not a field to preserve.
        return new WinISDDriver(
            header, cells, [], envFromComment(header.comment), driverTypeFromComment(header.comment),
        );
    }

    // ── Serialise ──────────────────────────────────────────────────────────────────────

    /** Render as `.wdr` text: the seven header lines, the 48 tracked keys in WinISD's own
     *  order, the 49-slot ParState built from every cell's own state, and `[DQ]` lines appended
     *  to `Comment=`. `build()` always supplies every key (it throws otherwise), so the only way
     *  a key here has no cell is a `.wdr` read by `fromWdrIni()` that omitted it — filled with
     *  WinISD's own default for that key, and its ParState slot reads `N`. */
    toWdrIni(): string {
        const h = this.#header;
        // One `[Driver]` section, keys in WinISD's own file order: the seven free-text header
        // lines, then the 48 tracked keys, then ParState. Insertion order into this object IS
        // the written order — `stringifyIni` iterates it as given and emits CRLF throughout with
        // a single trailing CRLF, which is the exact shape every `.wdr` WinISD writes has (LF
        // would differ on every line and defeat the byte comparison against a WinISD oracle).
        const driver: Record<string, string> = {
            Brand: oneLine(h.brand ?? ''),
            Model: oneLine(h.model ?? ''),
            Manufacturer: oneLine(h.manufacturer ?? ''),
            ProvidedBy: oneLine(h.providedBy ?? ''),
            Comment: oneLine(commentWithDriverType(
                commentWithEnv(commentWithDq(h.comment ?? '', this.#dqLines), this.#env),
                this.#driverType,
            )),
            DateAdded: oneLine(h.dateAdded ?? ''),
            DateModified: oneLine(h.dateModified ?? ''),
        };
        for (const [key, cell] of this.#cells) {
            // No `Xlim=` line: WinISD writes none (XLIM_PARSTATE_SLOT) — its mark rides slot 10.
            if (key === 'Xlim') continue;
            driver[key] = cell.value ?? wdrDefault(key);
        }
        // No `Xlim=` line: WinISD writes none, and `.wdr` has no extension mechanism to add one
        // (XLIM_PARSTATE_SLOT). Xlim crosses as its slot-10 mark and nothing else.
        driver.ParState = this.#parState();
        return stringifyIni({Driver: driver});
    }

    /** The fixed structure as built: the 48 rows in file order, then Xlim's slot-10 mark. */
    rows(): ReadonlyArray<readonly [string, WdrCell]> {
        return this.#cells;
    }

    /** One field, by WinISD's own key spelling. Never throws — an unknown key reads N/absent.
     *  `Xlim` is the slot-10 mark carried as the structure's last entry. */
    cell(wdrKey: string): WdrCell {
        return this.#cells.find(([key]) => key === wdrKey)?.[1] ?? {value: '', state: 'not-available'};
    }

    /** One header field, by name. */
    headerField(field: keyof WdrHeader): string | undefined {
        return this.#header[field];
    }

    /** The `[ENV ...]` environment `c`/`roo` were computed under, if `Comment=` carries one. */
    env(): WdrEnv | undefined {
        return this.#env;
    }

    /** The OID `driver_type` this `.wdr` was written from, if `Comment=` carries a
     *  `[DRIVERTYPE ...]` tag. */
    driverType(): string | undefined {
        return this.#driverType;
    }

    #parState(): string {
        // THE FIXED 49-SLOT PARSTATE ROW, written explicitly in slot order — one mark per field,
        // THE FIXED 49-SLOT PARSTATE ROW, written explicitly in slot order — one mark per field,
        // in the position WinISD's own table defines. No key-to-slot lookups:
        // the sequence IS the order, and slot 10 is Xlim, a mark-only field with no `.wdr` key.
        return [
            markOf(this.cell('Znom').state),    // 0
            markOf(this.cell('Fs').state),      // 1
            markOf(this.cell('Pe').state),      // 2
            markOf(this.cell('SPL').state),     // 3
            markOf(this.cell('Re').state),      // 4
            markOf(this.cell('Le').state),      // 5
            markOf(this.cell('fLe').state),     // 6
            markOf(this.cell('KLe').state),     // 7
            markOf(this.cell('BL').state),      // 8
            markOf(this.cell('Xmax').state),    // 9
            markOf(this.cell('Xlim').state),    // 10 — Xlim, no `.wdr` key
            markOf(this.cell('Cms').state),     // 11
            markOf(this.cell('Qms').state),     // 12
            markOf(this.cell('Qes').state),     // 13
            markOf(this.cell('Qts').state),     // 14
            markOf(this.cell('Rms').state),     // 15
            markOf(this.cell('Mms').state),     // 16
            markOf(this.cell('Sd').state),      // 17
            markOf(this.cell('Vd').state),      // 18
            markOf(this.cell('Vas').state),     // 19
            markOf(this.cell('Dia').state),     // 20
            markOf(this.cell('Dd').state),      // 21
            markOf(this.cell('no').state),      // 22
            markOf(this.cell('numVC').state),   // 23
            markOf(this.cell('Hc').state),      // 24
            markOf(this.cell('Hg').state),      // 25
            markOf(this.cell('SPLmax').state),  // 26
            markOf(this.cell('SPLmaxLF').state), // 27
            markOf(this.cell('USPL').state),    // 28
            markOf(this.cell('alfaVC').state),  // 29
            markOf(this.cell('Rt').state),      // 30
            markOf(this.cell('Ct').state),      // 31
            markOf(this.cell('gamma').state),   // 32
            markOf(this.cell('EBP').state),     // 33
            markOf(this.cell('Rme').state),     // 34
            markOf(this.cell('Mpow').state),    // 35
            markOf(this.cell('Mcost').state),   // 36
            markOf(this.cell('Gloss').state),   // 37
            markOf(this.cell('Thick').state),   // 38
            markOf(this.cell('Depth').state),   // 39
            markOf(this.cell('MagDepth').state), // 40
            markOf(this.cell('Magnet').state),  // 41
            markOf(this.cell('Basket').state),  // 42
            markOf(this.cell('Outer').state),   // 43
            markOf(this.cell('Vcd').state),     // 44
            markOf(this.cell('DVol').state),    // 45
            markOf(this.cell('VCCon').state),   // 46
            markOf(this.cell('c').state),       // 47
            markOf(this.cell('roo').state),     // 48
        ].join('');
    }
}
