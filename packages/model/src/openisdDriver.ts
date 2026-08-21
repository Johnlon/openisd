/**
 * `OpenISDDriver` — the stateful driver model the app holds.
 *
 * This is the app's ONE driver model. It owns a `_OpenISDDriverJson` record and answers three
 * questions about every field: what is its value, where did that value come from, and
 * what does the engine say is wrong with the driver as a whole.
 *
 * The format detail of `.wdr`/`.wpr` — ParState, the 49 slots, the 48-key order, VCCon's 1/2
 * encoding — lives in `@openisd/winisd`. This model PROJECTS ITSELF INTO that format
 * (`toWdrText()`), so the dependency runs THIS WAY: `@openisd/model` imports
 * `@openisd/winisd`, never the reverse. `@openisd/winisd` imports nothing from this package
 * and must never learn that OpenISD exists.
 *
 * ── Provenance to display state (ledger QO36 ruling B4) ──
 * ANY real reading displays as `E`; only a solver result is `C`; absent is `N`. `E` means
 * STATED, not typed-by-this-user: WinISD loads a `.wdr` whose numbers came off a datasheet
 * and shows them as E, and WinISD is the reference. The finer provenance — WHICH source a
 * reading came from — stays on the record for the provenance inspector; it does not split
 * the display state.
 *
 * ── A hand-entered value (ledger QO36 ruling B3) ──
 * `enter()` writes a reading under the `manual` role carrying the value ALONE.
 * `read_precision` and `actual_reading` are omitted: there was no printed literal to echo
 * and nothing stated a precision, so writing either would fabricate provenance. One
 * reading shape, with those two genuinely absent — not a second envelope for hand entry.
 */
import { deriveOpenISDFields } from './openisdDerive.js';
import type {
  SourceRole, Reading, DqMark, DQStatus, Ground, DispositionField, QualityBlock, CurvesBlock,
} from './openisdRecord.js';
import { deriveEngineDriver, checkConsistency, moistAirDensity, moistAirSoundVelocity,
         T_REF_K, RH_REF_PCT, P_REF_PA, ebp as computeEbp } from '@openisd/engine';
import type {
  DriverError, EngineDriver, ConsistencyIssue, Result,
} from '@openisd/engine';
import { WinISDDriver, INI_ROWS } from '@openisd/winisd';
import { CellState } from '@openisd/winisd';
import type { WdrCell, WdrHeader } from '@openisd/winisd';

/**
 * `Provenance` — where a field's value came from. OpenISD's own concept, in OpenISD's own
 * vocabulary.
 *
 * Three states, and every field is in exactly one:
 *
 *   Entered     a human or a source STATED this value. Never recomputed over.
 *   Calculated  the solver derived it from other fields.
 *   Absent      nothing states it and nothing derives it — genuinely not set.
 *
 * `.wdr`'s ParState spells the same three ideas as the letters `E`/`C`/`N`. Those letters are
 * that FILE FORMAT's encoding, declared in `@openisd/winisd` and used only there; the mapping
 * between the two lives in this package's projection into that format, because the model knows
 * the format and the format knows nothing of the model.
 */
export enum Provenance {
  Entered = 'entered',
  Calculated = 'calculated',
  NotAvailable = 'notavailable',
}

/**
 * `Provenance` → `.wdr` ParState letter. The ONE crossing between OpenISD's own vocabulary and
 * WinISD's file encoding, and it lives here because this package projects itself into that
 * format — `@openisd/winisd` knows nothing of `Provenance`. TOTAL, so a new `Provenance` member
 * is a compile error here rather than a silently mis-marked field.
 */
const WDR_MARK: Record<Provenance, CellState> = {
  [Provenance.Entered]: CellState.Entered,
  [Provenance.Calculated]: CellState.Computed,
  [Provenance.NotAvailable]: CellState.Absent,
};

/**
 * The `openisd.yml` record shape — `OpenISDDriver`'s constructor parameter and the `.owdr`
 * bytes `toRecord()` hands back.
 *
 * EXPORTED because a project must be able to HOLD one. `OpenISDDriver` is a class with private
 * fields, and `structuredClone` silently reduces a class instance to a plain object — dropping
 * every method and the prototype — so a structure that has to be cloned (an `OpenISDProject`,
 * cloned three ways by `ManagedProject`) cannot hold the live class. It holds the RECORD, and
 * the facade materialises a live `OpenISDDriver` over whichever layer is effective.
 *
 * This is the same rule that governs repositories and file I/O: RECORDS cross boundaries,
 * INSTANCES do not.
 */
export interface _OpenISDDriverJson {
  uuid: _BookkeepingField<string>;
  quality: QualityBlock;
  manufacturer: _ScrapedField<string>;
  brand: _ScrapedField<string>;
  model: _ScrapedField<string>;
  sku: _DerivedField<string>;
  name?: _DerivedField<string>;
  series?: _ScrapedField<string>;
  driver_type: _ScrapedField<string>;
  nominal_size_cm?: _ScrapedField<number>;
  disposition: DispositionField;
  data_sources: _BookkeepingField<Partial<Record<SourceRole, string>>>;
  authoritative: _BookkeepingField<SourceRole>;
  product_image?: _ScrapedField<string>;
  description?: _ScrapedField<string>;
  surround_material?: _ScrapedField<string>;
  /** Who supplied this record. Optional: a scraped record has no supplier to name, a
   *  hand-authored or shared one does. Its absence from driver.yml/openisd.yml was a DATA
   *  GAP, not a design choice (human ruling 2026-08-14) — winisd_tools must populate it. */
  provided_by?: _ScrapedField<string>;
  /** Free human note about this driver. Same standing as provided_by: a real field of the
   *  record, optional, previously missing from both file formats. */
  comment?: _ScrapedField<string>;
  /** When this record was added, ISO yyyy-mm-dd. Same standing as provided_by. */
  added?: _ScrapedField<string>;
  specs: _Specs;
  curves?: CurvesBlock;
}

/**
 * Human ruling: the ONLY files, `packages/`-relative, permitted to name `_OpenISDDriverJson` —
 * the class that owns this shape (this file), the store, and the single class responsible
 * for OpenISD's own file io. Enforced by `packages/ui/test/ui/architecture.test.ts`
 * ("leading-underscore exports are class-private"), which scans every `_Name` declaration
 * across the repo for a sibling `<Name>PrivateAllow` export like this one and treats it as
 * the exhaustive permission list for that name.
 *
 * ONLY the human may add, remove, or change an entry here — no agent may edit this list on
 * its own judgement, however legitimate a call site looks. A failing test naming a new
 * offender is the correct, expected result, not authorization to widen this list to make it
 * pass; report the offender and wait for the human's ruling instead.
 */
export const _OpenISDDriverJsonPrivateAllow = [
  // Human grant 2026-08-20: "openisdproject is Permitted by me to share it's internal Json
  // state object with openisd class - granted these are the API classes for the domain and
  // private sharing is ok". The two domain API classes, and only those two.
  'model/src/openisdProject.ts',
];

// ── The envelope kinds `_OpenISDDriverJson`'s fields are built from ──────────────────────
//
// They live beside the JSON shape and the class that wraps it because they ARE that shape's
// parts: every one of them appears as a field type in `_OpenISDDriverJson` above. Human
// grant 2026-08-20 — "if the Json object is in same file as class wrapper then that's ok,
// move the other Json object into same file, they can share privately".

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
   * inside its `[Driver]` section as well (`docs/winisd_screenshots/sample_project_Epique15_-_pr.wpr`,
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

/** What `cell()` answers: the number, and where it came from. */
export interface Cell {
  /** SI value, or null when the field is neither stated nor derivable. */
  value: number | null;
  state: Provenance;
  /** The winning source, present only for a stated value. `manual` means hand-entered. */
  origin?: SourceRole;
}

type DriverListener = () => void;

/** A field of `_SpecSection` — the closed canonical allowlist, not an open string. */
export type SpecField = keyof _SpecSection;

/**
 * The record-level metadata fields a live edit can touch — the `_ScrapedField<string>`
 * envelope, distinct from `SpecField`'s `_SpecEntry` envelope (openisdRecord.ts's four-kind
 * split). Not `sku`/`name` (`_DerivedField` — built, not read) and not `uuid` (`_BookkeepingField`
 * — a pipeline fact, never hand-edited).
 */
export type MetaField =
  | 'brand' | 'model' | 'manufacturer'
  | 'provided_by' | 'comment' | 'added';

/** What `metaCell()` answers for a `MetaField` — no `C` state: nothing computes a brand. */
export interface MetaCell {
  value: string;
  state: Provenance.Entered | Provenance.NotAvailable;
  /** The winning source, present only for a stated (non-empty) value. */
  origin?: SourceRole;
}

/**
 * Which section of `specs` a record's fields live in. Anything that is not a tweeter or a
 * passive radiator reads `woofer` — that is the pipeline's own convention, and `full-range`
 * is the common case that proves it.
 */
function sectionFor(record: _OpenISDDriverJson): 'woofer' | 'tweeter' | 'passive_radiator' {
  const t = record.driver_type?.value;
  if (t === 'tweeter') return 'tweeter';
  if (t === 'passive-radiator' || t === 'passive_radiator') return 'passive_radiator';
  return 'woofer';
}

export class OpenISDDriver {
  /** The record as it stands, including any manual readings entered since load. */
  readonly #record: _OpenISDDriverJson;
  /** The section every T/S field of this driver lives in — fixed by driver_type. */
  readonly #section: 'woofer' | 'tweeter' | 'passive_radiator';
  /** The {value, origin} a MetaField carried before a manual override, so clearMeta() can
   *  restore it. */
  readonly #displacedMeta = new Map<MetaField, { value: string; origin: SourceRole }>();
  /** Memoized solve; dropped on every mutation. */
  #cache: { fields: Record<string, number>; errors: DriverError[] } | null = null;
  /** Memoized consistency verdict; dropped alongside #cache. */
  #issues: ConsistencyIssue[] | null = null;
  /** Whether a derivable (never-stated) field solves to `C`. Off: it reads `N` — nothing is
   *  solved, only what is stated is validated. */
  #autoCalculate = true;
  readonly #listeners = new Set<DriverListener>();

  private constructor(record: _OpenISDDriverJson) {
    this.#record = record;
    this.#section = sectionFor(record);
  }

  static fromJsonRecord(record: _OpenISDDriverJson): OpenISDDriver {
    return new OpenISDDriver(record);
  }

  /** `.owdr` text → an `OpenISDDriver`, direct. `.owdr` IS `_OpenISDDriverJson` as JSON — this
   *  is the one-step replacement for `JSON.parse(text)` + `OpenISDDriver.fromJsonRecord(record)`. */
  static fromOwdrText(text: string): OpenISDDriver {
    return new OpenISDDriver(JSON.parse(text) as _OpenISDDriverJson);
  }

  /**
   * A driver with nothing stated — no T/S values, no identity. What the app holds before a
   * driver has been chosen, and the seed a hand-authored one is built on with `enter()`.
   *
   * Every value here is genuinely EMPTY, never a plausible-looking placeholder: an invented
   * Fs would be indistinguishable from a stated one and would simulate as though someone had
   * measured it. `specs` is an empty woofer section, so `cell()` answers `N` for every field
   * — honestly "not set" — rather than throwing.
   *
   * `origin: 'manual'` on the identity fields is the truthful role for a value the app itself
   * put there (openisdRecord.ts: `manual` is the one non-URL role, a hand-entered value with
   * nothing to index). They carry the empty string, so `metaCell()` reads them as `N`.
   */
  static empty(): OpenISDDriver {
    const identity = (definition: string) =>
      ({ value: '', origin: 'manual' as SourceRole, definition, dq: [] });
    return new OpenISDDriver({
      uuid: { value: '', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: identity('the company that makes the driver'),
      brand: identity('the selling brand'),
      model: identity("the vendor's exact designation"),
      sku: { value: '', definition: 'canonical identity code', grounds: [] },
      driver_type: identity('what kind of driver this is'),
      disposition: {
        value: 'ok', definition: "the record's own account of its standing",
        detail: 'authored in the app, not scraped',
      },
      data_sources: { value: {}, definition: 'the record-wide provenance index' },
      authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
      specs: { woofer: {} },
    });
  }

  /** The record, including every manual reading entered. This is the `.owdr` bytes. */
  toJsonRecord(): _OpenISDDriverJson { return this.#record; }

  /**
   * Project THIS driver into a `WinISDDriver` — every value comes from a getter call on
   * `this` (`.cell()`/`.metaCell()`/`.description()`/`.dqMarks()`), assigned straight across.
   * `WinISDDriver` derives nothing of its own (ARCHITECTURE.md "WinISDDriver is solely a
   * serialisation device") — this method is the ONE place that reads OpenISDDriver's
   * resolved values to build one.
   *
   * `EBP` is a real `SpecField` (`_SpecSection.EBP` above, ParState slot 33) with its own
   * engine derivation route (`Fs = EBP·Qes`, `@openisd/engine`'s `driver.ts` block 3), so it
   * goes through `cell()` in the `INI_ROWS` loop below exactly like every other field — this
   * method does not call `.ebp()` at all.
   */
  toWinISDDriver(): Result<WinISDDriver> {
    const cells = new Map<string, WdrCell>();
    const intake: DriverError[] = [];

    // Every WDR-tracked spec field — c, roo, and EBP included — comes off `cell()` through
    // the exact same entered-or-computed path as Fs/Qes/Rms/anything else: `cell()`'s
    // COMPUTED branch already resolves all three via `solveConsistencyGroup`'s own fill
    // (`@openisd/engine`'s `driver.ts`), so this loop names no field specially.
    for (const key of INI_ROWS) {
      const c = this.cell(key as SpecField);
      if (c.value == null) continue;
      if (!isFinite(c.value)) {
        intake.push({ level: 'warn', field: key,
          message: `${key}: value is not finite — field dropped to N with its WinISD default` });
        continue;
      }
      if (c.state === Provenance.Entered && c.value === 0) {
        intake.push({ level: 'warn', field: key,
          message: `${key}: entered value is 0 — written as an entered 0; verify this is real and not a failed extraction` });
      }
      cells.set(key, { value: String(c.value), state: WDR_MARK[c.state] });
    }
    if (!cells.has('Dia')) {
      const dd = cells.get('Dd');
      if (dd && dd.state === CellState.Computed) cells.set('Dia', dd);
    }

    const finalCells = new Map<string, WdrCell>();
    for (const key of INI_ROWS) {
      const existing = cells.get(key);
      // WinISD's own default is numVC=1 ("one voice coil unless stated otherwise" — decompile
      // evidence at 0x46121c) and VCCon=1 (parallel) — the generic '0' placeholder every
      // other absent key gets would be wrong for either, not merely unset.
      const fallback = key === 'numVC' || key === 'VCCon' ? '1' : '0';
      const state: CellState = key === 'numVC' ? CellState.Entered : existing?.state ?? CellState.Absent;
      finalCells.set(key, existing ?? { value: fallback, state });
    }
    if (this.cell('Xlim').state !== Provenance.NotAvailable) finalCells.set('Xlim', { value: '', state: CellState.Entered });

    const header: WdrHeader = {
      brand: this.metaCell('brand').value,
      model: this.metaCell('model').value,
      manufacturer: this.metaCell('manufacturer').value,
      providedBy: '',
      comment: this.description(),
      dateAdded: '',
    };
    const dqLines = this.dqMarks().map(({ field, value, mark }) =>
      `[DQ] ${field}=${typeof value === 'number' ? String(value) : value}: ${mark.detail}`);

    const wdr = WinISDDriver.build(header, finalCells, dqLines);
    // Always empty in practice — `finalCells` above is built by iterating every INI_ROWS key
    // explicitly — but a non-empty list means this loop and WinISDDriver's own key set have
    // drifted apart, a real incompatibility bug this reports rather than silently swallows.
    for (const key of wdr.missingKeys()) {
      intake.push({ level: 'warn', field: key,
        message: `${key}: WinISDDriver has no INI_ROWS entry for this key — OpenISDDriver and ` +
          `WinISDDriver have drifted out of sync about the .wdr key set` });
    }

    return { value: wdr, errors: intake };
  }

  /**
   * Build an `OpenISDDriver` from a THIS-AS-READ `WinISDDriver` (`WinISDDriver.fromWdrIni(text)`) —
   * the reader half of the `.wdr` import boundary. A cell marked `E` becomes a stated
   * `_SpecEntry`; a cell marked `C` (WinISD's own calculated value) is left out entirely, so
   * `OpenISDDriver` re-derives it fresh once loaded; a cell marked `N` is simply absent.
   */
  static fromWinISDDriver(wdr: WinISDDriver): OpenISDDriver {
    const woofer: _SpecSection = {};
    for (const key of INI_ROWS) {
      const cell = wdr.cell(key);
      if (cell.state !== 'E') continue;
      const v = Number(cell.value);
      if (!isFinite(v)) continue;
      woofer[key as SpecField] = { origin: 'manual', readings: { manual: { read_value: v } }, dq: [] };
    }

    const brand = wdr.headerField('brand') ?? '';
    const model = wdr.headerField('model') ?? '';
    const meta = (value: string | undefined): _ScrapedField<string> =>
      ({ value: value ?? '', origin: 'manual', definition: 'from the .wdr header', dq: [] });
    const slug = `${brand} ${model}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return OpenISDDriver.fromJsonRecord({
      uuid: { value: '', definition: 'no stable identity — a raw .wdr carries none' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: meta(wdr.headerField('manufacturer')),
      brand: meta(wdr.headerField('brand')),
      model: meta(wdr.headerField('model')),
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
    });
  }

  /** `.wdr` text → an `OpenISDDriver`. Paired with `toWdrText()`. */
  static fromWdrText(text: string): OpenISDDriver {
    return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(text));
  }

  /** This driver → `.wdr` text. `errors` names what is missing when the projection cannot
   *  complete; `value` is null then. Paired with `fromWdrText()`. */
  toWdrText(): Result<string> {
    const { value, errors } = this.toWinISDDriver();
    return { value: value ? value.toWdr() : null, errors };
  }

  /** This driver → `.owdr` text. Always succeeds — the record is always representable as its
   *  own JSON. Paired with `fromOwdrText()`. */
  toOwdrText(): string {
    return JSON.stringify(this.toJsonRecord(), null, 2);
  }

  /** The section this driver's T/S fields live in — `specs.woofer` for anything that is
   *  neither a tweeter nor a passive radiator. */
  get section(): 'woofer' | 'tweeter' | 'passive_radiator' { return this.#section; }

  #specs(): _SpecSection {
    if (!this.#record.specs) this.#record.specs = {};
    const s = this.#record.specs[this.#section] ?? {};
    this.#record.specs[this.#section] = s;
    return s;
  }

  #entry(field: SpecField): _SpecEntry | undefined {
    return this.#specs()[field];
  }

  /** Every stated value, flat and SI, under the names the engine solver expects. */
  #stated(): Record<string, number> {
    const out: Record<string, number> = {};
    const specs = this.#specs();
    for (const k of Object.keys(specs) as SpecField[]) {
      const entry = specs[k];
      if (!entry) continue;
      const v = winningReading(entry).read_value;
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
    }
    return out;
  }

  #derived(): { fields: Record<string, number>; errors: DriverError[] } {
    if (!this.#cache) {
      this.#cache = this.#autoCalculate
        ? deriveOpenISDFields(this.#stated())
        : this.#deriveEnteredOnly();
    }
    return this.#cache;
  }

  /** autoCalculate off: no consistency-group solve at all — only what is stated, validated
   *  as-is. Matches deriveOpenISDFields' own air backfill (a driver always has SOME air,
   *  solved or not) but skips its SPL-from-efficiency step, which needs a solved `no`. No
   *  environment reaches this record, so a missing c/roo is computed live at the reference
   *  environment — never a stored constant (docs/design/WINISD_SCHEMA.md §12). */
  #deriveEnteredOnly(): { fields: Record<string, number>; errors: DriverError[] } {
    const stated = { ...this.#stated() };
    if (stated.c == null) stated.c = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
    if (stated.roo == null) stated.roo = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
    const { errors } = deriveEngineDriver(stated);
    return { fields: stated, errors };
  }

  /**
   * The value and its provenance. A stated reading — from a datasheet or from the keyboard
   * — is `E`; a solver result is `C`; neither is `N`.
   */
  cell(field: SpecField): Cell {
    const entry = this.#entry(field);
    if (entry) {
      return { value: winningReading(entry).read_value, state: Provenance.Entered, origin: entry.origin };
    }
    const v = this.#derived().fields[field];
    if (typeof v === 'number' && isFinite(v)) return { value: v, state: Provenance.Calculated };
    return { value: null, state: Provenance.NotAvailable };
  }

  /** Efficiency Bandwidth Product (Fs/Qes) — WinISD: `EBP`, a real `SpecField`
   *  (`_SpecSection.EBP`, ParState slot 33) with its own engine derivation route
   *  (`Fs = EBP·Qes`, `@openisd/engine`'s `driver.ts` block 3). This getter is the live-editor
   *  display shortcut only — it always recomputes `Fs/Qes` from this driver's own cells rather
   *  than reading `cell('EBP')`, so it carries no ENTERED/CALCULATED distinction of its own.
   *  Null when either `Fs` or `Qes` is unknown. */
  ebp(): number | null {
    const fs = this.cell('Fs').value;
    const qes = this.cell('Qes').value;
    return typeof fs === 'number' && typeof qes === 'number' ? computeEbp({ Fs: fs, Qes: qes }) : null;
  }

  /**
   * Record a hand-entered value. It becomes the winning reading under the `manual` role,
   * carrying the value alone — see the B3 ruling in this file's header. Any reading the
   * record already held is KEPT — a `readings` dict is the whole point — for as long as the
   * field stays manually entered; `clear()` deletes the whole entry outright, not just the
   * manual reading, so nothing is restored on clear (human ruling 2026-08-18).
   */
  enter(field: SpecField, value: number): void {
    const specs = this.#specs();
    const existing = specs[field];
    const manual: Reading = { read_value: value };

    if (existing) {
      existing.readings.manual = manual;
      existing.origin = 'manual';
    } else {
      specs[field] = { origin: 'manual', readings: { manual }, dq: [] };
    }
    this.#invalidate();
  }

  /**
   * Drop a hand-entered value. Deletes the field outright — no restore of whichever source was
   * winning before the manual override (human ruling 2026-08-18): the field goes back to being
   * solved or absent, same as a field that was never stated by any source. Recovering the old
   * value means retyping it, or discarding the edit. Clearing a field that was never entered by
   * hand does nothing.
   */
  clear(field: SpecField): void {
    const specs = this.#specs();
    const entry = specs[field];
    if (!entry || entry.origin !== 'manual') return;

    delete specs[field];
    this.#invalidate();
  }

  /** What the engine says stops this driver simulating. The engine is the only authority. */
  errors(): DriverError[] { return this.#derived().errors; }

  /**
   * The resolved, engine-ready driver — every derivable field under its ENGINE name
   * (`Bl`, not `BL`), for `sweep()`/`maxCurves()`. Null when a blocking ('error' level)
   * issue means nothing can be drawn — the same guard `deriveEngineDriver` itself enforces.
   * `numVC` defaults to 1 here only (WinISD's "one voice coil unless stated otherwise") —
   * `cell('numVC')` stays honestly N when nothing stated it; this is the one place a
   * default is owed to the physics, not to the field's own display.
   */
  toDriver(): EngineDriver | null {
    const { fields, errors } = this.#derived();
    if (errors.some(e => e.level === 'error')) return null;
    const out = { ...fields };
    if (out.numVC == null) out.numVC = 1;
    return out as unknown as EngineDriver;
  }

  /**
   * The consistency groups (WINISD_SCHEMA §4) whose STATED members contradict each other
   * beyond their own precision — the same `checkConsistency` the engine exposes, run over
   * exactly what `errors()`/`toDriver()` also start from. Memoised alongside #cache.
   */
  consistencyIssues(): ConsistencyIssue[] {
    return this.#issues ??= checkConsistency(this.#stated());
  }

  /** Whether a derivable field solves to `C`. Off leaves it `N` — see `#deriveEnteredOnly`. */
  get autoCalculate(): boolean { return this.#autoCalculate; }
  set autoCalculate(val: boolean) {
    if (this.#autoCalculate !== val) {
      this.#autoCalculate = val;
      this.#invalidate();
    }
  }

  /** The value and provenance of a record-level metadata field (brand/model/manufacturer)
   *  — the `_ScrapedField<string>` envelope's own `cell()`. No `C` state: nothing computes
   *  a brand. An empty value (never stated, or cleared to nothing) reads `N`. */
  metaCell(field: MetaField): MetaCell {
    const f = this.#record[field];
    if (f?.value && f.value.length > 0) return { value: f.value, state: Provenance.Entered, origin: f.origin };
    return { value: '', state: Provenance.NotAvailable };
  }

  /** The built canonical identity code — `_DerivedField`, so there is no provenance to report,
   *  just the value. Empty until the derivation runs. */
  sku(): string {
    return this.#record.sku.value;
  }

  /** The record's free-text description — a scraped/authored field distinct from the
   *  `comment` MetaField (that one is the later-added "free human note"; `description` is
   *  the record's own longer-standing field, e.g. `.wdr`'s `Comment=` header line source). */
  description(): string {
    return this.#record.description?.value ?? '';
  }

  /**
   * Every `[DQ]` mark this record carries, in record order: the metadata fields first (their
   * own declared order below), then this driver's OWN T/S section (`_SpecSection`'s declared
   * key order) — the exact traversal a `.wdr`'s `[DQ]` comment lines are built from. Exposes
   * only a flat, plain-data list (field name, the value the mark is about, the mark itself) —
   * never the raw `_SpecEntry`/`_ScrapedField` envelope a mark lives in.
   */
  dqMarks(): { field: string; value: number | string; mark: DqMark }[] {
    const out: { field: string; value: number | string; mark: DqMark }[] = [];
    const metaFields: (keyof _OpenISDDriverJson)[] = [
      'manufacturer', 'brand', 'model', 'series', 'driver_type', 'nominal_size_cm',
      'product_image', 'description', 'surround_material',
    ];
    for (const key of metaFields) {
      const f = this.#record[key] as _ScrapedField<string | number> | undefined;
      if (f && f.value !== '' && f.value != null) {
        for (const mark of f.dq ?? []) out.push({ field: key, value: f.value, mark });
      }
    }
    const specs = this.#specs();
    for (const key of Object.keys(specs) as SpecField[]) {
      const entry = specs[key];
      if (!entry) continue;
      let value: number;
      try { value = winningReading(entry).read_value; } catch { continue; }
      for (const mark of entry.dq ?? []) out.push({ field: key, value, mark });
    }
    return out;
  }

  /**
   * Record a hand-entered metadata value — the _ScrapedField equivalent of `enter()`
   * (QO36 B3/B4 apply the same way, on the other envelope). An empty string routes to
   * `clearMeta()`, matching how a blank text input behaves everywhere else in the editor.
   * The value/origin the field carried before the FIRST manual override is snapshotted so
   * `clearMeta()` can restore it — `readings`/`definition`/`dq` are left untouched, since
   * `_ScrapedField`'s number is `.value` directly, never looked up via `readings`.
   */
  enterMeta(field: MetaField, value: string): void {
    if (value === '') { this.clearMeta(field); return; }
    // The optional metadata fields may be genuinely absent on a record the pipeline wrote
    // before they existed; entering one creates it rather than throwing.
    this.#record[field] ??= { value: '', origin: 'manual', definition: field, dq: [] };
    const f = this.#record[field];
    if (f.origin !== 'manual' && !this.#displacedMeta.has(field)) {
      this.#displacedMeta.set(field, { value: f.value, origin: f.origin });
    }
    f.value = value;
    f.origin = 'manual';
    this.#notify();
  }

  /** Drop a hand-entered metadata value. The value/origin the field carried before the
   *  override wins again; clearing a field never entered by hand does nothing. */
  clearMeta(field: MetaField): void {
    const displaced = this.#displacedMeta.get(field);
    if (!displaced) return;
    const f = this.#record[field];
    if (!f) return;
    f.value = displaced.value;
    f.origin = displaced.origin;
    this.#displacedMeta.delete(field);
    this.#notify();
  }

  subscribe(fn: DriverListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #invalidate(): void {
    this.#cache = null;
    this.#issues = null;
    this.#notify();
  }

  #notify(): void {
    // Copy so a listener that unsubscribes mid-notify does not disturb iteration.
    for (const fn of [...this.#listeners]) fn();
  }
}

// ── Reading a RECORD without materialising a driver ──────────────────────────────────────

/**
 * One field's value and provenance, read straight off a RECORD.
 *
 * A catalogue row, a preview pane and a filter bar all need to ask "what is this driver's Fs"
 * about a record that is in no project. They must NOT construct an `OpenISDDriver` to do it:
 * a live driver is mutable and subscribable, it belongs inside `ManagedProject`, and one held
 * anywhere else is a second writer with no notification and no what-if guard.
 *
 * So this is a pure function over the record. It answers the same question `cell()` answers —
 * including a DERIVED value, because "what is this driver's Fs" is a real question about a
 * record that only states Mms and Cms — and it hands back nothing that can be written to.
 */
export function readCell(record: _OpenISDDriverJson, field: SpecField): Cell {
  return OpenISDDriver.fromJsonRecord(record).cell(field);
}

/** One metadata field, read straight off a RECORD. Same reasoning as `readCell`. */
export function readMetaCell(record: _OpenISDDriverJson, field: MetaField): MetaCell {
  return OpenISDDriver.fromJsonRecord(record).metaCell(field);
}

/**
 * What a record is CALLED: `<brand> <model>`, the identity a saved driver is filed under and
 * the name it reads by everywhere. `'Driver'` when it states neither — an unnamed driver is a
 * real state, and inventing a name would make it indistinguishable from one the user set.
 */
export function readDisplayName(record: _OpenISDDriverJson): string {
  const brand = record.brand?.value ?? '';
  const model = record.model?.value ?? '';
  return [brand, model].filter(x => x.length > 0).join(' ').trim() || 'Driver';
}

/** A record with nothing stated — what the editor authors a new driver from. Here rather than
 *  `OpenISDDriver.empty().toJsonRecord()` at the call site, so a caller needing a blank record does
 *  not have to construct a live driver it will immediately throw away. */
/**
 * Structural problems that make a record unusable, empty when it is sound.
 *
 * The record types are TypeScript, which is a compile-time promise about code WE wrote. A blob
 * arriving from localStorage, a share link or a file is data someone else wrote — possibly an
 * older build of this app, possibly a hand-edited string — and `x as _OpenISDDriverJson` is an
 * assertion, not a check. Reading an unchecked blob into the model let one absent key take the
 * whole app down: `#specs()` dereferences `record.specs`, so a record without it threw on the
 * first read and every computed touching the driver died with it.
 *
 * This is the boundary test, and it looks only for what would THROW — not for completeness. A
 * record with no `Fs` is a poor driver and a perfectly loadable one; a record with no `specs`
 * cannot be loaded at all.
 */
export function driverRecordProblems(record: unknown): string[] {
  const problems: string[] = [];
  if (record == null || typeof record !== 'object') return ['not an object'];
  const r = record as Record<string, unknown>;
  if (r.specs == null || typeof r.specs !== 'object') {
    problems.push('`specs` is missing — every field read dereferences it');
  }
  return problems;
}

/**
 * Human ruling: the ONLY files, `packages/`-relative, permitted to name `_emptyDriverRecord` —
 * enforced by `packages/ui/test/ui/architecture.test.ts` the same way as
 * `_OpenISDDriverJsonPrivateAllow` above. ONLY the human may add, remove, or change an entry
 * here — no agent may edit this list on its own judgement.
 */
export const _emptyDriverRecordPrivateAllow: string[] = [];

export function _emptyDriverRecord(): _OpenISDDriverJson {
  return OpenISDDriver.empty().toJsonRecord();
}
