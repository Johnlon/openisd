/**
 * `OpenISDDriver` — the stateful driver model the app holds.
 *
 * This is the app's ONE driver model. It owns a `_OpenISDDriverJson` record and answers three
 * questions about every field: what is its value, where did that value come from, and
 * what does the engine say is wrong with the driver as a whole.
 *
 * `.wdr`/`.wpr` do not appear here. WinISD is a CONSUMER of our files and a reference
 * oracle, not our model — everything about that format (ParState, the 49 slots, the
 * 48-key order, VCCon's 1/2 encoding) lives behind the serialisers in `@openisd/winisd`,
 * which depends on this package and is invisible from here.
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
import { winningReading } from './openisdRecord.js';
import type {
  _SpecEntry, _SpecSection, _Specs, SourceRole, Reading,
  _ScrapedField, _DerivedField, _BookkeepingField, DispositionField, QualityBlock, CurvesBlock,
} from './openisdRecord.js';
import { deriveDriver, checkConsistency, RHO, C, ebp as computeEbp } from '@openisd/engine';
import type {
  DriverError, DriverRaw, Driver as EngineDriver, ConsistencyIssue,
} from '@openisd/engine';

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
  'ui/src/logic/openIsdDriverFileIo.ts', // the OpenISD file-io class
  'ui/src/logic/store.ts',               // the store
];

/** What `cell()` answers: the number, and where it came from. */
export type CellState = 'E' | 'C' | 'N';
export interface Cell {
  /** SI value, or null when the field is neither stated nor derivable. */
  value: number | null;
  state: CellState;
  /** The winning source, present only for a stated value. `manual` means hand-entered. */
  origin?: SourceRole;
}

export type DriverListener = () => void;

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
  state: 'E' | 'N';
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

/**
 * Record field name → the name the engine solver uses, where the two genuinely differ.
 * This is the ONE place that translation happens, and it exists because the engine
 * predates the record: `BL` is the record's spelling of the engine's `Bl`. It is not an
 * alias on our own field — the record has exactly one name for it, and so does the engine.
 */
const TO_ENGINE: Partial<Record<SpecField, string>> = {
  BL: 'Bl',
  // The record names its dimensions in millimetres and STATES them in millimetres; the engine
  // works in SI metres throughout. Both are internally consistent, so the conversion belongs
  // here, at the one join between them — omitting it is not a rounding error, it makes the
  // field invisible to the engine under a name it never reads.
  // bugs/BUG_20260814_openisddriver-passes-mm-named-dimension-fields-to-the-engine-untranslated-and-unscaled.md
  Hc_mm: 'Hc', Hg_mm: 'Hg', voice_coil_dia_mm: 'Vcd',
  thick_mm: 'Thick', depth_mm: 'Depth', magnet_depth_mm: 'MagDepth',
  magnet_dia_mm: 'Magnet', basket_dia_mm: 'Basket', outer_dia_mm: 'Outer',
  driver_volume_l: 'DVol',
};
const FROM_ENGINE: Record<string, SpecField> = { Bl: 'BL' };

/** SI value = stated value × this. 1 where the record already states SI, 1e-3 for a field the
 *  record names and states in millimetres (or, for `driver_volume_l`, in litres). Same pairs
 *  the serialiser declares in `SPEC_TO_WDR`; this is the model side of the identical join. */
const TO_ENGINE_SCALE: Partial<Record<SpecField, number>> = {
  Hc_mm: 1e-3, Hg_mm: 1e-3, voice_coil_dia_mm: 1e-3,
  thick_mm: 1e-3, depth_mm: 1e-3, magnet_depth_mm: 1e-3,
  magnet_dia_mm: 1e-3, basket_dia_mm: 1e-3, outer_dia_mm: 1e-3,
  driver_volume_l: 1e-3,
};

function engineName(f: SpecField): string { return TO_ENGINE[f] ?? f; }
function engineScale(f: SpecField): number { return TO_ENGINE_SCALE[f] ?? 1; }
function specName(e: string): SpecField { return FROM_ENGINE[e] ?? (e as SpecField); }

export class OpenISDDriver {
  /** The record as it stands, including any manual readings entered since load. */
  readonly #record: _OpenISDDriverJson;
  /** The section every T/S field of this driver lives in — fixed by driver_type. */
  readonly #section: 'woofer' | 'tweeter' | 'passive_radiator';
  /** The {value, origin} a MetaField carried before a manual override, so clearMeta() can
   *  restore it. */
  readonly #displacedMeta = new Map<MetaField, { value: string; origin: SourceRole }>();
  /** Memoised solve; dropped on every mutation. */
  #cache: { fields: Record<string, number>; errors: DriverError[] } | null = null;
  /** Memoised consistency verdict; dropped alongside #cache. */
  #issues: ConsistencyIssue[] | null = null;
  /** Whether a derivable (never-stated) field solves to `C`. Off: it reads `N` — nothing is
   *  solved, only what is stated is validated. */
  #autoCalculate = true;
  readonly #listeners = new Set<DriverListener>();

  private constructor(record: _OpenISDDriverJson) {
    this.#record = record;
    this.#section = sectionFor(record);
  }

  static fromRecord(record: _OpenISDDriverJson): OpenISDDriver {
    return new OpenISDDriver(record);
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
  toRecord(): _OpenISDDriverJson { return this.#record; }

  /** The section this driver's T/S fields live in — `specs.woofer` for anything that is
   *  neither a tweeter nor a passive radiator. */
  get section(): 'woofer' | 'tweeter' | 'passive_radiator' { return this.#section; }

  #specs(): _SpecSection {
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
      if (typeof v === 'number' && isFinite(v)) out[engineName(k)] = v * engineScale(k);
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
   *  as-is. Matches deriveOpenISDFields' own air-constant backfill (a driver always has SOME
   *  air, solved or not) but skips its SPL-from-efficiency step, which needs a solved `no`. */
  #deriveEnteredOnly(): { fields: Record<string, number>; errors: DriverError[] } {
    const stated = { ...this.#stated() };
    if (stated.c == null) stated.c = C;
    if (stated.roo == null) stated.roo = RHO;
    const { errors } = deriveDriver(stated as unknown as DriverRaw);
    return { fields: stated, errors };
  }

  /**
   * The value and its provenance. A stated reading — from a datasheet or from the keyboard
   * — is `E`; a solver result is `C`; neither is `N`.
   */
  cell(field: SpecField): Cell {
    const entry = this.#entry(field);
    if (entry) {
      return { value: winningReading(entry).read_value, state: 'E', origin: entry.origin };
    }
    const v = this.#derived().fields[engineName(field)];
    if (typeof v === 'number' && isFinite(v)) return { value: v, state: 'C' };
    return { value: null, state: 'N' };
  }

  /** Efficiency Bandwidth Product (Fs/Qes) — WinISD: EBP. Not a stored `SpecField`: it is
   *  read-only everywhere, computed straight from this driver's own Fs/Qes cells, so it has
   *  no ENTERED/CALCULATED distinction of its own to carry. Null when either is unknown. */
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
   * issue means nothing can be drawn — the same guard `deriveDriver` itself enforces.
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
   * The consistency groups (WDR_SCHEMA §4) whose STATED members contradict each other
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
    if (f?.value && f.value.length > 0) return { value: f.value, state: 'E', origin: f.origin };
    return { value: '', state: 'N' };
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

export { specName };

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
  return OpenISDDriver.fromRecord(record).cell(field);
}

/** One metadata field, read straight off a RECORD. Same reasoning as `readCell`. */
export function readMetaCell(record: _OpenISDDriverJson, field: MetaField): MetaCell {
  return OpenISDDriver.fromRecord(record).metaCell(field);
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
 *  `OpenISDDriver.empty().toRecord()` at the call site, so a caller needing a blank record does
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

export function emptyDriverRecord(): _OpenISDDriverJson {
  return OpenISDDriver.empty().toRecord();
}
