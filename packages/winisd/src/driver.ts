/**
 * Driver ADT — the E/C/N provenance model (docs/DRIVER_ADT_DESIGN.md).
 *
 * The ONLY mutation path is enter/clear, so E/C/N can never drift out of sync with the
 * values: you cannot set a value without its mark updating, and there is no way to set a
 * mark directly. `#inputs` (presence ⇒ Entered) is the single mutable fact stored; every
 * Computed value and the whole E/C/N view is derived from it via the engine's physics.
 *
 * Reactivity is framework-free: the class carries its own `subscribe` observer, fired by
 * enter/clear. It does NOT import Vue or any UI framework — @openisd/winisd is a lower
 * layer than the UI (ARCHITECTURE.md AD-6; dependency arrows point up only). A Vue
 * binding lives in the UI layer and subscribes to a Driver; the Driver never knows Vue
 * exists.
 */

import { deriveDriver, C, RHO } from '@openisd/engine';
import type { DriverRaw, Driver as EngineDriver, DriverError } from '@openisd/engine';
import { toWdr as toWdrRaw } from './wdr.js';
import { PARSTATE_LEN, MODELED_SLOTS, MODELED_BY_WDRKEY } from './parstate.js';

/** E/C/N edit-state of one field. */
export type CellState = 'E' | 'C' | 'N';

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

interface Derivation {
  /** Resolved SI values for every derivable field (core T/S + Dia/Vd/η₀/SPL/c/roo). */
  fields: Record<string, number>;
  errors: DriverError[];
}

// Per-field error aliases: an error filed by the engine under `errorField` also surfaces
// on these cells. Sd's requirement shows on the cone-diameter cell; the "need two Q"
// completeness error (filed under Qts) shows on all three Q cells.
const ERROR_ALIASES: Record<string, string[]> = {
  Sd:  ['Dia'],
  Qts: ['Qms', 'Qes'],
};

// WDR header key → app metadata field. These are carried (not simulated), so on import
// they are marked E and survive to raw()/re-save the same way the design's "carried
// pass-through fields" do. `name` is composed from Brand + Model (as parseWdr did).
const WDR_META: ReadonlyArray<[string, string]> = [
  ['Brand', 'brand'],
  ['Model', 'model'],
  ['ProvidedBy', 'providedBy'],
  ['Comment', 'comment'],
];

// Format a modeled cell value back to a WDR value string. toPrecision(6) matches the
// exporter's rounding, so an overlaid value stays numerically equal to the source.
function fmtNum(x: number | string | undefined): string {
  if (typeof x === 'number' && isFinite(x)) return String(+x.toPrecision(6));
  if (typeof x === 'string') return x;
  return '';
}

export class Driver {
  // The one non-derivable fact: what the human entered. Presence ⇒ state E.
  readonly #inputs: Record<string, number | string> = {};
  // Memoised derivation; invalidated (→ null) on every mutation.
  #cache: Derivation | null = null;
  readonly #listeners = new Set<DriverListener>();

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
    this.#inputs[field] = value;
    this.#invalidate();
  }

  /** Drop the human value → the field reverts to Computed (C) if derivable, else N. */
  clear(field: string): void {
    delete this.#inputs[field];
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
  static fromRaw(raw: Record<string, unknown> | null | undefined): Driver {
    const d = new Driver();
    for (const k in raw) {
      const v = raw[k];
      if (v !== undefined && v !== null && v !== '' &&
          (typeof v === 'number' || typeof v === 'string')) {
        d.#inputs[k] = v;
      }
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
    // or a plain DriverRaw. This does not touch toWdr (which echoes #wdrRaw) or ParState.
    for (const [wdrKey, field] of WDR_META) {
      const v = raw[wdrKey];
      if (v != null && v !== '') d.#inputs[field] = v;
    }
    const name = [raw.Brand, raw.Model].filter(x => x && x.length).join(' ').trim();
    if (name) d.#inputs.name = name;

    d.#cache = null;
    return d;
  }

  /**
   * Serialise to WinISD .wdr text. Built via fromWdr: echoes every carried key (so
   * passthrough fields survive), overlays edited modeled values, and rebuilds ParState
   * live from cell().state at each modeled slot (carried chars elsewhere). Built fresh:
   * delegates to the raw exporter over the entered fields.
   */
  toWdr(): string {
    if (!this.#wdrOrder || !this.#wdrRaw) {
      // Fresh-authored driver — no carried WDR. Export from the entered fields.
      return toWdrRaw(this.raw());
    }
    const lines = ['[Driver]'];
    for (const key of this.#wdrOrder) {
      let val = this.#wdrRaw[key];
      const m = MODELED_BY_WDRKEY[key];
      if (m && this.cell(m.field).state === 'E') {
        val = fmtNum(this.cell(m.field).value);   // reflect an edited/entered value
      }
      lines.push(key + '=' + val);
    }
    lines.push('ParState=' + this.#buildParState());
    lines.push('');
    return lines.join('\n');
  }

  // ── internal ────────────────────────────────────────────────────────────────

  // Rebuild the 49-char ParState: modeled slots from live cell().state, all other slots
  // preserved from the source ParState (or N when authored fresh).
  #buildParState(): string {
    const base = this.#parStateIn && this.#parStateIn.length === PARSTATE_LEN
      ? this.#parStateIn.split('')
      : new Array<string>(PARSTATE_LEN).fill('N');
    for (const m of MODELED_SLOTS) base[m.pos] = this.cell(m.field).state;
    return base.join('');
  }

  #invalidate(): void {
    this.#cache = null;
    // Copy so a listener that unsubscribes mid-notify does not disturb iteration.
    for (const fn of [...this.#listeners]) fn();
  }

  #derive(): Derivation {
    if (this.#cache) return this.#cache;

    // Start from the entered SI numerics. Every `== null` guard below means an entered
    // (E) value is never overwritten by a computed one and instead feeds downstream —
    // WinISD's fixed-E override semantics. This is the single derivation authority; the
    // UI must not re-implement any of it.
    const r: Record<string, number> = {};
    for (const k in this.#inputs) {
      const v = this.#inputs[k];
      if (typeof v === 'number' && isFinite(v)) r[k] = v;
    }

    // Two passes so a freshly-derived value can feed the next (Cms → Mms → Rms/Bl).
    for (let pass = 0; pass < 2; pass++) {
      if (r.Sd == null && r.Dia != null) r.Sd = Math.PI * (r.Dia / 2) ** 2;
      if (r.Dia == null && r.Sd != null) r.Dia = 2 * Math.sqrt(r.Sd / Math.PI);

      if (r.Qts == null && r.Qes != null && r.Qms != null) r.Qts = r.Qes * r.Qms / (r.Qes + r.Qms);
      if (r.Qes == null && r.Qts != null && r.Qms != null) r.Qes = r.Qts * r.Qms / (r.Qms - r.Qts);
      if (r.Qms == null && r.Qts != null && r.Qes != null) r.Qms = r.Qts * r.Qes / (r.Qes - r.Qts);

      if (r.Fs != null && r.Vas != null && r.Sd != null) {
        const Cas = r.Vas / (RHO * C * C);                 // Cms = Vas/(ρc²·Sd²)
        if (r.Cms == null) r.Cms = Cas / (r.Sd * r.Sd);
        if (r.Mms == null) r.Mms = 1 / ((2 * Math.PI * r.Fs) ** 2 * r.Cms);
        if (r.Rms == null && r.Qms != null) r.Rms = 2 * Math.PI * r.Fs * r.Mms / r.Qms;
        if (r.Bl == null && r.Re != null && r.Qes != null) r.Bl = Math.sqrt(2 * Math.PI * r.Fs * r.Mms * r.Re / r.Qes);
      }
      if (r.Vd == null && r.Sd != null && r.Xmax != null) r.Vd = r.Sd * r.Xmax;
      if (r.no == null && r.Fs != null && r.Vas != null && r.Qes != null)
        r.no = 4 * Math.PI ** 2 / C ** 3 * r.Fs ** 3 * r.Vas / r.Qes;   // reference efficiency
      if (r.SPL == null && r.no != null && r.no > 0) r.SPL = 112.1 + 10 * Math.log10(r.no);
    }

    // Air constants autofill (state C) until overridden — matches the sim's constants.
    if (r.c == null) r.c = C;
    if (r.roo == null) r.roo = RHO;

    // Validation comes from the engine (single source of the required-field rules).
    // The resolved `r` (Sd filled from Dia, third Q filled) is what it checks, so a
    // Dia-only or two-Q driver validates the same as the editor's canApply did.
    const { errors } = deriveDriver(r as unknown as DriverRaw);
    this.#cache = { fields: r, errors };
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
