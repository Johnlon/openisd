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

export class Driver {
  // The one non-derivable fact: what the human entered. Presence ⇒ state E.
  readonly #inputs: Record<string, number | string> = {};
  // Memoised derivation; invalidated (→ null) on every mutation.
  #cache: Derivation | null = null;
  readonly #listeners = new Set<DriverListener>();

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

  // ── internal ────────────────────────────────────────────────────────────────

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
