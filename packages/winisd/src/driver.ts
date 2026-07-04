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

import { deriveDriver } from '@openisd/engine';
import type { DriverRaw, Driver as DerivedDriver, DriverError } from '@openisd/engine';
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
  derived: DerivedDriver | null;
  errors: DriverError[];
}

// Per-field error aliases: an error filed by the engine under `errorField` also surfaces
// on these cells. Sd's requirement shows on the cone-diameter cell; the "need two Q"
// completeness error (filed under Qts) shows on all three Q cells.
const ERROR_ALIASES: Record<string, string[]> = {
  Sd:  ['Dia'],
  Qts: ['Qms', 'Qes'],
};

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
    const { derived, errors } = this.#derive();
    const error = this.#errorFor(field, errors);
    if (field in this.#inputs) {
      return { value: this.#inputs[field], state: 'E', error };
    }
    const dv = derived ? (derived as unknown as Record<string, unknown>)[field] : undefined;
    if (typeof dv === 'number' && isFinite(dv)) {
      return { value: dv, state: 'C', error };
    }
    return { value: undefined, state: 'N', error };
  }

  /** Whole-driver issue list — the Apply gate and the summary read this. */
  errors(): DriverError[] {
    return this.#derive().errors;
  }

  /** Register a change listener; returns an unsubscribe function. */
  subscribe(listener: DriverListener): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  // ── WDR round-trip ────────────────────────────────────────────────────────────

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
      return toWdrRaw(this.#rawSnapshot());
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

  // A DriverRaw snapshot of the entered numeric/string fields — for fresh-mode export.
  #rawSnapshot(): DriverRaw {
    return { ...this.#inputs } as unknown as DriverRaw;
  }

  #invalidate(): void {
    this.#cache = null;
    // Copy so a listener that unsubscribes mid-notify does not disturb iteration.
    for (const fn of [...this.#listeners]) fn();
  }

  #derive(): Derivation {
    if (this.#cache) return this.#cache;
    // The engine reads only the T/S fields it knows; override fields (e.g. an entered
    // Cms) are simply ignored by deriveDriver, so a shallow copy is safe to pass.
    const raw = { ...this.#inputs } as unknown as DriverRaw;
    const { value, errors } = deriveDriver(raw);
    this.#cache = { derived: value, errors };
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
