/* OBSOLETE: This class has no remaining architectural role once OpenISDDriver takes its job
 * — it is WinISD's data model wearing a neutral name, not openisd.yml's. Do NOT maintain,
 * extend, or add behavior to this class — a same-session attempt to patch a feature onto it
 * (a "DriverSession" auto-clear wrapper) was built and fully reverted for exactly this
 * reason; see docs/design/STATE_MODEL.md's note. Any change here must be made with the
 * specific intent of decommissioning it — migrating a call site off it onto OpenISDDriver,
 * or deleting a now-dead reference — never to fix or improve it in place. Its derivation
 * algorithms move onto OpenISDDriver, per docs/plans/PLAN_OPENISD_DRIVER_MODEL.md. */
/**
 * Driver ADT — the E/C/N provenance model (docs/design/DRIVER_ADT_DESIGN.md).
 *
 * The ONLY mutation path is enter/clear, so E/C/N can never drift out of sync with the
 * values: you cannot set a value without its mark updating, and there is no way to set a
 * mark directly. `#inputs` (presence ⇒ Entered) is the single mutable fact stored; every
 * Computed value and the whole E/C/N view is derived from it via the engine's physics.
 *
 * Reactivity is framework-free: the class carries its own `subscribe` observer, fired by
 * enter/clear. It does NOT import Vue or any UI framework — @openisd/winisd is a lower
 * layer than the UI; dependency arrows point up only. A Vue
 * binding lives in the UI layer and subscribes to a Driver; the Driver never knows Vue
 * exists.
 */

import { deriveDriver, solveConsistencyGroup, checkConsistency, splFromEfficiency, ebp, C, RHO } from '@openisd/engine';
import type { DriverRaw, Driver as EngineDriver, DriverError, ConsistencyIssue } from '@openisd/engine';
import { MODELED_SLOTS, MODELED_BY_WDRKEY, POS_TO_WDRKEY } from './parstate.js';
import type { CellState } from './parstate.js';
import { WinISDDriver, WDR_NUMERIC_KEYS } from './winisdDriver.js';
import type { WdrCell } from './winisdDriver.js';

export type { CellState } from './parstate.js';

/**
 * A field's value, edit-state, and error as one tied tuple — always from the same
 * derivation pass, so they cannot drift. This is the ONLY per-field accessor.
 */
export interface FieldCell {
  value: number | string | undefined;
  state: CellState;
  error?: DriverError;
}

/** A change listener; receives no args — read the Driver after notification. */
export type DriverListener = () => void;

/**
 * The Driver's complete serialisable state — the entered bag plus, for a WDR-loaded
 * driver, the carried pass-through fields and source ParState. This is what persistence
 * (localStorage / share-link / project JSON) stores so provenance AND carried fields
 * survive a reload/share, exactly as they survive a .wdr round-trip.
 */
export interface DriverJSON {
  inputs: Record<string, number | string>;
  carry?: { order: string[]; raw: Record<string, string>; parState?: string };
}

interface Derivation {
  /** Resolved SI values for every derivable field (core T/S + Dia/Vd/η₀/SPL/c/roo). */
  fields: Record<string, number>;
  /** The entered numerics the resolution started from, in engine field names. */
  entered: Record<string, number>;
  errors: DriverError[];
}

// Per-field error aliases: an error filed by the engine under `errorField` also surfaces
// on these cells. Sd's requirement shows on the cone-diameter cell; the "need two Q"
// completeness error (filed under Qts) shows on all three Q cells.
const ERROR_ALIASES: Record<string, string[]> = {
  Sd:  ['Dia'],
  Qts: ['Qms', 'Qes'],
};

// WDR file key → app field, for the carried (non-simulated) fields. On import they are
// marked E and survive to raw()/re-save the same way the design's "carried pass-through
// fields" do. `name` is composed from Brand + Model (as parseWdr did).
//
// The LEFT column is WinISD's spelling and nothing else. A key WinISD does not write is a
// line WinISD ignores, so a value put there is lost on export AND contradicted by WinISD's
// own line for the same quantity, which would be echoed back unchanged. The pairings come
// from the single-parameter probes in `drivers/sample/winisd/` (`s-*.wdr` — one field set,
// one new `E` in ParState), catalogued in `drivers/sample/README.md`.
//
// `Xlim` is the one entry with no WinISD key: WinISD holds it in ParState slot 10 only
// (`s-xlim.wdr` writes no `Xlim=` line). It stays here so the value survives openisd's own
// round-trip, and is never injected into a file that lacks it.
const WDR_META: ReadonlyArray<[string, string]> = [
  ['Brand', 'brand'],
  ['Model', 'model'],
  ['Manufacturer', 'manufacturer'],
  ['ProvidedBy', 'providedBy'],
  ['Comment', 'comment'],
  ['Xlim', 'Xlim'],
  ['Hc', 'Hc'],
  ['Hg', 'Hg'],
  ['numVC', 'numVC'],
  ['VCCon', 'VCCon'],
  ['alfaVC', 'tc'],
  ['Rt', 'Rth'],
  ['Ct', 'Cth'],
  ['Gloss', 'loss'],
  ['Thick', 'thick'],
  ['Depth', 'depth'],
  ['MagDepth', 'magnetDepth'],
  ['Magnet', 'magnet'],
  ['Basket', 'basket'],
  ['Outer', 'outer'],
  ['Vcd', 'VCd'],
  ['DVol', 'basketDisplacement'],
  ['fLe', 'fLe'],
  ['KLe', 'Le2'],
  ['DateAdded', 'added'],
];

// Carried fields whose WDR value is a NUMBER, not text. They are parsed on import so the
// model holds one shape per field: the editor writes them back as numbers, and a field
// that is a string on load and a number after an edit is two shapes of one concept.
const WDR_META_NUMERIC = new Set([
  'Xlim', 'Hc', 'Hg', 'numVC', 'VCCon', 'tc', 'Rth', 'Cth', 'loss',
  'thick', 'depth', 'magnetDepth', 'magnet', 'basket', 'outer', 'VCd',
  'basketDisplacement', 'fLe', 'Le2',
]);

// Format a cell value back to a WDR value string. `String(x)` is the shortest text that
// reparses to the identical double, so an overlaid value is bit-for-bit what was read —
// which is what a genuine WinISD save carries (~15 significant figures).
function fmtNum(x: number | string | undefined): string {
  if (typeof x === 'number' && isFinite(x)) return String(x);
  if (typeof x === 'string') return x;
  return '';
}

export class Driver {
  // The one non-derivable fact: what the human entered. Presence ⇒ state E.
  readonly #inputs: Record<string, number | string> = {};
  // Memoised derivation; invalidated (→ null) on every mutation.
  #cache: Derivation | null = null;
  // Memoised consistency verdict; costs one extra solve per entered field, so it is only
  // computed when something asks for it, and dropped alongside #cache on every mutation.
  #issues: ConsistencyIssue[] | null = null;
  #autoCalculate = true;
  readonly #listeners = new Set<DriverListener>();

  /** Whether Computed (C) fields auto-derive from what's Entered. Off leaves them N. */
  get autoCalculate(): boolean { return this.#autoCalculate; }
  set autoCalculate(val: boolean) {
    if (this.#autoCalculate !== val) {
      this.#autoCalculate = val;
      this.#invalidate();
    }
  }

  // ── round-trip carry (set only when built via fromWdr) ────────────────────────
  // Every [Driver] key read from the source .wdr, in file order, with its raw value —
  // so passthrough fields OpenISD does not model (dimensions, thermal, metadata) survive
  // export unchanged. The source ParState seeds non-modeled slots; modeled slots are
  // always rebuilt live from cell().state.
  #wdrOrder: string[] | null = null;
  #wdrRaw: Record<string, string> | null = null;
  #parStateIn: string | undefined = undefined;

  /** Human input → the field becomes Entered (E). Empty value routes to clear. */
  enter(field: string, value: number | string | undefined | null): void {
    if (value === undefined || value === null || value === '') { this.clear(field); return; }
    // Delete-then-reinsert so JS object key order tracks RECENCY (this field becomes the
    // newest), which #dropOldestGroupMember relies on to find the oldest sibling.
    if (field in this.#inputs) delete this.#inputs[field];
    this.#inputs[field] = value;
    if (field === 'brand' || field === 'model' || field === 'manufacturer') {
      delete this.#inputs.name;
    }
    this.#invalidate();
  }

  /** Drop the human value → the field reverts to Computed (C) if derivable, else N. */
  clear(field: string): void {
    delete this.#inputs[field];
    if (field === 'brand' || field === 'model' || field === 'manufacturer') {
      delete this.#inputs.name;
    }
    this.#invalidate();
  }

  /** The single per-field read: value + E/C/N state + that field's error, all in sync. */
  cell(field: string): FieldCell {
    const { fields, errors } = this.#derive();
    const error = this.#errorFor(field, errors);
    if (field in this.#inputs) {
      return { value: this.#inputs[field], state: 'E', error };
    }
    const dv = fields[field];
    if (typeof dv === 'number' && isFinite(dv)) {
      return { value: dv, state: 'C', error };
    }
    return { value: undefined, state: 'N', error };
  }

  /** Whole-driver issue list — the Apply gate and the summary read this. */
  errors(): DriverError[] {
    return this.#derive().errors;
  }

  /**
   * The consistency groups (WDR_SCHEMA §4) whose members contradict each other beyond their
   * own precision. Every member of a reported group carries the mark; nothing is blocked by
   * one — an inconsistent driver still simulates, still saves, still exports.
   */
  consistencyIssues(): ConsistencyIssue[] {
    return this.#issues ??= checkConsistency(this.#derive().entered);
  }

  /**
   * The entered bag back out — every human-supplied value (T/S numerics + carried
   * metadata strings), keyed by app field name. Computed (C) fields are deliberately
   * excluded: raw() is "what was entered", so re-saving it (My Drivers, project JSON)
   * never mistakes a derived value for one the human typed. For the fully-derived set
   * used by the simulation, use toDriver().
   */
  raw(): DriverRaw {
    return { ...this.#inputs } as unknown as DriverRaw;
  }

  /**
   * The fully-derived engine Driver for the simulation — the resolved T/S set with
   * fixed-E overrides honoured (this is the single derivation authority; the sim must
   * consume it, not re-derive). Null when a blocking error means nothing can be drawn.
   */
  toDriver(): EngineDriver | null {
    const { fields, errors } = this.#derive();
    if (errors.some(e => e.level === 'error')) return null;
    return fields as unknown as EngineDriver;
  }

  /**
   * The complete serialisable state — the entered bag plus any carried WDR fields and
   * source ParState. Lossless with fromJSON, so persistence preserves provenance AND the
   * pass-through fields raw() drops (dimensions, thermal, Hc/Hg, the original ParState).
   */
  toJSON(): DriverJSON {
    const j: DriverJSON = { inputs: { ...this.#inputs } };
    if (this.#wdrOrder && this.#wdrRaw) {
      j.carry = { order: [...this.#wdrOrder], raw: { ...this.#wdrRaw } };
      if (this.#parStateIn !== undefined) j.carry.parState = this.#parStateIn;
    }
    return j;
  }

  /** Rebuild a Driver from toJSON() output — the inverse, lossless. */
  static fromJSON(j: DriverJSON): Driver {
    const d = new Driver();
    for (const [k, v] of Object.entries(j.inputs ?? {})) {
      if (typeof v === 'number' || typeof v === 'string') d.#inputs[k] = v;
    }
    if (j.carry) {
      d.#wdrOrder    = [...j.carry.order];
      d.#wdrRaw      = { ...j.carry.raw };
      d.#parStateIn  = j.carry.parState;
    }
    d.#cache = null;
    return d;
  }

  /** Register a change listener; returns an unsubscribe function. */
  subscribe(listener: DriverListener): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  // ── WDR round-trip ────────────────────────────────────────────────────────────

  /**
   * Build a Driver from a plain DriverRaw bag (My Drivers, a saved project's driver,
   * the built-in demo). Every present field — T/S numerics and metadata strings alike —
   * is entered (E); undefined/null/'' are skipped so they stay N. The inverse of raw().
   */
  static fromRaw(raw: DriverRaw): Driver {
    const d = new Driver();
    // Object.entries iterates a typed object without needing an index signature; the
    // guard skips undefined/null optional fields and empty strings so they stay N.
    for (const [k, v] of Object.entries(raw)) {
      if ((typeof v === 'number' || typeof v === 'string') && v !== '') d.#inputs[k] = v;
    }
    d.#cache = null;
    return d;
  }

  /**
   * Parse a WinISD .wdr — reads EVERY [Driver] key and the ParState, carrying them so
   * export is lossless, and replays the ParState E-marks via enter() so provenance is
   * captured (not guessed). C/N fields are skipped: the app recomputes C, N stays absent.
   */
  static fromWdr(text: string): Driver {
    const d = new Driver();
    const order: string[] = [];
    const raw: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i < 0 || line[0] === '[') continue;
      const key = line.slice(0, i).trim();
      const val = line.slice(i + 1).trim();
      if (key === 'ParState') { d.#parStateIn = val; continue; }
      order.push(key);
      raw[key] = val;
    }

    // The keys the FILE actually stated. The backfill below adds more to `order`/`raw` so the
    // export emits every key WinISD expects, and after it runs presence in `raw` no longer
    // distinguishes "the file said this" from "we invented this for export". Only a key in
    // this set may become an entered (E) value.
    const fromFile = new Set(order);

    // Ensure the keys a genuine WinISD save always carries exist in order and raw, so they
    // are serialized on export even when the source file omitted them. Every key here is
    // one WinISD writes; the default is the value WinISD writes when nothing is set
    // (`drivers/sample/winisd/john-all-defaults.wdr`) — 0 for a numeric, not a blank line.
    const STANDARD_TEXT_KEYS = ['Comment', 'Manufacturer', 'Model', 'Brand'];
    const STANDARD_NUMERIC_KEYS = [
      'Hc', 'Hg', 'alfaVC', 'Rt', 'Ct', 'Gloss',
      'Thick', 'Depth', 'MagDepth', 'Magnet', 'Basket', 'Outer', 'Vcd', 'DVol',
      'fLe', 'KLe',
    ];
    for (const key of [...STANDARD_TEXT_KEYS, ...STANDARD_NUMERIC_KEYS, 'ProvidedBy', 'numVC', 'VCCon']) {
      if (order.includes(key)) continue;
      order.unshift(key);
      raw[key] = key === 'ProvidedBy' ? 'OpenISD'
        : key === 'numVC' || key === 'VCCon' ? '1'
        : STANDARD_NUMERIC_KEYS.includes(key) ? '0'
        : '';
    }

    d.#wdrOrder = order;
    d.#wdrRaw = raw;

    // Replay E marks for the modeled T/S fields. With a ParState, trust it exactly; if a
    // file lacks one, fall back to presence (a value present ⇒ entered).
    const ps = d.#parStateIn;
    for (const m of MODELED_SLOTS) {
      const isE = ps ? ps[m.pos] === 'E' : raw[m.wdrKey] != null;
      if (!isE) continue;
      const v = parseFloat(raw[m.wdrKey]);
      if (isFinite(v)) d.#inputs[m.field] = v;   // direct: constructing state, no notify
    }

    // Carry the header metadata (brand/model/providedBy/comment + composed name) into
    // the entered bag so raw() exposes it uniformly, whether the Driver came from a WDR
    // or a plain DriverRaw. This does not touch toWdr (which reads cell() for every slot)
    // or ParState directly.
    for (const [wdrKey, field] of WDR_META) {
      if (!fromFile.has(wdrKey)) continue;   // a backfilled default is not a stated value
      const v = raw[wdrKey];
      if (v == null || v === '') continue;
      if (WDR_META_NUMERIC.has(field)) {
        // A present value is not necessarily ENTERED — WinISD writes 0 as its own default
        // for an unset numeric field, and computes some carried fields (Gloss) itself. Where
        // this key has a ParState slot, trust the source's own mark exactly like the T/S
        // replay above; with no source ParState, presence is the only signal there is.
        // bugs/BUG_20260814_driver-fromwdr-marks-a-present-zero-or-computed-carried-field-entered-ignoring-the-source-parstate.md
        const pos = POS_TO_WDRKEY.indexOf(wdrKey);
        const isE = pos < 0 || !ps ? true : ps[pos] === 'E';
        if (!isE) continue;
        const n = parseFloat(v);
        if (isFinite(n)) d.#inputs[field] = n;
      } else {
        d.#inputs[field] = v;
      }
    }
    const name = [raw.Brand, raw.Model].filter(x => x && x.length).join(' ').trim();
    if (name) d.#inputs.name = name;

    d.#cache = null;
    return d;
  }

  /**
   * Serialise to WinISD .wdr text. One path regardless of provenance (loaded from a .wdr,
   * or authored fresh via fromRaw/enter): every WDR-tracked key is read live through
   * cell(field), so a key's value AND its E/C/N mark always come from the same derivation
   * pass. The FORMAT itself (key order, WinISD's own defaults, the 49-slot ParState) is
   * `WinISDDriver`'s job (ARCHITECTURE.md §3) — this method only resolves, per WDR key,
   * which of THIS Driver's own field names answers for it.
   *
   * This is what fixed
   * bugs/BUG_20260813_parstate-writer-emits-n-for-the-34-slots-the-driver-does-not-model.md:
   * every one of WinISD's 49 tracked slots now gets its mark from live cell().state, not a
   * hardcoded 15-field subset with the rest echoed (or, with no source ParState at all,
   * left N).
   */
  toWdr(): string {
    const cells = new Map<string, WdrCell>();
    for (const key of WDR_NUMERIC_KEYS) {
      const field = MODELED_BY_WDRKEY[key]?.field ?? (WDR_META.find(p => p[0] === key)?.[1] ?? key);
      const c = this.cell(field);
      if (c.value !== undefined) {
        cells.set(key, { value: fmtNum(c.value), state: c.state });
        continue;
      }
      // No value at all — neither entered nor derivable by anything @openisd/engine models.
      // A carried WDR key still surviving in #wdrRaw (WinISD computed it by a route this app
      // has no formula for — e.g. KLe from fLe, Hg from motor geometry) is passthrough:
      // ARCHITECTURE.md §3 "No import loses data" means the NUMBER survives even where its
      // mark honestly stays N (openisd cannot claim E or C for a value it cannot derive).
      const raw = this.#wdrRaw?.[key];
      if (raw != null) cells.set(key, { value: raw, state: 'N' });
      // else: WinISDDriver supplies WinISD's own default for this key.
    }
    const h = (field: string): string | undefined => {
      const v = this.cell(field).value;
      return v === undefined ? undefined : fmtNum(v);
    };
    const header = {
      brand: h('brand'), model: h('model'), manufacturer: h('manufacturer'),
      providedBy: h('providedBy'), comment: h('comment'), dateAdded: h('added'),
      // No Driver field models "date modified" — it is pure carried passthrough, echoed
      // straight from the source .wdr (undefined for a fresh-authored driver, matching
      // WinISD's own blank on New).
      dateModified: this.#wdrRaw?.DateModified,
    };
    return WinISDDriver.build(header, cells).toWdr();
  }

  // ── internal ────────────────────────────────────────────────────────────────

  #invalidate(): void {
    this.#cache = null;
    this.#issues = null;
    // Copy so a listener that unsubscribes mid-notify does not disturb iteration.
    for (const fn of [...this.#listeners]) fn();
  }

  #derive(): Derivation {
    if (this.#cache) return this.#cache;

    // Start from the entered SI numerics. `Dia` is this class's own name for the
    // engine's `Dd` — translate it going in and out so solveConsistencyGroup (which
    // only knows `Dd`) still sees/produces it under this class's field name.
    const entered: Record<string, number> = {};
    for (const k in this.#inputs) {
      const v = this.#inputs[k];
      if (typeof v === 'number' && isFinite(v)) entered[k] = v;
    }
    if (entered.Dia != null && entered.Dd == null) entered.Dd = entered.Dia;

    // The single derivation authority for the core T/S consistency group — the UI must
    // not re-implement any of it. `== null` guards inside it mean an entered (E) value
    // is never overwritten by a computed one and instead feeds downstream — WinISD's
    // fixed-E override semantics.
    const r = this.#autoCalculate
      ? (solveConsistencyGroup(entered, { full: true }) as Record<string, number>)
      : { ...entered };

    if (r.Dia == null && r.Dd != null) r.Dia = r.Dd;

    // Air constants autofill (state C) until overridden — matches the sim's constants.
    if (r.c == null) r.c = C;
    if (r.roo == null) r.roo = RHO;

    if (this.#autoCalculate) {
      // η₀ and SPL through the ONE implementation in @openisd/engine, evaluated at this
      // driver's own air. solveConsistencyGroup already fills `no`/`SPLref`; `SPL` is the
      // `.wdr` spelling of the same quantity.
      if (r.SPL == null && r.no != null && r.no > 0) r.SPL = splFromEfficiency(r.no, r.roo, r.c);
    }
    // A driver has one voice coil unless someone says otherwise — WinISD shows Voicecoils=1
    // on a blank driver. fromWdr already backfills numVC=1 for a file that omits the key, so
    // without this every OTHER construction path (fromJSON, authored in-app) disagreed with
    // it and the editor rendered the field blank. C, not E: the app supplied it, not a human.
    if (r.numVC == null) r.numVC = 1;

    // EBP (ParState slot 33) has no cell of its own in the T/S consistency group — the
    // engine's ebp() is a standalone display calculation, not one solveConsistencyGroup
    // produces. Without this the cell reads N even when Fs/Qes are both solved, which is
    // the gap bugs/BUG_20260813_parstate-writer-emits-n-for-the-34-slots-the-driver-does-not-model.md
    // names explicitly.
    if (r.EBP == null && r.Fs != null && r.Qes != null && r.Qes > 0) r.EBP = ebp({ Fs: r.Fs, Qes: r.Qes });

    // Validation comes from the engine (single source of the required-field rules).
    // The resolved `r` (Sd filled from Dia, third Q filled) is what it checks, so a
    // Dia-only or two-Q driver validates the same as the editor's canApply did.
    const { errors } = deriveDriver(r as unknown as DriverRaw);
    this.#cache = { fields: r, entered, errors };
    return this.#cache;
  }

  #errorFor(field: string, errors: DriverError[]): DriverError | undefined {
    if (errors.length === 0) return undefined;
    // Direct match first.
    const direct = errors.find(e => e.field === field);
    if (direct) return direct;
    // Then aliases: is `field` an alias target of some errored source field?
    for (const [source, targets] of Object.entries(ERROR_ALIASES)) {
      if (targets.includes(field)) {
        const aliased = errors.find(e => e.field === source);
        if (aliased) return aliased;
      }
    }
    return undefined;
  }
}
