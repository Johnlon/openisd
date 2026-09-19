import type {FieldState, SolverField, SolverInput} from '@openisd/design/engine';
import type {SpecEntryJson} from './openisdSchema.js';

export interface Cell<T> {
  readonly name: string;

  readonly value: T | null;
  readonly state: FieldState;
  dq(): readonly string[];
}

export function createCell<T>(
  name: string,
  value: T | null,
  state: FieldState,
  dq?: readonly string[],
): Cell<T> {
  const dqArray = dq ?? [];
  const cell: Cell<T> = {
    name,
    value,
    state,
    dq: () => dqArray,
  };
  Object.defineProperty(cell, 'dq', {
    value: () => dqArray,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  // `name` is an inspection/debugging aid, not part of the cell's value contract.
  // Making it non-enumerable prevents deepEqual(cell, { value, state }) from failing
  // in the hundreds of existing tests that predate this field.
  Object.defineProperty(cell, 'name', {
    value: name,
    writable: false,
    configurable: true,
    enumerable: false,
  });
  return cell;
}

export interface RawField<T> {
  get(): T;
  set(v: T): void;
}

/** The four ways a `Field`'s owner can be written to. `entered`/`clear` are the project's own
 *  facts; `calculated`/`dq` are the solver's — a `Field` is a pure lens over whatever storage
 *  implements these, never a store of its own (T11: `get()` is one record read, no private
 *  shadow state to fall out of step with it). */
export interface FieldWrites<T> {
  entered(v: T): void;
  clear(): void;
  calculated(v: T): void;
  dq(dq: readonly string[]): void;
}

export class Field<T> implements SolverField<T> {
  constructor(
    private readonly readCell: () => Cell<T>,
    private readonly writes: FieldWrites<T>,
  ) {}

  get name(): string { return this.readCell().name; }
  get value(): T | null { return this.readCell().value; }
  get state(): FieldState { return this.readCell().state; }
  get entered(): boolean { return this.state === 'entered'; }
  get calculated(): boolean { return this.state === 'calculated'; }
  get notAvailable(): boolean { return this.state === 'not-available'; }
  get dq(): readonly string[] { return this.readCell().dq(); }

  get(): Cell<T> { return this.readCell(); }

  set(v: T): void { this.writes.entered(v); }
  clear(): void { this.writes.clear(); }

  /** Store a solver-established project value while exposing it as an entered project fact. */
  setProjectEstablished(value: T, dq?: string[]): void {
    this.writes.entered(value);
    this.writes.dq(dq ?? []);
  }

  /** Never removes an entered value — only the project itself retracts a stated fact; the
   *  solver merely reports that IT could not derive one. */
  setNotAvailable(): void {
    if (!this.entered) this.writes.clear();
  }

  setCalculated(value: T, dq?: string[]): void {
    this.writes.calculated(value);
    if (dq !== undefined) this.writes.dq(dq);
  }

  setDq(dq?: string[]): void {
    this.writes.dq(dq ?? []);
  }
}

export interface Lens<T> {
  get(): T;
  set(v: T): void;
}

export function focus<P, K extends keyof P>(parent: Lens<P>, key: K): Lens<P[K]> {
  return {
    get: () => parent.get()[key],
    set: (v) => parent.set({ ...parent.get(), [key]: v }),
  };
}

/** A lens that resolves after every write from OUTSIDE `onWrite` itself (S2-7c cascade): `set(v)`
 *  writes through to `lens`, then runs `onWrite()` — unless the write came FROM `onWrite`, guarded
 *  by a reentrancy flag. Without the guard, a solve's own `setCalculated` writes (which travel
 *  through this same lens) would trigger another resolve, which writes again, forever. */
export function resolvingLens<T>(lens: Lens<T>, onWrite: () => void): Lens<T> {
  let resolving = false;
  return {
    get: () => lens.get(),
    set: (v) => {
      lens.set(v);
      if (resolving) return;
      resolving = true;
      try {
        onWrite();
      } finally {
        resolving = false;
      }
    },
  };
}

/** A flag-less input slot — `get()/value/state/entered/set(v)/clear()` only, deliberately NOT a
 *  `SolverField`: a slot with no C/E flag has nothing for a solver to write `'calculated'` or
 *  `'not-available'` onto, so the type simply does not offer `setCalculated`/`setNotAvailable`
 *  (S2-7a — `nullableField`/`requiredField` hand this back, never a `Field`). */
export class InputField<T> {
  constructor(
    private readonly readCell: () => Cell<T>,
    private readonly writes: { entered(v: T): void; clear(): void },
  ) {}

  get name(): string { return this.readCell().name; }
  get value(): T | null { return this.readCell().value; }
  get state(): FieldState { return this.readCell().state; }
  get entered(): boolean { return this.state === 'entered'; }

  get(): Cell<T> { return this.readCell(); }
  set(v: T): void { this.writes.entered(v); }
  clear(): void { this.writes.clear(); }
}

export function nullableField<K extends PropertyKey, T extends Record<K, number | null>>(
  lens: Lens<T>,
  key: K,
  getDq?: (value: number | null) => string | null,
): InputField<number> {
  return new InputField<number>(
    () => {
      const v = lens.get()[key];
      let dqList: string[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return createCell<number>(
        String(key),
        v,
        v === null ? 'not-available' : 'entered',
        dqList,
      );
    },
    {
      entered: (v) => lens.set({ ...lens.get(), [key]: v }),
      clear: () => lens.set({ ...lens.get(), [key]: null }),
    },
  );
}

export function requiredField<K extends PropertyKey, T extends Record<K, number>>(
  lens: Lens<T>,
  key: K,
  label: string,
  getDq?: (value: number) => string | null,
): InputField<number> {
  return new InputField<number>(
    () => {
      const v = lens.get()[key];
      let dqList: string[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return createCell<number>(
        String(key),
        v,
        'entered',
        dqList,
      );
    },
    {
      entered: (v) => lens.set({ ...lens.get(), [key]: v }),
      clear: () => {
        throw new Error(
          `${label} cannot be cleared: it always has a value in this design — there is no ` +
          '"not entered" state for it to return to.',
        );
      },
    },
  );
}

/** Builds a `Field<number>` over one C/E-flagged entry slot — the one factory every entry-shaped
 *  quantity (driver spec, vent, PR, sealed `Qtc`, …) shares (S2-7b): absent reads `not-available`;
 *  `state:'E'` reads `entered`; `state:'C'` reads `calculated`; each `dq_calculated` mark's
 *  `detail` is the field's own dq text. */
export function entryField(lens: Lens<SpecEntryJson | undefined>, name: string): Field<number> {
  const readCell = (): Cell<number> => {
    const entry = lens.get();
    if (entry === undefined) return createCell<number>(name, null, 'not-available');
    const dq = entry.dq_calculated?.map(m => m.detail) ?? [];
    return createCell<number>(name, entry.value, entry.state === 'E' ? 'entered' : 'calculated', dq);
  };
  return new Field<number>(readCell, {
    entered: (v) => lens.set({ state: 'E', value: v }),
    clear: () => lens.set(undefined),
    calculated: (v) => lens.set({ state: 'C', value: v }),
    dq: (list) => {
      const current = lens.get();
      if (current === undefined) return;
      lens.set({
        ...current,
        dq_calculated: list.map(detail => ({ kind: 'calc', severity: 'error', rule: 'issue', params: {}, detail })),
      });
    },
  });
}

/** A `SolverInput` over a plain "no flag" read — a box volume, a vent's geometry, a radiator's
 *  own T/S spec: a number a solve needs but never writes back to, so it never had a C/E state to
 *  report. `entered` is simply "a value is present" (`read() !== null`), matching how every one
 *  of these solve inputs is treated today (`Vb_m3 != null`, never `Vb_m3.entered`). Wraps a
 *  `RawField`/`InputField`/plain-lens read, whichever the caller already has. */
export function inputOf<T>(read: () => T | null): SolverInput<T> {
  return {
    get value() { return read(); },
    get entered() { return read() !== null; },
  };
}

/** Builds one HALF of a solved pair (vent `tuning_hz` ↔ `length_m`, PR `addedMass_kg` ↔
 *  `tuning_hz`) — entering or explicitly clearing THIS member ATOMICALLY clears the sibling too,
 *  in the SAME write (S2-7d2). One write, not two: writing this member then separately clearing
 *  the sibling would let a resolve run in between on the intermediate state — this member's new
 *  fact, the sibling's still-stale one — and re-derive the sibling right back from a value the
 *  caller is in the middle of retracting. `commitPair(entry)` must replace THIS member's own
 *  slot with `entry` and the sibling's with `undefined`, in one call to whatever lens (or lenses)
 *  they share — the caller already knows both concrete field names and, when the pair spans two
 *  different parent records (a vent's own `length_m` vs. its chamber's `tuning_hz`), which
 *  ancestor lens reaches both, so it writes the literal itself; no computed-key indexing here to
 *  lose type safety over.
 *
 *  `clear()` is overridden as a METHOD, not via `FieldWrites`, specifically so
 *  `setNotAvailable()` — the SOLVER's own "could not derive this" signal, called on every
 *  resolve where the pair is incomplete, entered or not — stays SELF-ONLY: `Field`'s
 *  `setNotAvailable()` also ends up calling the constructor's `clear` write when this member
 *  isn't entered, and routing THAT through the atomic pair-clear would wipe a just-entered
 *  sibling on every routine "can't derive this today," not only on a real user retraction.
 *  `ownEntry` is this member's own plain `entryField` — reused for the read, and for
 *  `calculated`/`dq`/the solver's own `clear`, none of which ever touch the sibling.
 *
 *  The EXTERNAL `.clear()` override only cascades when THIS member is currently the pair's
 *  stated fact (`this.entered`): clearing a merely `'calculated'` field — the sibling's own
 *  derived echo, not a fact anyone stated — must not reach across and erase the OTHER member's
 *  real entered value. Only retracting the actual target resets the pair. */
export function pairedField(
  read: () => Cell<number>,
  commitPair: (entry: SpecEntryJson | undefined) => void,
  ownEntry: Field<number>,
): Field<number> {
  class PairedField extends Field<number> {
    override clear(): void {
      if (this.entered) commitPair(undefined);
      else ownEntry.clear();
    }
  }
  return new PairedField(read, {
    entered: (v: number) => commitPair({ state: 'E', value: v }),
    clear: () => ownEntry.clear(),
    calculated: (v: number) => ownEntry.setCalculated(v),
    dq: (list) => ownEntry.setDq([...list]),
  });
}

export class ReadOnlyCalculatedField<T> {
  constructor(private readonly readCell: () => Cell<T>) {}

  get name(): string { return this.readCell().name; }
  get value(): T | null { return this.readCell().value; }
  get state(): FieldState { return this.readCell().state; }
  get entered(): boolean { return this.state === 'entered'; }
  get calculated(): boolean { return this.state === 'calculated'; }
  get notAvailable(): boolean { return this.state === 'not-available'; }
  get dq(): readonly string[] { return this.readCell().dq(); }

  get(): Cell<T> { return this.readCell(); }
}
