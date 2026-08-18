/**
 * `WinISDDriver` — the single class that knows the `.wdr` FILE FORMAT
 * (ARCHITECTURE.md §3 "`WinISDDriver` is solely a serialisation device"). It validates,
 * holds no live state, derives nothing itself (every physics call goes through
 * `@openisd/model`'s `deriveOpenISDFields`, which is itself a thin adapter over
 * `@openisd/engine`), and does not persist between calls.
 *
 * Two directions:
 *
 *  - EXPORT — `fromOpenISDRecord`/`fromYaml`. `OpenISDDriver`'s resolved values populate a
 *    `WinISDDriver` instance immediately before serialisation, then it is discarded. This
 *    replaces `native/openisdToWdr.ts`'s `openisdYamlToWdr` free function.
 *  - IMPORT — `fromWdr`. `.wdr` text populates a `WinISDDriver` with exactly what the file
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
import { parse as parseYaml } from 'yaml';
import { deriveOpenISDFields, winningReading } from '@openisd/model';
import type {
  _SpecSection, _SpecEntry, _ScrapedField, DqMark, OpenISDDriver, _OpenISDDriverJson,
} from '@openisd/model';
import type { DriverError, Result } from '@openisd/engine';
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
export type WdrCells = ReadonlyMap<string, WdrCell>;

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

const err = (field: string, message: string): DriverError => ({ level: 'error', field, message });

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
export const NUMERIC_DEFAULTS: ReadonlyArray<readonly [string, number]> = [
  ['Qts', 0], ['Znom', 0], ['Fs', 0], ['Pe', 0], ['SPL', 0], ['Re', 0], ['Le', 0],
  ['fLe', 0], ['KLe', 0], ['BL', 0], ['Xmax', 0], ['Cms', 0], ['Qms', 0], ['Qes', 0],
  ['Rms', 0], ['Mms', 0], ['Sd', 0], ['Vas', 0], ['Dia', 0], ['Vd', 0], ['no', 0],
  ['Dd', 0], ['EBP', 0], ['numVC', 1], ['Hc', 0], ['Hg', 0], ['SPLmax', 0],
  ['SPLmaxLF', 0], ['USPL', 0], ['alfaVC', 0], ['Rt', 0], ['Ct', 0], ['gamma', 0],
  ['Rme', 0], ['Mpow', 0], ['Mcost', 0], ['Gloss', 0], ['VCCon', 1],
  // WinISD's own environment constants — written on every save, never 0.
  ['c', 343.684120962152], ['roo', 1.20095217714682],
  ['Thick', 0], ['Depth', 0], ['MagDepth', 0], ['Magnet', 0], ['Basket', 0],
  ['Outer', 0], ['Vcd', 0], ['DVol', 0],
];

/** Every `.wdr` key WinISDDriver tracks (value + WinISD default), in file order — for a
 *  producer that needs to know the full key set before calling `cell()` per key (`driver.ts`
 *  builds its own `WdrCells` map this way). */
export const WDR_NUMERIC_KEYS: readonly string[] = NUMERIC_DEFAULTS.map(([k]) => k);

/**
 * `openisd.yml` spec-field name → `.wdr` key, with the unit conversion the projection owes.
 * The record stores dimensions in mm and volume in litres (field-NAME convention, not an
 * SI-canonical `read_value`); WinISD stores SI.
 */
export const SPEC_TO_WDR: ReadonlyArray<readonly [keyof _SpecSection, string, number]> = [
  ['Fs', 'Fs', 1], ['Re', 'Re', 1], ['Le', 'Le', 1], ['fLe', 'fLe', 1], ['KLe', 'KLe', 1],
  ['Znom', 'Znom', 1], ['Qts', 'Qts', 1], ['Qes', 'Qes', 1], ['Qms', 'Qms', 1],
  ['Vas', 'Vas', 1], ['Sd', 'Sd', 1], ['BL', 'BL', 1], ['Mms', 'Mms', 1],
  ['Cms', 'Cms', 1], ['Rms', 'Rms', 1], ['Xmax', 'Xmax', 1], ['Pe', 'Pe', 1],
  ['SPL', 'SPL', 1], ['Dd', 'Dd', 1], ['EBP', 'EBP', 1],
  ['numVC', 'numVC', 1], ['VCCon', 'VCCon', 1],
  ['voice_coil_dia_mm', 'Vcd', 1e-3], ['Hg_mm', 'Hg', 1e-3], ['Hc_mm', 'Hc', 1e-3],
  ['thick_mm', 'Thick', 1e-3], ['depth_mm', 'Depth', 1e-3],
  ['magnet_depth_mm', 'MagDepth', 1e-3], ['magnet_dia_mm', 'Magnet', 1e-3],
  ['basket_dia_mm', 'Basket', 1e-3], ['outer_dia_mm', 'Outer', 1e-3],
  ['driver_volume_l', 'DVol', 1e-3],
  // The remaining `.wdr` fields. OpenISD is a SUPERSET of a `.wdr`, so EVERY key WinISD can
  // write is mapped, with no exemptions — an ENTERED value must survive the cycle whether or
  // not we could also have derived it. Scale 1 throughout: these keep WinISD's own field names
  // and therefore its units.
  ['c', 'c', 1], ['roo', 'roo', 1],
  ['Dia', 'Dia', 1], ['Vd', 'Vd', 1], ['no', 'no', 1],
  ['SPLmax', 'SPLmax', 1], ['SPLmaxLF', 'SPLmaxLF', 1], ['USPL', 'USPL', 1],
  ['alfaVC', 'alfaVC', 1], ['Rt', 'Rt', 1], ['Ct', 'Ct', 1], ['gamma', 'gamma', 1],
  ['Rme', 'Rme', 1], ['Mpow', 'Mpow', 1], ['Mcost', 'Mcost', 1], ['Gloss', 'Gloss', 1],
];

/** Engine derivation output name → `.wdr` key, where the two spell it differently. */
const DERIVED_TO_WDR: Readonly<Record<string, string>> = {
  Bl: 'BL', Z: 'Znom', c: 'c', roo: 'roo',
};

/** `.wdr` key → the `_SpecSection` field it maps to, with the unit conversion back to record
 *  convention (mm/litres) — the exact inverse of `SPEC_TO_WDR`. TOTAL over the `.wdr` key set:
 *  `OpenISDDriver` is a superset of a `.wdr`, so every key WinISD can write resolves here.
 *  `wdr-model-coverage.test.ts` fails on any that does not. */
const WDR_TO_SPEC = new Map<string, readonly [keyof _SpecSection, number]>(
  SPEC_TO_WDR.map(([specKey, wdrKey, scale]) => [wdrKey, [specKey, 1 / scale] as const]),
);

/**
 * WinISD writes plain JS-style numbers: `0`, `1`, `343.684120962152`, `6.45e-05`. Not
 * fixed-decimal, not rounded — the stored double's shortest round-trip form, which is what
 * `String(n)` already produces.
 */
const fmt = (n: number): string => String(n);

/** Metadata fields that carry a `dq: DqMark[]` array (the `_ScrapedField<T>` envelope). Order
 *  here IS record order for DQ-comment purposes — declared once, walked the same way every
 *  time. `driver_type` is included: it is a `_ScrapedField`, not a closed enum wrapper. */
const DQ_META_FIELDS: ReadonlyArray<keyof _OpenISDDriverJson> = [
  'manufacturer', 'brand', 'model', 'series', 'driver_type', 'nominal_size_cm',
  'product_image', 'description', 'surround_material',
];

/** Format one `_SpecEntry`/`_ScrapedField`'s current value for the `[DQ]` line — the same
 *  shortest-round-trip text `fmt`/`toWdr` uses for a number, verbatim for a string. */
function dqValueText(v: number | string): string {
  return typeof v === 'number' ? fmt(v) : v;
}

/** `[DQ] <field>=<value>: <offence>` for every mark the record carries, in record order —
 *  metadata fields (declared order), then every T/S field of the driver's OWN section
 *  (_SpecSection's declared key order). One line per mark; `mark.detail` IS the offence text
 *  (record_registries.py's one registered template rendering — never composed here). */
function dqLinesOf(record: _OpenISDDriverJson): string[] {
  const lines: string[] = [];
  const push = (field: string, value: number | string, marks: readonly DqMark[] | undefined): void => {
    for (const m of marks ?? []) lines.push(`[DQ] ${field}=${dqValueText(value)}: ${m.detail}`);
  };

  for (const key of DQ_META_FIELDS) {
    const f = record[key] as _ScrapedField<string | number> | undefined;
    if (f && f.value !== '' && f.value != null) push(key, f.value, f.dq);
  }
  const section = sectionFor(record);
  if (section) {
    for (const key of Object.keys(section) as (keyof _SpecSection)[]) {
      const entry = section[key];
      if (!entry) continue;
      let value: number | string;
      try { value = winningReading(entry).read_value; } catch { continue; }
      push(key, value, entry.dq);
    }
  }
  return lines;
}

/** Which `specs:` section a record's `driver_type` selects. */
function sectionFor(record: _OpenISDDriverJson): _SpecSection | null {
  const t = record.driver_type?.value;
  if (t === 'passive_radiator' || t === 'passive-radiator') return record.specs?.passive_radiator ?? null;
  if (t === 'tweeter') return record.specs?.tweeter ?? null;
  // Everything else (woofer, subwoofer, midrange, full-range…) lives in `woofer`.
  return record.specs?.woofer ?? null;
}

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

  private constructor(header: WdrHeader, cells: WdrCells, dqLines: readonly string[]) {
    this.#header = header;
    this.#cells = cells;
    this.#dqLines = dqLines;
  }

  /**
   * Low-level constructor: hand over every `.wdr` key you can answer for, keyed by WinISD's
   * OWN spelling. A key you omit reads `{value: '', state: 'N'}` and gets its WinISD default.
   */
  static build(header: WdrHeader, cells: WdrCells, dqLines: readonly string[] = []): WinISDDriver {
    return new WinISDDriver(header, cells, dqLines);
  }

  /** One field, by WinISD's own key spelling. Never throws — an unknown key reads N/absent. */
  cell(wdrKey: string): WdrCell {
    return this.#cells.get(wdrKey) ?? { value: '', state: 'N' };
  }

  // ── EXPORT — OpenISDDriver's resolved values → WinISDDriver ──────────────────────────

  /**
   * Project one `openisd.yml` record into a `WinISDDriver` — the entry point
   * `winisd_tools` calls in-process (embedded V8) to generate the `.wdr` it stores in
   * `winisd_drivers`, replacing the free function `openisdYamlToWdr`.
   *
   * Never throws by itself — the caller (`fromYaml`) is where a malformed source becomes a
   * `Result`. This entry point trusts `record` is already a parsed object.
   */
  /**
   * Takes the live `OpenISDDriver`, never a raw record: `OpenISDDriver` is the settled public
   * API for a driver everywhere in this app (human ruling, 2026-08-17) — `.toRecord()` is read
   * once, immediately below, and nowhere else in this class.
   *
   * `ebp`: EBP is not a real `SpecField` (no engine derivation route — ledger, 2026-08-17), so
   * `deriveOpenISDFields()` below never produces it. `OpenISDDriver.ebp()` is the ONE place
   * that formula is allowed to live (ARCHITECTURE.md "WinISDDriver is solely a serialisation
   * device" — no calculation logic here); this class only ever ASSIGNS the value the getter
   * hands it, never derives one itself.
   * bugs/BUG_20260817_wdr_writer_computes_ebp_itself_violating_its_own_no-calc-logic_rule.md
   */
  static fromOpenISDDriver(driver: OpenISDDriver): Result<WinISDDriver> {
    const record = driver.toRecord() as unknown as _OpenISDDriverJson;
    const ebp = driver.ebp();
    const section = sectionFor(record);
    if (section == null) {
      return {
        value: null,
        errors: [err('specs', 'record carries no specs section for its driver_type — not an OpenISD record')],
      };
    }

    // ── 1. Flatten the record's entered spec values to flat SI numbers ──────────────────
    // A _SpecEntry's number is reachable ONLY at readings[origin].read_value; there is no
    // flat value to fall back on (ARCHITECTURE.md §3).
    const entered: Record<string, number> = {};
    const enteredWdrKeys = new Set<string>();
    const intake: DriverError[] = [];
    for (const [specKey, wdrKey, scale] of SPEC_TO_WDR) {
      const entry = section[specKey] as _SpecEntry | undefined;
      if (entry?.origin == null || entry.readings == null) continue;   // genuinely absent ⇒ N
      let v: number;
      try {
        v = winningReading(entry).read_value;
      } catch {
        intake.push({ level: 'warn', field: wdrKey,
          message: `${specKey}: origin "${entry.origin}" has no reading — field dropped to N with its WinISD default` });
        continue;
      }
      if (typeof v !== 'number' || !isFinite(v)) {
        intake.push({ level: 'warn', field: wdrKey,
          message: `${specKey}: read_value is ${String(v)}, not a finite number — field dropped to N with its WinISD default` });
        continue;
      }
      if (v === 0) {
        intake.push({ level: 'warn', field: wdrKey,
          message: `${specKey}: entered value is 0 — written as an entered 0; verify this is real and not a failed extraction` });
      }
      entered[wdrKey] = v * scale;
      enteredWdrKeys.add(wdrKey);
    }

    // ── 2. Calculate everything derivable, through @openisd/model — this class derives
    //       nothing itself. ─────────────────────────────────────────────────────────────
    const solverIn: Record<string, number> = {};
    for (const k in entered) solverIn[k === 'BL' ? 'Bl' : k === 'Znom' ? 'Z' : k] = entered[k];
    const { fields: solved, errors: solverErrors } = deriveOpenISDFields(solverIn);

    // `deriveOpenISDFields` answers both "what can be solved" and "is this driver
    // simulatable". This projection asks only the first; its `error`-level results are true
    // statements about completeness, not failures of the projection — a record with nothing
    // set projects to exactly `john-all-defaults.wdr`, which WinISD itself writes. So they
    // are reported at `warn`.
    const errors: DriverError[] = [
      ...intake,
      ...solverErrors.map(e =>
        e.level === 'error'
          ? { ...e, level: 'warn' as const, message: `${e.message} — written as N with its WinISD default` }
          : e),
    ];

    const computed: Record<string, number> = {};
    for (const k in solved) {
      const wdrKey = DERIVED_TO_WDR[k] ?? k;
      if (typeof solved[k] === 'number' && isFinite(solved[k])) computed[wdrKey] = solved[k];
    }
    if (computed.EBP == null && ebp != null) computed.EBP = ebp;
    if (computed.Dia == null && computed.Dd != null) computed.Dia = computed.Dd;
    // Xlim: the record's value cannot be carried into a `.wdr` — the format has no key for it
    // (see XLIM_PARSTATE_SLOT). All that crosses is the MARK: the record states an Xlim, so
    // slot 10 says `E`. A record with no Xlim leaves the slot `N`.
    let xlimEntered = false;
    const xlimEntry = section.Xlim;
    if (xlimEntry?.origin != null && xlimEntry.readings != null) {
      try {
        const v = winningReading(xlimEntry).read_value;
        xlimEntered = typeof v === 'number' && isFinite(v);
      } catch { /* origin has no reading — leave Xlim unset */ }
    }
    // c/roo are WinISD's OWN stored constants and are never recomputed here — see
    // NUMERIC_DEFAULTS' own comment. The solver's copies are rounded for the simulator and
    // must not leak into a value line.
    delete computed.c;
    delete computed.roo;

    // ── 3. Every WDR-tracked key becomes a cell: value + E/C/N ──────────────────────────
    const cells = new Map<string, WdrCell>();
    for (const [key, dflt] of NUMERIC_DEFAULTS) {
      const v = entered[key] ?? computed[key] ?? dflt;
      const state: CellState = key === 'numVC' ? 'E'
        : (key === 'c' || key === 'roo') ? 'C'
        : enteredWdrKeys.has(key) ? 'E'
        : (typeof computed[key] === 'number' && isFinite(computed[key])) ? 'C'
        : 'N';
      cells.set(key, { value: fmt(v), state });
    }
    if (xlimEntered) cells.set('Xlim', { value: '', state: 'E' });

    const s = (v: string | undefined): string => v ?? '';
    const header: WdrHeader = {
      brand: s(record.brand?.value),
      model: s(record.model?.value),
      manufacturer: s(record.manufacturer?.value),
      providedBy: '',
      comment: s(record.description?.value),
      dateAdded: '',
    };

    return { value: new WinISDDriver(header, cells, dqLinesOf(record)), errors };
  }

  /**
   * Parse `openisd.yml`/`.owdr` TEXT and project it — the direct, never-throws replacement
   * for `openisdYamlToWdr(yamlText)`.
   */
  static fromYaml(yamlText: string): Result<WinISDDriver> {
    let record: _OpenISDDriverJson;
    try {
      record = parseYaml(yamlText) as _OpenISDDriverJson;
    } catch (e) {
      return { value: null, errors: [err('yaml', `could not parse openisd.yml: ${String(e)}`)] };
    }
    if (record == null || typeof record !== 'object') {
      return { value: null, errors: [err('yaml', 'openisd.yml did not parse to a record')] };
    }
    return WinISDDriver.fromOpenISDRecord(record);
  }

  // ── IMPORT — `.wdr` text → WinISDDriver, as read (no derivation) ─────────────────────

  /**
   * Parse a `.wdr`'s `[Driver]` section into a `WinISDDriver` holding exactly what the file
   * states — the raw text of every key, and its E/C/N mark taken directly from the source
   * ParState (or, for a file with none, presence ⇒ E, matching a scraper-authored file with
   * no ParState line). This performs NO derivation — pairs with `diffAgainst` for that.
   */
  static fromWdr(text: string): WinISDDriver {
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
    for (const [key] of NUMERIC_DEFAULTS) {
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

  // ── IMPORT continued — this AS-READ WinISDDriver → _OpenISDDriverJson ─────────────────────

  /**
   * Project THIS as-read `.wdr` (from `fromWdr`) into a `_OpenISDDriverJson` — the reader half of
   * Step 8 (ARCHITECTURE.md §3 "Import": "`.wdr` text populates a `WinISDDriver`; those
   * as-read values are diffed against what `OpenISDDriver` independently derives"). This is a
   * NEW method; `fromWdr` itself keeps returning raw, undived cells — nothing here changes its
   * signature or behaviour.
   *
   * Provenance mapping, field by field:
   *  - a cell marked `E` becomes a stated `_SpecEntry`. A raw `.wdr` import has no finer source
   *    than the file itself, and `SourceRole` has no dedicated WDR role — `manual` is the one
   *    role already meaning exactly that ("no printed literal, no stated precision", ledger
   *    QO36 ruling B3), so the reading carries `read_value` alone.
   *  - a cell marked `C` is WinISD's OWN calculated value, never a stated fact — it is left out
   *    of the record entirely, and `OpenISDDriver` re-derives it fresh once loaded. A mismatch
   *    between what WinISD stored and what gets re-derived is `diffAgainst`'s job, not this
   *    method's — call it separately against `WinISDDriver.fromOpenISDRecord(record)`.
   *  - a cell marked `N` is simply absent; nothing is invented for it.
   */
  toOpenISDRecord(): _OpenISDDriverJson {
    const woofer: _SpecSection = {};
    for (const [wdrKey, cell] of this.#cells) {
      if (cell.state !== 'E') continue;
      const mapped = WDR_TO_SPEC.get(wdrKey);
      if (!mapped) continue;
      const [specKey, inv] = mapped;
      const v = Number(cell.value);
      if (!isFinite(v)) continue;
      woofer[specKey] = { origin: 'manual', readings: { manual: { read_value: v * inv } }, dq: [] };
    }

    const h = this.#header;
    const meta = (value: string | undefined): _ScrapedField<string> =>
      ({ value: value ?? '', origin: 'manual', definition: 'from the .wdr header', dq: [] });
    const brand = h.brand ?? '';
    const model = h.model ?? '';
    const slug = `${brand} ${model}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return {
      uuid: { value: '', definition: 'no stable identity — a raw .wdr carries none' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: meta(h.manufacturer),
      brand: meta(h.brand),
      model: meta(h.model),
      sku: {
        value: slug,
        definition: 'slug of the .wdr Brand/Model header text',
        grounds: [{ origin: 'manual', reading: `${brand} ${model}`.trim(), definition: 'the .wdr Brand/Model header lines' }],
      },
      driver_type: { value: 'woofer', origin: 'manual', definition: '.wdr carries no driver-type discriminator', dq: [] },
      disposition: { value: 'ok', definition: 'imported from a .wdr file', detail: '' },
      data_sources: { value: {}, definition: '.wdr carries no source URLs' },
      authoritative: { value: 'manual', definition: 'the .wdr file is its own only source' },
      specs: { woofer },
    };
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
    for (const [key, dflt] of NUMERIC_DEFAULTS) {
      const c = this.#cells.get(key);
      lines.push(`${key}=${c ? c.value : fmt(dflt)}`);
    }
    // No `Xlim=` line: WinISD writes none, and `.wdr` has no extension mechanism to add one
    // (XLIM_PARSTATE_SLOT). Xlim crosses as its slot-10 mark and nothing else.
    lines.push('ParState=' + this.#parState());
    lines.push('');
    // CRLF, because `.wdr` is a Windows INI and every file WinISD writes uses it. LF would
    // differ from WinISD's own output on every single line, which makes a byte comparison
    // against a WinISD-written oracle impossible — and that comparison is how the projection
    // in Plan 2 is checked. `fromWdr` already accepts either (`split(/\r?\n/)`).
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
   * `WinISDDriver.fromOpenISDRecord(record)`, the independently-derived side. A mismatch
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
