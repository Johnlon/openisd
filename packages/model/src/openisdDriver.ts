/**
 * `OpenISDDriver` — the stateful driver model the app holds (ARCHITECTURE.md AD-8).
 *
 * This is the app's ONE driver model. It owns an `OpenISDRecord` and answers three
 * questions about every field: what is its value, where did that value come from, and
 * what does the engine say is wrong with the driver as a whole.
 *
 * `.wdr`/`.wpr` do not appear here. WinISD is a CONSUMER of our files and a reference
 * oracle, not our model — everything about that format (ParState, the 49 slots, the
 * carried-key set, VCCon's 1/2 encoding) lives behind the serialisers in `@openisd/winisd`,
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
  OpenISDRecord, SpecEntry, SpecSection, SourceRole, Reading,
} from './openisdRecord.js';
import { deriveDriver, checkConsistency, RHO, C } from '@openisd/engine';
import type {
  DriverError, DriverRaw, Driver as EngineDriver, ConsistencyIssue,
} from '@openisd/engine';

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

/** A field of `SpecSection` — the closed canonical allowlist, not an open string. */
export type SpecField = keyof SpecSection;

/**
 * The record-level metadata fields a live edit can touch — the `ScrapedField<string>`
 * envelope, distinct from `SpecField`'s `SpecEntry` envelope (openisdRecord.ts's four-kind
 * split). Not `sku`/`name` (`DerivedField` — built, not read) and not `uuid` (`BookkeepingField`
 * — a pipeline fact, never hand-edited).
 */
export type MetaField = 'brand' | 'model' | 'manufacturer';

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
function sectionFor(record: OpenISDRecord): 'woofer' | 'tweeter' | 'passive_radiator' {
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
const TO_ENGINE: Partial<Record<SpecField, string>> = { BL: 'Bl' };
const FROM_ENGINE: Record<string, SpecField> = { Bl: 'BL' };

function engineName(f: SpecField): string { return TO_ENGINE[f] ?? f; }
function specName(e: string): SpecField { return FROM_ENGINE[e] ?? (e as SpecField); }

export class OpenISDDriver {
  /** The record as it stands, including any manual readings entered since load. */
  readonly #record: OpenISDRecord;
  /** The section every T/S field of this driver lives in — fixed by driver_type. */
  readonly #section: 'woofer' | 'tweeter' | 'passive_radiator';
  /** The origin that won before a manual reading displaced it, so clear() can restore it. */
  readonly #displaced = new Map<SpecField, SourceRole>();
  /** The {value, origin} a MetaField carried before a manual override, so clearMeta() can
   *  restore it — the ScrapedField equivalent of #displaced. */
  readonly #displacedMeta = new Map<MetaField, { value: string; origin: SourceRole }>();
  /** Memoised solve; dropped on every mutation. */
  #cache: { fields: Record<string, number>; errors: DriverError[] } | null = null;
  /** Memoised consistency verdict; dropped alongside #cache. */
  #issues: ConsistencyIssue[] | null = null;
  /** Whether a derivable (never-stated) field solves to `C`. Off: it reads `N` — nothing is
   *  solved, only what is stated is validated. */
  #autoCalculate = true;
  readonly #listeners = new Set<DriverListener>();

  private constructor(record: OpenISDRecord) {
    this.#record = record;
    this.#section = sectionFor(record);
  }

  static fromRecord(record: OpenISDRecord): OpenISDDriver {
    return new OpenISDDriver(record);
  }

  /** The record, including every manual reading entered. This is the `.owdr` bytes. */
  toRecord(): OpenISDRecord { return this.#record; }

  /** The section this driver's T/S fields live in — `specs.woofer` for anything that is
   *  neither a tweeter nor a passive radiator. */
  get section(): 'woofer' | 'tweeter' | 'passive_radiator' { return this.#section; }

  #specs(): SpecSection {
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
      if (typeof v === 'number' && isFinite(v)) out[engineName(k)] = v;
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

  /**
   * Record a hand-entered value. It becomes the winning reading under the `manual` role,
   * carrying the value alone — see the B3 ruling in this file's header. Any reading the
   * record already held is KEPT: a `readings` dict is the whole point, and the displaced
   * origin is what `clear()` restores.
   */
  enter(field: SpecField, value: number): void {
    const specs = this.#specs();
    const existing = specs[field];
    const manual: Reading = { read_value: value };

    if (existing) {
      if (existing.origin !== 'manual') this.#displaced.set(field, existing.origin);
      existing.readings.manual = manual;
      existing.origin = 'manual';
    } else {
      specs[field] = { origin: 'manual', readings: { manual }, dq: [] };
    }
    this.#invalidate();
  }

  /**
   * Drop a hand-entered value. The reading the record arrived with wins again; if there was
   * none, the field returns to being solved or absent. Clearing a field that was never
   * entered by hand does nothing.
   */
  clear(field: SpecField): void {
    const specs = this.#specs();
    const entry = specs[field];
    if (!entry || entry.origin !== 'manual') return;

    delete entry.readings.manual;
    const displaced = this.#displaced.get(field);
    if (displaced && entry.readings[displaced]) {
      entry.origin = displaced;
      this.#displaced.delete(field);
    } else {
      delete specs[field];
    }
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
   *  — the `ScrapedField<string>` envelope's own `cell()`. No `C` state: nothing computes
   *  a brand. An empty value (never stated, or cleared to nothing) reads `N`. */
  metaCell(field: MetaField): MetaCell {
    const f = this.#record[field];
    if (f.value && f.value.length > 0) return { value: f.value, state: 'E', origin: f.origin };
    return { value: '', state: 'N' };
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
