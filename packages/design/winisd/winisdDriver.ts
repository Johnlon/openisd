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
import {PARSTATE_LEN, POS_TO_WDRKEY, parseParState} from './parstate.js';
import {WINISD_NEWLINE_SENTINEL} from './winisdBytes.js';
import type {Provenance} from '../domain/cell.js';
import {markOf} from './parstate.js';

/** One `.wdr` field: the text that will be written, and its provenance mark. */
export interface WdrCell {
    value: string;
    state: Provenance;
}

/** Every `.wdr` field WinISDDriver knows about, keyed by WinISD's OWN spelling (`Fs`, `BL`,
 *  `Znom`, `Gloss`, …) — never an internal field name, so no producer's naming choices leak
 *  into the format layer. */
type WdrCells = ReadonlyMap<string, WdrCell>;

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
 * The 48 numeric/text `.wdr` keys in WinISD's OWN file order, each with the value WinISD
 * writes when nothing is set. Source of truth: `drivers/sample/winisd/john-all-defaults.wdr`
 * (New → Save, nothing typed).
 */
export const INI_ROWS_META = [
    {key: 'Qts', calculable: true},
    {key: 'Znom', calculable: true},
    {key: 'Fs', calculable: true},
    {key: 'Pe', calculable: true},
    {key: 'SPL', calculable: true},
    {key: 'Re', calculable: true},
    {key: 'Le', calculable: false},
    {key: 'fLe', calculable: false},
    {key: 'KLe', calculable: true},
    {key: 'BL', calculable: true},
    {key: 'Xmax', calculable: false},
    {key: 'Cms', calculable: true},
    {key: 'Qms', calculable: true},
    {key: 'Qes', calculable: true},
    {key: 'Rms', calculable: true},
    {key: 'Mms', calculable: true},
    // Deliberately `false`, unlike Dd (below) which derives it back: real WinISD never derives
    // either of Sd/Dd from the other (`drivers/sample/winisd/s-dd.wdr` states only Dd, leaves Sd
    // at N; `s-sd.wdr` states only Sd, leaves Dd at N) — openisd derives Sd from Dd anyway,
    // going beyond WinISD, and that derived value is written marked E, never C (John, 2026-09-05:
    // "use E for Sd when E or C in openisd"). Whether WinISD's own file loader trusts a C-marked
    // Sd on read was not probed; this is a recorded ruling, not a measured WinISD behavior.
    {key: 'Sd', calculable: false},
    {key: 'Vas', calculable: true},
    {key: 'Dia', calculable: true},
    {key: 'Vd', calculable: true},
    {key: 'no', calculable: true},
    {key: 'Dd', calculable: true},
    {key: 'EBP', calculable: true},
    {key: 'numVC', calculable: false},
    {key: 'Hc', calculable: true},
    {key: 'Hg', calculable: true},
    {key: 'SPLmax', calculable: true},
    {key: 'SPLmaxLF', calculable: true},
    {key: 'USPL', calculable: true},
    {key: 'alfaVC', calculable: false},
    {key: 'Rt', calculable: false},
    {key: 'Ct', calculable: false},
    {key: 'gamma', calculable: true},
    {key: 'Rme', calculable: true},
    {key: 'Mpow', calculable: true},
    {key: 'Mcost', calculable: true},
    {key: 'Gloss', calculable: true},
    {key: 'VCCon', calculable: false},
    {key: 'c', calculable: true},
    {key: 'roo', calculable: true},
    {key: 'Thick', calculable: false},
    {key: 'Depth', calculable: true},
    {key: 'MagDepth', calculable: true},
    {key: 'Magnet', calculable: true},
    {key: 'Basket', calculable: false},
    {key: 'Outer', calculable: false},
    {key: 'Vcd', calculable: false},
    {key: 'DVol', calculable: true},
] as const;

export const INI_ROWS: ReadonlyArray<string> = INI_ROWS_META.map(m => m.key);
export const WINISD_CALCULABLE: ReadonlyArray<string> = INI_ROWS_META.filter(m => m.calculable).map(m => m.key);


/**
 * The value WinISD writes for a key nothing has set — read off the oracle
 * `drivers/sample/winisd/john-all-defaults.wdr` (driver editor → New → Save, nothing typed).
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

    private constructor(
        header: WdrHeader, cells: WdrCells, dqLines: readonly string[], env?: WdrEnv,
    ) {
        this.#header = header;
        this.#cells = cells;
        this.#dqLines = dqLines;
        this.#env = env;
    }

    /**
     * Every `.wdr` key you can answer for, keyed by WinISD's OWN spelling. Throws if a key is
     * missing: the production caller supplies every `INI_ROWS` key via its own fill-loop, so a
     * missing one means the caller and this class have drifted out of sync about the .wdr key
     * set — a real incompatibility bug, not a normal absent-field case (that is
     * `state: 'not-available'`, a PRESENT cell with no value). Thrown here, at construction,
     * rather than reported and silently filled by `toWdrIni()` — the drift is a defect, not data.
     */
    static build(
        header: WdrHeader, cells: WdrCells, dqLines: readonly string[] = [], env?: WdrEnv,
    ): WinISDDriver {
        const missing = INI_ROWS.filter(key => !cells.has(key));
        if (missing.length > 0) {
            throw new Error(`WinISDDriver.build() is missing ${missing.length} of the 48 .wdr keys: `
                + `${missing.join(', ')} — the caller and WinISDDriver have drifted out of sync about `
                + 'the .wdr key set.');
        }
        return new WinISDDriver(header, cells, dqLines, env);
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

        // A row the file CARRIES must be well formed or the file is refused — `parseParState`
        // throws, naming the slot and field, because a mark read out of a broken row is a
        // fabricated claim about who authored a number (John, 2026-09-01). A file carrying NO
        // ParState line is the scraper-authored shape, and reads presence ⇒ E.
        const marks = parState === undefined ? null : parseParState(parState);

        const cells = new Map<string, WdrCell>();
        for (const key of INI_ROWS) {
            if (!(key in raw)) continue;
            const pos = keyPos(key);
            const state: Provenance = marks && pos != null ? marks[pos] : 'entered';
            cells.set(key, {value: raw[key], state});
        }

        // Xlim occupies ParState slot 10 but has no key, so the loop above never reaches it. The
        // mark still has to survive: writing `N` where the file said `E` is a positive claim
        // ("not in play") that the source contradicts. There is no value to read.
        if (marks && marks[XLIM_PARSTATE_SLOT] !== 'not-available') {
            cells.set('Xlim', {value: '', state: marks[XLIM_PARSTATE_SLOT]});
        }

        const header: WdrHeader = {
            brand: raw.Brand, model: raw.Model, manufacturer: raw.Manufacturer,
            providedBy: raw.ProvidedBy, comment: raw.Comment, dateAdded: raw.DateAdded,
            dateModified: raw.DateModified,
        };

        // A key the file states that is neither an `INI_ROWS` key nor a header line is discarded
        // (John, 2026-09-02): `.wdr` has no extension mechanism, so a foreign key is a corrupt or
        // non-WinISD file, not a field to preserve.
        return new WinISDDriver(header, cells, [], envFromComment(header.comment));
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
            Comment: oneLine(commentWithEnv(commentWithDq(h.comment ?? '', this.#dqLines), this.#env)),
            DateAdded: oneLine(h.dateAdded ?? ''),
            DateModified: oneLine(h.dateModified ?? ''),
        };
        for (const key of INI_ROWS) {
            driver[key] = this.#cells.get(key)?.value ?? wdrDefault(key);
        }
        // No `Xlim=` line: WinISD writes none, and `.wdr` has no extension mechanism to add one
        // (XLIM_PARSTATE_SLOT). Xlim crosses as its slot-10 mark and nothing else.
        driver.ParState = this.#parState();
        return stringifyIni({Driver: driver});
    }

    /** One field, by WinISD's own key spelling. Never throws — an unknown key reads N/absent. */
    cell(wdrKey: string): WdrCell {
        return this.#cells.get(wdrKey) ?? {value: '', state: 'not-available'};
    }

    /** One header field, by name. */
    headerField(field: keyof WdrHeader): string | undefined {
        return this.#header[field];
    }

    /** The `[ENV ...]` environment `c`/`roo` were computed under, if `Comment=` carries one. */
    env(): WdrEnv | undefined {
        return this.#env;
    }

    #parState(): string {
        const slots = new Array<string>(PARSTATE_LEN).fill(markOf('not-available'));
        for (let pos = 0; pos < PARSTATE_LEN; pos++) {
            const key = POS_TO_WDRKEY[pos];
            if (key == null) continue;
            slots[pos] = markOf(this.#cells.get(key)?.state ?? 'not-available');
        }
        // Slot 10 has no entry in POS_TO_WDRKEY, so it is filled from Xlim's own cell — which
        // carries a mark and no value (XLIM_PARSTATE_SLOT).
        slots[XLIM_PARSTATE_SLOT] = markOf(this.#cells.get('Xlim')?.state ?? 'not-available');
        return slots.join('');
    }
}

/** WDR key → its ParState slot position, where one exists. `Dia` shares `Dd`'s slot (WinISD
 *  writes both keys but tracks one edit-state for the pair — `Driver=all-defaults.wdr`). */
function keyPos(wdrKey: string): number | null {
    const pos = POS_TO_WDRKEY.indexOf(wdrKey);
    return pos >= 0 ? pos : null;
}
