/**
 * `WinISDDriver` — the single class that knows the `.wdr` FILE FORMAT
 * (ARCHITECTURE.md §3 "`WinISDDriver` is solely a serialisation device"). It validates,
 * holds no live state, derives nothing itself, and names no other package. Callers reach IN;
 * this class never reaches out, and knows nothing of whatever domain model produced the values
 * it is handed.
 *
 * Two directions, both driven from OUTSIDE this class:
 *
 *  - EXPORT — a caller reads its own model's getters and feeds them to `build()`.
 *  - IMPORT — `fromWdrIni`. `.wdr` text populates a `WinISDDriver` with exactly what the file
 *    states — no derivation, no recompute.
 *
 * `build()` is the low-level constructor: any producer that already knows a field's WDR key,
 * value and E/C/N state (the classic `Driver` ADT included — see `driver.ts`) hands over a
 * `WdrCells` map and gets the format for free — the 48-key order and WinISD's own defaults,
 * the 49-slot ParState, and the `[DQ]`-suffixed `Comment=` line all live HERE ONCE, not once
 * per producer. That consolidation is what fixes
 * `bugs/BUG_20260813_parstate-writer-emits-n-for-the-34-slots-the-driver-does-not-model.md`:
 * every producer marks a slot from its OWN per-field state for every slot WinISD tracks, not
 * a hardcoded 15-field subset.
 */

import { PARSTATE_LEN, POS_TO_WDRKEY } from './parstate.js';
import { WINISD_NEWLINE_SENTINEL } from './winisdBytes.js';
import type { CellState } from './parstate.js';

/** One `.wdr` field: the text that will be written, and its provenance mark. */
export interface WdrCell {
  value: string;
  state: CellState;
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
export const INI_ROWS: ReadonlyArray<string> = ['Qts', 'Znom', 'Fs', 'Pe', 'SPL', 'Re', 'Le', 'fLe', 'KLe', 'BL', 'Xmax', 'Cms', 'Qms', 'Qes', 'Rms', 'Mms', 'Sd', 'Vas', 'Dia', 'Vd', 'no', 'Dd', 'EBP', 'numVC', 'Hc', 'Hg',
    'SPLmax', 'SPLmaxLF', 'USPL', 'alfaVC', 'Rt', 'Ct', 'gamma', 'Rme', 'Mpow', 'Mcost', 'Gloss', 'VCCon', 'c', 'roo', 'Thick', 'Depth', 'MagDepth', 'Magnet', 'Basket', 'Outer',
    'Vcd', 'DVol'];


/** `Comment=` with `[DQ]` lines appended, one per mark, after any existing text. A record
 *  with no marks leaves the text byte-identical (ARCHITECTURE.md §3). */
function commentWithDq(base: string, dqLines: readonly string[]): string {
  if (dqLines.length === 0) return base;
  return [base, ...dqLines].filter(l => l.length > 0).join('\n');
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

  private constructor(header: WdrHeader, cells: WdrCells, dqLines: readonly string[]) {
    this.#header = header;
    this.#cells = cells;
    this.#dqLines = dqLines;
    // The production caller of `build()` supplies every `INI_ROWS` key via its own fill-loop,
    // so a key missing here can only mean the caller and this class have drifted out of sync
    // about the .wdr key set — a real incompatibility bug (`wdr-model-coverage.test.ts`
    // asserts this list is always empty in practice), not a normal absent-field case (that is `state: 'N'`, a PRESENT cell with no
    // value). Computed at construction, not buried inside `toWdr()`, so it is visible the
    // instant a caller builds an incomplete `WinISDDriver`, whether or not `toWdr()` ever runs.
    this.#missingKeys = INI_ROWS.filter(key => !cells.has(key));
  }

  /**
   * Low-level constructor: hand over every `.wdr` key you can answer for, keyed by WinISD's
   * OWN spelling. A key you omit reads `{value: '', state: 'N'}` and gets its WinISD default.
   */
  static build(header: WdrHeader, cells: WdrCells, dqLines: readonly string[] = []): WinISDDriver {
    return new WinISDDriver(header, cells, dqLines);
  }

  // ── IMPORT — `.wdr` text → WinISDDriver, as read (no derivation) ─────────────────────

  /**
   * Parse a `.wdr`'s `[Driver]` section into a `WinISDDriver` holding exactly what the file
   * states — the raw text of every key, and its E/C/N mark taken directly from the source
   * ParState (or, for a file with none, presence ⇒ E, matching a scraper-authored file with
   * no ParState line). This performs NO derivation.
   */
  static fromWdrIni(text: string): WinISDDriver {
    const raw: Record<string, string> = {};
    let parState: string | undefined;
    for (const line of text.split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i < 0 || line[0] === '[') continue;
      const key = line.slice(0, i).trim();
      // The VALUE is taken verbatim. Trimming it destroys real content in the free-text
      // header fields — `s-xlim-123.wdr` carries `Comment=xlim set to 123 in UI but not
      // written ` with a trailing space WinISD wrote and reads back. Numeric parsing is
      // unaffected: `Number(' 0 ')` is 0.
      // A newline embedded in a string field arrives as WINISD_NEWLINE_SENTINEL (the file's
      // single 0xA4 byte, re-expanded by `winisdBytesToText`). Decoding it HERE — per value,
      // after the line split — is what keeps a comment's newlines from being mistaken for
      // line structure while the file is being parsed.
      const val = line.slice(i + 1).replaceAll(WINISD_NEWLINE_SENTINEL, '\n');
      if (key === 'ParState') { parState = val; continue; }
      raw[key] = val;
    }

    const cells = new Map<string, WdrCell>();
    for (const key of INI_ROWS) {
      if (!(key in raw)) continue;
      const pos = keyPos(key);
      const state: CellState = parState && pos != null && parState.length === PARSTATE_LEN
        ? (parState[pos] as CellState)
        : 'E';
      cells.set(key, { value: raw[key], state });
    }

    // Xlim occupies ParState slot 10 but has no key, so the loop above never reaches it. The
    // mark still has to survive: writing `N` where the file said `E` is a positive claim
    // ("not in play") that the source contradicts. There is no value to read.
    if (parState && parState.length === PARSTATE_LEN && parState[XLIM_PARSTATE_SLOT] !== 'N') {
      cells.set('Xlim', { value: '', state: parState[XLIM_PARSTATE_SLOT] as CellState });
    }

    const header: WdrHeader = {
      brand: raw.Brand, model: raw.Model, manufacturer: raw.Manufacturer,
      providedBy: raw.ProvidedBy, comment: raw.Comment, dateAdded: raw.DateAdded,
      dateModified: raw.DateModified,
    };
    return new WinISDDriver(header, cells, []);
  }

  // ── Serialise ──────────────────────────────────────────────────────────────────────

  /** Render as `.wdr` text: the seven header lines, the 48 tracked keys in WinISD's own
   *  order, the 49-slot ParState built from every cell's own state, and `[DQ]` lines appended
   *  to `Comment=`. A key with no cell at all (`missingKeys()`) is written as `0` — a FILLER
   *  so the row count stays right, not a WinISD default; its ParState slot reads `N`. */
  toWdr(): string {
    const h = this.#header;
    const lines: string[] = [
      '[Driver]',
      'Brand=' + oneLine(h.brand ?? ''),
      'Model=' + oneLine(h.model ?? ''),
      'Manufacturer=' + oneLine(h.manufacturer ?? ''),
      'ProvidedBy=' + oneLine(h.providedBy ?? ''),
      'Comment=' + oneLine(commentWithDq(h.comment ?? '', this.#dqLines)),
      'DateAdded=' + oneLine(h.dateAdded ?? ''),
      'DateModified=' + oneLine(h.dateModified ?? ''),
    ];
    for (const key of INI_ROWS) {
      // A key in `missingKeys()` still exports here rather than aborting the whole `.wdr`;
      // see `missingKeys()`'s own doc for why that drift is reported, not thrown. `0` is a
      // filler to keep the 48 rows intact — the slot is marked `N`, so nothing reads it.
      lines.push(`${key}=${this.#cells.get(key)?.value ?? '0'}`);
    }
    // No `Xlim=` line: WinISD writes none, and `.wdr` has no extension mechanism to add one
    // (XLIM_PARSTATE_SLOT). Xlim crosses as its slot-10 mark and nothing else.
    lines.push('ParState=' + this.#parState());
    lines.push('');
    // CRLF, because `.wdr` is a Windows INI and every file WinISD writes uses it. LF would
    // differ from WinISD's own output on every single line, which makes a byte comparison
    // against a WinISD-written oracle impossible — and that comparison is how the projection
    // in Plan 2 is checked. `fromWdrIni` already accepts either (`split(/\r?\n/)`).
    return lines.join('\r\n');
  }

  /** One field, by WinISD's own key spelling. Never throws — an unknown key reads N/absent. */
  cell(wdrKey: string): WdrCell {
    return this.#cells.get(wdrKey) ?? { value: '', state: 'N' };
  }

  /** One header field, by name. */
  headerField(field: keyof WdrHeader): string | undefined {
    return this.#header[field];
  }

  /** `.wdr` keys `build()` was never given a cell for at all — as opposed to a genuinely
   *  absent field (`state: 'N'`), which IS a cell. Empty in every real production path; a
   *  non-empty list is a key-set drift between this class and its caller, which the caller
   *  should surface, not silently swallow — `toWdr()` still exports (writing `0` for each), it does not throw. */
  missingKeys(): readonly string[] {
    return this.#missingKeys;
  }

  readonly #missingKeys: readonly string[];

  #parState(): string {
    const slots = new Array<string>(PARSTATE_LEN).fill('N');
    for (let pos = 0; pos < PARSTATE_LEN; pos++) {
      const key = POS_TO_WDRKEY[pos];
      if (key == null) continue;
      slots[pos] = this.#cells.get(key)?.state ?? 'N';
    }
    // Slot 10 has no entry in POS_TO_WDRKEY, so it is filled from Xlim's own cell — which
    // carries a mark and no value (XLIM_PARSTATE_SLOT).
    slots[XLIM_PARSTATE_SLOT] = this.#cells.get('Xlim')?.state ?? 'N';
    return slots.join('');
  }
}

/** WDR key → its ParState slot position, where one exists. `Dia` shares `Dd`'s slot (WinISD
 *  writes both keys but tracks one edit-state for the pair — `Driver=all-defaults.wdr`). */
function keyPos(wdrKey: string): number | null {
  const pos = POS_TO_WDRKEY.indexOf(wdrKey);
  return pos >= 0 ? pos : null;
}
