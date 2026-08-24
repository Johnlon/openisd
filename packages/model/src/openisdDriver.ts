/**
 * `OpenISDDriver` — the stateful driver model the app holds.
 *
 * This is the app's ONE driver model. It owns a `OpenISDDriverJson` record and answers three
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
import { parse, stringify } from 'yaml';
import { deriveOpenISDFields } from './openisdDerive.js';
import type {
  SourceRole, Reading, DqMark, DQStatus, Ground, QualityBlock, CurvesBlock,
} from './openisdRecord.js';
import type { StandingEvidence } from './driverStanding.js';
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
export interface OpenISDDriverJson {
  uuid: BookkeepingField<string>;
  quality: QualityBlock;
  manufacturer: ScrapedField<string>;
  brand: ScrapedField<string>;
  model: ScrapedField<string>;
  sku: DerivedField<string>;
  name?: DerivedField<string>;
  series?: ScrapedField<string>;
  driver_type: ScrapedField<string>;
  nominal_size_cm?: ScrapedField<number>;
  data_sources: BookkeepingField<Partial<Record<SourceRole, string>>>;
  authoritative: BookkeepingField<SourceRole>;
  product_image?: ScrapedField<string>;
  description?: ScrapedField<string>;
  surround_material?: ScrapedField<string>;
  /** Who supplied this record. Optional: a scraped record has no supplier to name, a
   *  hand-authored or shared one does. Its absence from driver.yml/openisd.yml was a DATA
   *  GAP, not a design choice (human ruling 2026-08-14) — winisd_tools must populate it. */
  provided_by?: ScrapedField<string>;
  /** Free human note about this driver. Same standing as provided_by: a real field of the
   *  record, optional. */
  comment?: ScrapedField<string>;
  /** When this record was added, ISO yyyy-mm-dd. Same standing as provided_by. */
  added?: ScrapedField<string>;
  specs: Specs;
  curves?: CurvesBlock;
}

// ── The envelope kinds `OpenISDDriverJson`'s fields are built from ──────────────────────
//
// They live beside the JSON shape and the class that wraps it because they ARE that shape's
// parts: every one of them appears as a field type in `OpenISDDriverJson` above. Human
// grant 2026-08-20 — "if the Json object is in same file as class wrapper then that's ok,
// move the other Json object into same file, they can share privately".

export interface SpecEntry {
  /** Names WHICH reading won. Always a key of `readings` — enforced on the Python side. */
  origin: SourceRole;
  /** Every source's own reading. ALWAYS populated, one entry or many — never empty. */
  readings: Partial<Record<SourceRole, Reading>>;
  /** Derived from `readings` on every load, never stored as an independent fact. */
  dq_status?: DQStatus;
  definition?: string;
  dq: DqMark[];
}
/** The one legal way to read a SpecEntry's value — mirrors SpecEntry.winning_reading
 *  (model_driver.py:415-420) rather than adding a second name for the same fact. */
export function winningReading(entry: SpecEntry): Reading {
  const r = entry.readings[entry.origin];
  if (!r) throw new Error(`origin ${entry.origin} has no entry in readings — invalid SpecEntry`);
  return r;
}


// ── ScrapedField<T> — model_driver.py:141-153. Record-level metadata envelope. ─────────
export interface ScrapedField<T> {
  value: T;
  origin: SourceRole;
  /** Only populated when >= 2 sources disagreed — NOT the "always >= 1" rule SpecEntry
   *  follows; a single-source metadata field carries no readings at all. */
  readings?: Partial<Record<SourceRole, T>>;
  definition: string;
  dq: DqMark[];
  note?: string;
}


/** A value BUILT by the pipeline from evidence — not read from a source. */
export interface DerivedField<T> {
  value: T;
  definition: string;
  /** What the derivation consumed — always at least one. */
  grounds: Ground[];
}
/** A pipeline-made fact with nothing external to point at (e.g. uuid). */
export interface BookkeepingField<T> {
  value: T;
  definition: string;
}


// slot at all (distinct from present-but-undefined, which means "not on this driver").
export interface SpecSection {
  // T/S fields (_SPEC_TS_FIELDS)
  Fs?: SpecEntry; Re?: SpecEntry; Le?: SpecEntry; fLe?: SpecEntry; KLe?: SpecEntry;
  Znom?: SpecEntry; Qts?: SpecEntry; Qes?: SpecEntry; Qms?: SpecEntry; Vas?: SpecEntry;
  Sd?: SpecEntry; BL?: SpecEntry; Mms?: SpecEntry; Cms?: SpecEntry; Rms?: SpecEntry;
  Xmax?: SpecEntry; Xlim?: SpecEntry;
  /** Printed sensitivity — no equivalent exists anywhere in today's engine types.
   *  Present here because it IS in the real canonical allowlist; the gap is on the
   *  OpenISDDriver/UI side, not this type. */
  SPL?: SpecEntry;
  Pe?: SpecEntry; Dd?: SpecEntry; EBP?: SpecEntry; numVC?: SpecEntry; VCCon?: SpecEntry;
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
  Dia?: SpecEntry; Vd?: SpecEntry; no?: SpecEntry;
  SPLmax?: SpecEntry; SPLmaxLF?: SpecEntry; USPL?: SpecEntry;
  alfaVC?: SpecEntry; Rt?: SpecEntry; Ct?: SpecEntry; gamma?: SpecEntry; Rme?: SpecEntry;
  Mpow?: SpecEntry; Mcost?: SpecEntry; Gloss?: SpecEntry; c?: SpecEntry; roo?: SpecEntry;
  // Descriptive/dimensional fields (_SPEC_DESCRIPTIVE_FIELDS)
  Vcd?: SpecEntry; Hg?: SpecEntry; Hc?: SpecEntry;
  freq_low_hz?: SpecEntry; freq_high_hz?: SpecEntry; power_peak_W?: SpecEntry;
  weight_kg?: SpecEntry; Thick?: SpecEntry; Depth?: SpecEntry;
  MagDepth?: SpecEntry; Magnet?: SpecEntry; Basket?: SpecEntry;
  Outer?: SpecEntry; OuterX?: SpecEntry; OuterY?: SpecEntry;
  DVol?: SpecEntry;
}
export interface Specs {
  woofer?: SpecSection;
  tweeter?: SpecSection;
  'passive-radiator'?: SpecSection;
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

/** A field of `SpecSection` — the closed canonical allowlist, not an open string. */
export type SpecField = keyof SpecSection;

/**
 * The record-level metadata fields a live edit can touch — the `ScrapedField<string>`
 * envelope, distinct from `SpecField`'s `SpecEntry` envelope (openisdRecord.ts's four-kind
 * split). Not `sku`/`name` (`DerivedField` — built, not read) and not `uuid` (`BookkeepingField`
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
 *
 * A driver TYPE and a specs SECTION KEY are two vocabularies, mapped here, never equated:
 * there are more types than sections (`amt` files under `tweeter` — `spec_emit.py`'s rule for
 * HF transducers), and the section key is an ENUM VALUE used as a dict key in the emitting
 * pydantic model (`Specs` is `RootModel[dict[SpecSectionName, SpecSection]]`), so it is
 * spelled as a STRING, hyphenated like the type value it mirrors.
 */
function sectionFor(record: OpenISDDriverJson): 'woofer' | 'tweeter' | 'passive-radiator' {
  const t = record.driver_type?.value;
  if (t === 'amt') return 'tweeter';
  if (t === 'passive-radiator') return 'passive-radiator';
  return t === 'tweeter' ? 'tweeter' : 'woofer';
}

export class OpenISDDriver {
  /** The record as it stands, including any manual readings entered since load. */
  readonly #record: OpenISDDriverJson;
  /** The section every T/S field of this driver lives in — fixed by driver_type. */
  readonly #section: 'woofer' | 'tweeter' | 'passive-radiator';
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

  private constructor(record: OpenISDDriverJson) {
    this.#record = record;
    this.#section = sectionFor(record);
  }

  static fromJsonRecord(record: OpenISDDriverJson): OpenISDDriver {
    return new OpenISDDriver(record);
  }

  /** A detached copy — cloning a domain object needs its own class-owned method:
   *  `structuredClone` drops methods and the prototype off a class instance, and a text
   *  round-trip through `.toOwdrJson()`/`.fromOwdrJson()` is a boundary crossing no caller
   *  outside the model is licensed to perform just to clone what it already holds. */
  copy(): OpenISDDriver {
    return new OpenISDDriver(JSON.parse(JSON.stringify(this.#record)) as OpenISDDriverJson);
  }

  /**
   * `candidate` → an `OpenISDDriver`, or `null` when it does not conform closely enough to the
   * canonical record shape for every field read to be safe (an absent/non-object `specs`, or a
   * `quality` block missing its `missing`/`parse_errors` arrays). The one owner-side check for
   * data arriving from an untrusted seam (browser storage, the driver corpus) — only this file
   * may cast to `OpenISDDriverJson`, so the conformance check and the construction it gates
   * live together here rather than a caller casting after asking elsewhere.
   */
  static fromConformingRecord(candidate: unknown): OpenISDDriver | null {
    if (driverRecordProblems(candidate).length > 0) return null;
    const quality = (candidate as { quality?: unknown }).quality;
    if (quality == null || typeof quality !== 'object') return null;
    const q = quality as { missing?: unknown; parse_errors?: unknown };
    if (!Array.isArray(q.missing) || !Array.isArray(q.parse_errors)) return null;
    return new OpenISDDriver(candidate as OpenISDDriverJson);
  }

  /** `.owdr` text → an `OpenISDDriver`, direct. `.owdr` IS this model's own record as JSON. */
  static fromOwdrJson(text: string): OpenISDDriver {
    return new OpenISDDriver(JSON.parse(text) as OpenISDDriverJson);
  }

  /** `openisd.yml` text → an `OpenISDDriver`, direct — the YAML-serialised twin of
   *  `fromOwdrJson()`. Parses via the `yaml` package, then constructs exactly as
   *  `fromJsonRecord` does; this is the one call the bundler (`scripts/bundle-drivers.mjs`) and
   *  the round-trip gate (`scripts/roundTripGate.mjs`) build a driver from raw `openisd.yml`
   *  file text with, so neither script parses YAML itself just to hand the result on. */
  static fromOwdrYml(text: string): OpenISDDriver {
    return OpenISDDriver.fromJsonRecord(parse(text) as OpenISDDriverJson);
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
      data_sources: { value: {}, definition: 'the record-wide provenance index' },
      authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
      specs: { woofer: {} },
    });
  }

  /** The record, including every manual reading entered. This is the `.owdr` bytes. */
  toJsonRecord(): OpenISDDriverJson { return this.#record; }

  /**
   * Project THIS driver into a `WinISDDriver` — every value comes from a getter call on
   * `this` (`.cell()`/`.metaCell()`/`.description()`/`.dqMarks()`), assigned straight across.
   * `WinISDDriver` derives nothing of its own (ARCHITECTURE.md "WinISDDriver is solely a
   * serialisation device") — this method is the ONE place that reads OpenISDDriver's
   * resolved values to build one.
   *
   * `EBP` is a real `SpecField` (`SpecSection.EBP` above, ParState slot 33) with its own
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
   * `SpecEntry`; a cell marked `C` (WinISD's own calculated value) is left out entirely, so
   * `OpenISDDriver` re-derives it fresh once loaded; a cell marked `N` is simply absent.
   */
  static fromWinISDDriver(wdr: WinISDDriver): OpenISDDriver {
    const woofer: SpecSection = {};
    for (const key of INI_ROWS) {
      const cell = wdr.cell(key);
      if (cell.state !== 'E') continue;
      const v = Number(cell.value);
      if (!isFinite(v)) continue;
      woofer[key as SpecField] = { origin: 'manual', readings: { manual: { read_value: v } }, dq: [] };
    }

    const brand = wdr.headerField('brand') ?? '';
    const model = wdr.headerField('model') ?? '';
    const meta = (value: string | undefined): ScrapedField<string> =>
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
      data_sources: { value: {}, definition: '.wdr carries no source URLs' },
      authoritative: { value: 'manual', definition: 'the .wdr file is its own only source' },
      specs: { woofer },
    });
  }

  /** `.wdr` text → an `OpenISDDriver`. Paired with `toWdrText()`. */
  static fromWdrText(text: string): OpenISDDriver {
    return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(text));
  }

  /**
   * A driver FILE's text → an `OpenISDDriver`, given which of this model's own serialisations
   * the text is already known to be.
   *
   * THE OWNER OF THE STATE PARSES IT (human ruling 2026-08-22, QO83): turning `.wdr`/`.owdr`
   * text into a driver is a question about THIS model's serialisations, so it is answered here.
   * DECIDING which one a file is is not that question — it depends on the file's name and, when
   * the name is silent, its bytes, neither of which this model may hold an opinion on
   * (`@openisd/model` owns no file formats). That classification is the caller's job, via
   * `fileFormat.ts`'s `DriverFileFormat.ofFileName`/`sniff` — the one classifier, so a `.wdr`
   * and an `.owdr` reader never disagree about which file they were handed.
   *
   * Errors are returned, never thrown: an unreadable file is an ordinary outcome at a file
   * boundary, and the caller's job is to tell the user which file and why.
   */
  static fromFileText(text: string, format: 'wdr' | 'owdr'): Result<OpenISDDriver> {
    try {
      return { value: format === 'wdr' ? OpenISDDriver.fromWdrText(text) : OpenISDDriver.fromOwdrJson(text), errors: [] };
    } catch (err) {
      return { value: null, errors: [{ level: 'error', field: 'file', message: `could not be read: ${(err as Error).message}` }] };
    }
  }

  /** This driver → `.wdr` text. `errors` names what is missing when the projection cannot
   *  complete; `value` is null then. Paired with `fromWdrText()`. */
  toWdrText(): Result<string> {
    const { value, errors } = this.toWinISDDriver();
    return { value: value ? value.toWdr() : null, errors };
  }

  /** This driver → `.owdr` text. Always succeeds — the record is always representable as its
   *  own JSON. Paired with `fromOwdrJson()`. */
  /** This driver's stable identity — empty until one is minted. */
  uuid(): string { return this.#record.uuid.value; }

  /** Mint an identity if none exists; the existing one is kept. Saving is what mints
   *  (QO81 identity ruling): a draft has no identity until it is worth keeping. */
  ensureUuid(): string {
    if (!this.#record.uuid.value) this.#record.uuid.value = crypto.randomUUID();
    return this.#record.uuid.value;
  }

  /** Force a NEW identity — the FILE-IMPORT and save-as-copy rule (QO81): a file's own uuid
   *  is provenance, never adopted as a store key, so importing twice yields two entries and
   *  can never silently overwrite a saved driver. */
  mintFreshUuid(): string {
    this.#record.uuid.value = crypto.randomUUID();
    return this.#record.uuid.value;
  }

  toOwdrJson(): string {
    return JSON.stringify(this.toJsonRecord(), null, 2);
  }

  /** This driver → `openisd.yml` text — the YAML-serialised twin of `toOwdrJson()`, same
   *  record, run through the `yaml` package's `stringify()` instead of `JSON.stringify()`. */
  toOwdrYml(): string {
    return stringify(this.toJsonRecord());
  }

  /** The section this driver's T/S fields live in — `specs.woofer` for anything that is
   *  neither a tweeter nor a passive radiator. */
  get section(): 'woofer' | 'tweeter' | 'passive-radiator' { return this.#section; }

  #specs(): SpecSection {
    if (!this.#record.specs) this.#record.specs = {};
    const s = this.#record.specs[this.#section] ?? {};
    this.#record.specs[this.#section] = s;
    return s;
  }

  #entry(field: SpecField): SpecEntry | undefined {
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
   *  (`SpecSection.EBP`, ParState slot 33) with its own engine derivation route
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
   *  — the `ScrapedField<string>` envelope's own `cell()`. No `C` state: nothing computes
   *  a brand. An empty value (never stated, or cleared to nothing) reads `N`. */
  metaCell(field: MetaField): MetaCell {
    const f = this.#record[field];
    if (f?.value && f.value.length > 0) return { value: f.value, state: Provenance.Entered, origin: f.origin };
    return { value: '', state: Provenance.NotAvailable };
  }

  /** `series`/`product_image`/`driver_type` — record-level metadata the picker reads (for the
   *  preview pane, and for classifying the row into its type chips) but the editor does not
   *  expose for editing, so they sit outside `MetaField`. Empty when unstated. */
  previewField(field: 'series' | 'product_image' | 'driver_type'): string {
    const f = this.#record[field];
    return f?.value && f.value.length > 0 ? f.value : '';
  }

  /** This record's provenance index — the URL a `SourceRole` was read from, empty when that
   *  role never contributed to this record. A datasheet/product-page link is not a driver
   *  FIELD, so it lives here rather than through `cell()`/`metaCell()`. */
  dataSourceUrl(role: SourceRole): string {
    return this.#record.data_sources.value[role] ?? '';
  }

  /** Overlay catalogue link fields (datasheet/product-page URLs) that live in the library
   *  index, not in the record itself, onto this driver's own provenance index — used when
   *  adopting a library row so those links are not lost on load. Only a non-empty URL
   *  overwrites; an absent role leaves whatever this driver already carries for it alone. */
  withDataSourceLinks(links: Partial<Record<SourceRole, string>>): void {
    for (const [role, url] of Object.entries(links) as [SourceRole, string][]) {
      if (url) this.#record.data_sources.value[role] = url;
    }
  }

  /** What this record is CALLED: `<brand> <model>`, the identity a saved driver is filed under
   *  and the name it reads by everywhere. `'Driver'` when it states neither. */
  displayName(): string {
    const brand = this.metaCell('brand').value;
    const model = this.metaCell('model').value;
    return [brand, model].filter(x => x.length > 0).join(' ').trim() || 'Driver';
  }

  /** Blank the DERIVED identity fields (`sku`, `name`) — used when forking this driver into a
   *  new entry (Clone): the pipeline built these for THIS driver, and a fork is a different
   *  driver until something derives its own. `sku` is required on the record, so it is blanked
   *  rather than removed; `name` is optional and is dropped outright. */
  resetDerivedIdentity(): void {
    this.#record.sku = { value: '', definition: 'canonical identity code', grounds: [] };
    delete this.#record.name;
  }

  /** The built canonical identity code — `DerivedField`, so there is no provenance to report,
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

  /** This record's own standing evidence — `recordStandingIsOk` (`driverStanding.ts`)'s input,
   *  flat plain data rather than the `quality` envelope itself. */
  standingEvidence(): StandingEvidence {
    return { missing: this.#record.quality.missing, parse_errors: this.#record.quality.parse_errors };
  }

  /**
   * Every `[DQ]` mark this record carries, in record order: the metadata fields first (their
   * own declared order below), then this driver's OWN T/S section (`SpecSection`'s declared
   * key order) — the exact traversal a `.wdr`'s `[DQ]` comment lines are built from. Exposes
   * only a flat, plain-data list (field name, the value the mark is about, the mark itself) —
   * never the raw `SpecEntry`/`ScrapedField` envelope a mark lives in.
   */
  dqMarks(): { field: string; value: number | string; mark: DqMark }[] {
    const out: { field: string; value: number | string; mark: DqMark }[] = [];
    const metaFields: (keyof OpenISDDriverJson)[] = [
      'manufacturer', 'brand', 'model', 'series', 'driver_type', 'nominal_size_cm',
      'product_image', 'description', 'surround_material',
    ];
    for (const key of metaFields) {
      const f = this.#record[key] as ScrapedField<string | number> | undefined;
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
   * Record a hand-entered metadata value — the ScrapedField equivalent of `enter()`
   * (QO36 B3/B4 apply the same way, on the other envelope). An empty string routes to
   * `clearMeta()`, matching how a blank text input behaves everywhere else in the editor.
   * The value/origin the field carried before the FIRST manual override is snapshotted so
   * `clearMeta()` can restore it — `readings`/`definition`/`dq` are left untouched, since
   * `ScrapedField`'s number is `.value` directly, never looked up via `readings`.
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
  }

  #invalidate(): void {
    this.#cache = null;
    this.#issues = null;
  }
}

/**
 * Structural problems that make a record unusable, empty when it is sound.
 *
 * The record types are TypeScript, which is a compile-time promise about code WE wrote. A blob
 * arriving from localStorage, a share link or a file is data someone else wrote — possibly an
 * older build of this app, possibly a hand-edited string — and `x as OpenISDDriverJson` is an
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

