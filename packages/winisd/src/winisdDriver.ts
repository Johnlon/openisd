/**
 * `WinISDDriver` — the single class that knows the `.wdr` FILE FORMAT
 * (ARCHITECTURE.md §3 "`WinISDDriver` is solely a serialisation device"). It validates,
 * holds no live state, and derives nothing itself, and it names no other package —
 * `@openisd/model`'s `OpenISDDriver` is the ONE place that reads/writes this class
 * (`.toWinISDDriver()`/`OpenISDDriver.fromWinISDDriver()`), keeping this package a pure
 * `.wdr` FILE FORMAT layer with no knowledge of the app's own driver model.
 *
 * Two directions, both driven from OUTSIDE this class:
 *
 *  - EXPORT — a caller reads `OpenISDDriver` getters and feeds them to `build()`.
 *  - IMPORT — `fromWdrIni`. `.wdr` text populates a `WinISDDriver` with exactly what the file
 *    states — no derivation, no recompute. `diffAgainst` compares those as-read values
 *    against a second, independently-derived `WinISDDriver`, surfacing a mismatch as a
 *    data-quality signal instead of silently overwriting.
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
import type { DriverError } from '@openisd/engine';
import { PARSTATE_LEN, POS_TO_WDRKEY } from './parstate.js';
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
 * `diffAgainst`'s default tolerance band — the same 1e-9 relative / 1e-12 absolute pair
 * `winisd-parity.test.ts` uses everywhere else in this codebase for two independent
 * implementations of one formula (that file's own `REL_TOL`/`ABS_TOL` comment gives the
 * five-order-wide band this sits in the middle of: float noise on one side, a real formula
 * difference on the other).
 */
const DIFF_REL_TOL = 1e-9;
const DIFF_ABS_FLOOR = 1e-12;

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

export class WinISDDriver {
  readonly #header: WdrHeader;
  readonly #cells: WdrCells;
  readonly #dqLines: readonly string[];
  readonly #missingKeys: readonly string[];

  private constructor(header: WdrHeader, cells: WdrCells, dqLines: readonly string[]) {
    this.#header = header;
    this.#cells = cells;
    this.#dqLines = dqLines;
    // `OpenISDDriver.toWinISDDriver()` (the ONE production caller of `build()`) always
    // supplies every `INI_ROWS` key via its own fill-loop, so a key missing here can only mean
    // `OpenISDDriver` and this class have drifted out of sync about the .wdr key set — a real
    // incompatibility bug (`wdr-model-coverage.test.ts` asserts this list is always empty in
    // practice), not a normal absent-field case (that is `state: 'N'`, a PRESENT cell with no
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

  /** `.wdr` keys `build()` was never given a cell for at all — as opposed to a genuinely
   *  absent field (`state: 'N'`), which IS a cell. Empty in every real production path; a
   *  non-empty list is a `WinISDDriver`/`OpenISDDriver` key-set drift a caller should surface,
   *  not silently swallow — `toWdr()` still exports (writing `0` for each), it does not throw. */
  missingKeys(): readonly string[] {
    return this.#missingKeys;
  }

  /** One field, by WinISD's own key spelling. Never throws — an unknown key reads N/absent. */
  cell(wdrKey: string): WdrCell {
    return this.#cells.get(wdrKey) ?? { value: '', state: 'N' };
  }

  /** One header field, by name. */
  headerField(field: keyof WdrHeader): string | undefined {
    return this.#header[field];
  }

  // ── IMPORT — `.wdr` text → WinISDDriver, as read (no derivation) ─────────────────────

  /**
   * Parse a `.wdr`'s `[Driver]` section into a `WinISDDriver` holding exactly what the file
   * states — the raw text of every key, and its E/C/N mark taken directly from the source
   * ParState (or, for a file with none, presence ⇒ E, matching a scraper-authored file with
   * no ParState line). This performs NO derivation — pairs with `diffAgainst` for that.
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
      const val = line.slice(i + 1);
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
   *  order (each cell's value, or its WinISD default when the cell is absent), the 49-slot
   *  ParState built from every cell's own state, and `[DQ]` lines appended to `Comment=`. */
  toWdr(): string {
    const h = this.#header;
    const lines: string[] = [
      '[Driver]',
      'Brand=' + (h.brand ?? ''),
      'Model=' + (h.model ?? ''),
      'Manufacturer=' + (h.manufacturer ?? ''),
      'ProvidedBy=' + (h.providedBy ?? ''),
      'Comment=' + commentWithDq(h.comment ?? '', this.#dqLines),
      'DateAdded=' + (h.dateAdded ?? ''),
      'DateModified=' + (h.dateModified ?? ''),
    ];
    for (const key of INI_ROWS) {
      // A key in `missingKeys()` still exports here — `0`, same as any other unset numeric
      // field — rather than aborting the whole `.wdr`; see `missingKeys()`'s own doc for why
      // that drift is reported, not thrown.
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

  // ── Import diffs, never overwrites (ARCHITECTURE.md §3) ───────────────────────────────

  /**
   * Compare THIS (as-read) instance's `E` (stated) AND `C` (WinISD's own calculated) values
   * against `other`'s own value for the same key — `other` is normally
   * `WinISDDriver.fromOpenISDDriver(driver)`, the independently-derived side. A mismatch
   * beyond the file's own float precision is reported, never silently overwritten. A key
   * this instance marked `N` (never in play) is not compared — there is nothing "as-read" to
   * check it against. Comparing `C` cells too, not just `E`, is what catches the case
   * ARCHITECTURE.md §3 names: a value WinISD itself computed and stored, that no longer
   * agrees with a fresh derivation from the same `E`-marked inputs (stale save, or the two
   * solvers disagree) — see
   * `bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`
   * for the sibling defect this same principle already guards against on the `E` side.
   */
  diffAgainst(other: WinISDDriver, relTol: number = DIFF_REL_TOL): DriverError[] {
    const out: DriverError[] = [];
    for (const [key, cell] of this.#cells) {
      if (cell.state === 'N') continue;
      const a = Number(cell.value);
      if (!isFinite(a)) continue;   // text fields (brand/model/…) are not this comparison's job
      const otherCell = other.cell(key);
      const b = Number(otherCell.value);
      if (!isFinite(b)) continue;
      const tol = Math.max(DIFF_ABS_FLOOR, relTol * Math.max(Math.abs(a), Math.abs(b)));
      if (Math.abs(a - b) > tol) {
        out.push({ level: 'warn', field: key,
          message: `${key}: the file states ${a}, but the record independently derives ${b} — value hand-edited outside openisd, or the record is stale` });
      }
    }
    return out;
  }
}

/** WDR key → its ParState slot position, where one exists. `Dia` shares `Dd`'s slot (WinISD
 *  writes both keys but tracks one edit-state for the pair — `Driver=all-defaults.wdr`). */
function keyPos(wdrKey: string): number | null {
  const pos = POS_TO_WDRKEY.indexOf(wdrKey);
  return pos >= 0 ? pos : null;
}
