import type {DqIssue, SolverField, SolverInput} from '@openisd/design/engine';
import type {DqMark, SpecEntryJson} from './openisdSchema.js';
import {halfUlp} from './precision.js';

// ───────────────────────────────── Capability atoms ─────────────────────────────────────────────
//
// A field the domain exposes is an intersection of these, declared inline at its site. Absence
// is `null` in `V`; a field whose `V` excludes `null` is always present.

/** Read: the current value, the field's name, and its diagnostic notes. */
export interface Readable<V> {
  readonly name: string;
  readonly value: V;
  readonly dq: readonly DqIssue[];
}

/** A person can have put the value there: `entered` is true when they did. */
export interface Entered {
  readonly entered: boolean;
}

/** The value can be derived: `calculated` is true when the solver (or a clear-default) wrote it. */
export interface Calculated {
  readonly calculated: boolean;
}

/** Half-width of the entered value's rounding interval; `null` unless entered (D13) — the
 *  tolerance a consistency check widens an input's contribution by, so a value stated as
 *  "0.49" is not flagged against one stated as "0.495". */
export interface Precise {
  readonly precision: number | null;
}

/** The project owner can enter a new value. `precision` is the half-width of what that value
 *  STATES, in SI — an editor showing 2 decimals of grams passes 0.000005 — and is omitted where
 *  the caller has nothing better to say than the number itself (D13, `entryPrecision`). */
export interface Writable<T> {
  set(v: T, precision?: number): void;
}

/** The project owner can retract a stated value: to `null` where `V` admits it, else to the
 *  field's own default. */
export interface Clearable {
  clear(): void;
}

/** The solver's writes: a derived value with optional notes, or notes alone. */
export interface Calculatable<T> {
  setCalculated(value: T, dq?: readonly DqIssue[]): void;
  setDq(dq?: readonly DqIssue[]): void;
}

/** The solver could not derive a value: reads `null` afterwards unless the value was entered. */
export interface Unsolvable {
  setNotAvailable(): void;
}

/** A stored value with no provenance — config, losses, catalogue facts the schema always fills. */
export interface SimpleField<T> {
  readonly value: T;
  set(v: T): void;
}

// ───────────────────────────────── Internal cell ─────────────────────────────────────────────────

/** One read of a field's slot. Internal to the implementations below — a field exposes
 *  `name`/`value`/`entered`/`calculated`/`dq` itself, never the cell. */
export interface FieldCell<V> {
  readonly name: string;
  readonly value: V;
  readonly entered: boolean;
  readonly calculated: boolean;
  /** Half-width of the entered value's rounding interval; `null` unless entered (D13). */
  readonly precision: number | null;
  readonly dq: readonly DqIssue[];
}

export function enteredCell<V>(name: string, value: V, dq?: readonly DqIssue[], precision: number | null = null): FieldCell<V> {
  return { name, value, entered: true, calculated: false, precision, dq: dq ?? [] };
}

export function calculatedCell<V>(name: string, value: V, dq?: readonly DqIssue[]): FieldCell<V> {
  return { name, value, entered: false, calculated: true, precision: null, dq: dq ?? [] };
}

export function absentCell<T>(name: string, dq?: readonly DqIssue[]): FieldCell<T | null> {
  return { name, value: null, entered: false, calculated: false, precision: null, dq: dq ?? [] };
}

// ──────────────── Write plumbing the impls below take in their constructors ────────────────────

/** `entered(v)`: the one write a solver never makes — a project fact. `precision` is what that
 *  fact states, per `Writable`. */
export interface Enterable<V> {
  entered(v: V, precision?: number): void;
}

/** `calculated(v)`/`dq(list)` — the solver's writes. */
export interface SolverWritable<V> {
  calculated(v: V): void;
  dq(dq: readonly DqIssue[]): void;
}

// ───────────────────────────────── Implementations ──────────────────────────────────────────────
//
// The domain API's getters declare their return type as an intersection of the atoms above,
// never one of these classes. The classes are exported because `openisdDomain.ts` builds fields
// with `new` directly; nothing outside this file names one as a type. One class per combination
// of atoms in use — each `implements` exactly its own list, nothing borrowed from a shared base
// beyond `Readable<V>` (John, 2026-09-22: "no god class").

export class ReadableFieldImpl<V> implements Readable<V> {
  constructor(protected readonly readCell: () => FieldCell<V>) {}

  get name(): string { return this.readCell().name; }
  get value(): V { return this.readCell().value; }
  get dq(): readonly DqIssue[] { return this.readCell().dq; }
}

/** A stated-or-absent fact: entered by the project owner, never derived. `clear()` empties the
 *  slot to `null`. */
export class EnteredFieldImpl<T> extends ReadableFieldImpl<T | null> implements Entered, Writable<T>, Clearable {
  constructor(
    readCell: () => FieldCell<T | null>,
    private readonly writes: Enterable<T> & Clearable,
  ) {
    super(readCell);
  }

  get entered(): boolean { return this.readCell().entered; }
  set(v: T, precision?: number): void { this.writes.entered(v, precision); }
  clear(): void { this.writes.clear(); }
}

/** Read-only: the solver derives this value or reports it absent, and nothing ever enters it. */
export class CalculatedFieldImpl<V> extends ReadableFieldImpl<V> implements Calculated {
  get calculated(): boolean { return this.readCell().calculated; }
}

/** Owner and solver both write. A pure lens over `writes`/`readCell`, never a store of its own —
 *  every read re-reads the record `writes` targets, so nothing here can fall out of step with
 *  it (T11). */
export class DualWriteFieldImpl<T> extends ReadableFieldImpl<T | null>
  implements Entered, Calculated, Writable<T>, Clearable, Calculatable<T>, Unsolvable, SolverField<T> {
  constructor(
    readCell: () => FieldCell<T | null>,
    private readonly writes: Enterable<T> & Clearable & SolverWritable<T>,
  ) {
    super(readCell);
  }

  get entered(): boolean { return this.readCell().entered; }
  get calculated(): boolean { return this.readCell().calculated; }
  get precision(): number | null { return this.readCell().precision; }
  set(v: T, precision?: number): void { this.writes.entered(v, precision); }
  clear(): void { this.writes.clear(); }

  /** Never removes an entered value — only the project itself retracts a stated fact; the
   *  solver merely reports that it could not derive one. */
  setNotAvailable(): void {
    if (!this.entered) this.writes.clear();
  }

  setCalculated(value: T, dq?: readonly DqIssue[]): void {
    this.writes.calculated(value);
    if (dq !== undefined) this.writes.dq(dq);
  }

  setDq(dq?: readonly DqIssue[]): void {
    this.writes.dq(dq ?? []);
  }
}

/** Owner and solver both write, and the value is never absent: an empty slot reads a calculated
 *  default. `clear()` never makes it null: it drops the entered value, so the field reads C —
 *  the default, or the solver's value — again. */
export class DefaultingFieldImpl<T> extends ReadableFieldImpl<T>
  implements Entered, Calculated, Writable<T>, Clearable, Calculatable<T> {
  constructor(
    readCell: () => FieldCell<T>,
    private readonly writes: Enterable<T> & Clearable & SolverWritable<T>,
  ) {
    super(readCell);
  }

  get entered(): boolean { return this.readCell().entered; }
  get calculated(): boolean { return this.readCell().calculated; }
  get precision(): number | null { return this.readCell().precision; }
  set(v: T, precision?: number): void { this.writes.entered(v, precision); }
  clear(): void { this.writes.clear(); }

  setCalculated(value: T, dq?: readonly DqIssue[]): void {
    this.writes.calculated(value);
    if (dq !== undefined) this.writes.dq(dq);
  }

  setDq(dq?: readonly DqIssue[]): void {
    this.writes.dq(dq ?? []);
  }
}

/** The owner sets it and never clears it — `set()` only: the type omits `clear()` rather than
 *  expose one that throws. */
export class SetOnlyFieldImpl<T, R extends T | null = T> extends ReadableFieldImpl<R> implements Entered, Writable<T> {
  constructor(
    readCell: () => FieldCell<R>,
    private readonly writes: Enterable<T>,
  ) {
    super(readCell);
  }

  get entered(): boolean { return this.readCell().entered; }
  set(v: T): void { this.writes.entered(v); }
}

// ───────────────────────────────── Factories ────────────────────────────────────────────────────

/** A `SimpleField` over a closure-held slot: `read` on every `.value`, `write` on `set`. */
export function simpleField<T>(read: () => T, write: (v: T) => void): SimpleField<T> {
  return {
    get value() { return read(); },
    set: write,
  };
}

export function focus<P, K extends keyof P>(parent: SimpleField<P>, key: K): SimpleField<P[K]> {
  return {
    get value() { return parent.value[key]; },
    set: (v) => parent.set({ ...parent.value, [key]: v }),
  };
}

/** A field that resolves after every write from outside `onWrite` itself (S2-7c cascade):
 *  `set(v)` writes through to `field`, then runs `onWrite()` — unless the write came from
 *  `onWrite`, guarded by a reentrancy flag. Without the guard, a solve's own `setCalculated`
 *  writes (which travel through this same field) would trigger another resolve, which writes
 *  again, forever. */
export function resolvingField<T>(field: SimpleField<T>, onWrite: () => void): SimpleField<T> {
  let resolving = false;
  return {
    get value() { return field.value; },
    set: (v) => {
      field.set(v);
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

/** A plain entered-or-absent numeric slot — no `Calculated`/`Unsolvable`, because nothing ever
 *  derives this value. Today's only caller is a vent's `width_m`: `OpenISDProject`'s own
 *  `#resolveVentGeometry` reads it to solve a slotted vent's `area_m2`, but the relation only
 *  runs one further — width itself is never solved back. */
export function nullableField<K extends PropertyKey, T extends Record<K, number | null>>(
  field: SimpleField<T>,
  key: K,
  getDq?: (value: number | null) => DqIssue | null,
): Readable<number | null> & Entered & Writable<number> & Clearable {
  return new EnteredFieldImpl<number>(
    () => {
      const v = field.value[key];
      let dqList: DqIssue[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return v === null ? absentCell<number>(String(key), dqList) : enteredCell<number | null>(String(key), v, dqList);
    },
    {
      entered: (v) => field.set({ ...field.value, [key]: v }),
      clear: () => field.set({ ...field.value, [key]: null }),
    },
  );
}

export function requiredField<K extends PropertyKey, T extends Record<K, number>>(
  field: SimpleField<T>,
  key: K,
  getDq?: (value: number) => DqIssue | null,
): Readable<number> & Entered & Writable<number> {
  return new SetOnlyFieldImpl<number>(
    () => {
      const v = field.value[key];
      let dqList: DqIssue[] | undefined = undefined;
      if (getDq) {
        const d = getDq(v);
        if (d) dqList = [d];
      }
      return enteredCell<number>(String(key), v, dqList);
    },
    {
      entered: (v) => field.set({ ...field.value, [key]: v }),
    },
  );
}

/** Builds the field over one C/E-flagged entry slot — the one factory every entry-shaped
 *  quantity (driver spec, vent, PR, sealed `Qtc`, …) shares (S2-7b): absent reads `null`;
 *  `state:'E'` reads `entered`; `state:'C'` reads `calculated`.
 *
 *  `dq` cannot round-trip through the persisted mark (a `DqMark`'s `detail` is a string, a
 *  `DqIssue` is not). A driver spec field's own `entryField` lives on a driver object the
 *  project holds durably, so a plain closure variable survives between one `#resolve()` and the
 *  next caller's read. A vent/PR/sealed group field does not: `OpenISDProject#box` builds a
 *  fresh window on every access, discarding any closure a previous window's `#resolve()` wrote
 *  into. `issuesSource`, when given, replaces that closure — the caller reads its own durable
 *  cache (`this.#issues`-shaped) live, on every read, the same way `driveVoltage_V` already
 *  reads `#issues.signal` (John, 2026-09-23: "must be fresh and accurate once loaded"). */
export function entryField(
  slot: SimpleField<SpecEntryJson | undefined>,
  name: string,
  issueText: IssueRenderer,
  issuesSource?: () => readonly DqIssue[],
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
  let liveDq: readonly DqIssue[] = [];
  const readCell = (): FieldCell<number | null> => {
    const entry = slot.value;
    const dq = issuesSource ? issuesSource() : liveDq;
    if (entry === undefined) return absentCell<number>(name, dq);
    return entry.state === 'E'
      ? enteredCell<number | null>(name, entry.value, dq, entryPrecision(entry))
      : calculatedCell<number | null>(name, entry.value, dq);
  };
  return new DualWriteFieldImpl<number>(readCell, {
    entered: (v, precision) => { liveDq = []; slot.set({ state: 'E', value: v, precision }); },
    clear: () => { liveDq = []; slot.set(undefined); },
    calculated: (v) => { liveDq = []; slot.set({ state: 'C', value: v }); },
    dq: (list) => { liveDq = list; writeEntryDq(slot, list, issueText); },
  });
}

/** D13 — the STATED precision of this value, never the precision the field could support.
 *
 *  Three sources, in order of how directly each one knows what was stated:
 *  1. the winning reading's `read_precision` — the scraper measured it and says so;
 *  2. the entry's own `precision`, written when the value was entered: the entering unit's
 *     least significant digit, in SI. A value typed into a field showing 2 decimals of grams
 *     states 30 g to ±0.005 g, and the conversion to `0.03` kg is not allowed to lose that;
 *  3. the printed decimals of the stored value. A record stating `0.5` kg states one decimal of
 *     a kilogram and nothing finer — `0.5` is not `0.50000` — so this is the right answer for a
 *     value that arrived as a number in a file and never went through a field. */
function entryPrecision(entry: Extract<SpecEntryJson, {state: 'E'}>): number {
  const reading = entry.origin !== undefined ? entry.readings?.[entry.origin] : undefined;
  return reading?.read_precision ?? entry.precision ?? halfUlp(entry.value);
}

/** One `DqIssue` as the debug-trail mark it becomes (D14/D14a) — `params` carries the finding
 *  itself (numbers/strings/string arrays only), not just prose. `non-physical`, plausibility's
 *  own `out-of-range` (vent/PR `Vb`/`Fb`) and `target-unreachable` keep the generic shape this
 *  function always wrote before D14 — only `inconsistent-inputs`, `missing-dependencies` and the
 *  driver-field `out-of-range` (D14, `OutOfRangeIssue`, told apart from plausibility's by
 *  `'field' in issue`) get a mark that names what it found. */
function issueMark(issue: DqIssue, detail: string): DqMark {
  switch (issue.kind) {
    case 'inconsistent-inputs':
      return {
        kind: 'calc', severity: 'error', rule: 'inconsistent-inputs',
        params: {
          target: issue.target, fields: [...issue.fields], formula: issue.formula,
          expected: issue.expected, actual: issue.actual, relative: issue.relative,
        },
        detail,
      };
    case 'missing-dependencies':
      return {
        kind: 'calc', severity: 'error', rule: 'missing-dependencies',
        params: { target: issue.target, missing: [...new Set(issue.routes.flatMap(r => r.missing))] },
        detail,
      };
    case 'out-of-range':
      if ('field' in issue) {
        return {
          kind: 'range', severity: 'error',
          rule: issue.side === 'below' ? 'range-below-min' : 'range-above-max',
          params: { field: issue.field, value: issue.value, limit: issue.limit },
          detail,
        };
      }
      return { kind: 'calc', severity: 'error', rule: 'issue', params: {}, detail };
    case 'non-physical':
    case 'target-unreachable':
      return { kind: 'calc', severity: 'error', rule: 'issue', params: {}, detail };
  }
}

/** `entryField` for a value that is never N: an empty slot reads `fallback()` as calculated.
 *  `clear()` empties the slot, so an E value goes back to C. */
export function defaultingEntryField(
  slot: SimpleField<SpecEntryJson | undefined>,
  name: string,
  issueText: IssueRenderer,
  fallback: () => number,
): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
  let liveDq: readonly DqIssue[] = [];
  return new DefaultingFieldImpl<number>(() => {
    const entry = slot.value;
    if (entry === undefined) return calculatedCell(name, fallback(), liveDq);
    return entry.state === 'E' ? enteredCell(name, entry.value, liveDq) : calculatedCell(name, entry.value, liveDq);
  }, {
    entered: (v, precision) => { liveDq = []; slot.set({ state: 'E', value: v, precision }); },
    clear: () => { liveDq = []; slot.set(undefined); },
    calculated: (v) => { liveDq = []; slot.set({ state: 'C', value: v }); },
    dq: (list) => { liveDq = list; writeEntryDq(slot, list, issueText); },
  });
}

/** Renders one live issue to the sentence the on-disk debug trail stores. `Engine` implements
 *  it; cell.ts never imports the engine's door, so it never stringifies an issue itself. */
export interface IssueRenderer {
  dqIssueText(issue: DqIssue): string;
}

/** Records that `list` of live issues happened, for the on-disk debug trail only — never read
 *  back into a field's own `dq` (see `entryField`). No entry, no mark: an absent slot has
 *  nothing to carry a note on. */
export function writeEntryDq(
  slot: SimpleField<SpecEntryJson | undefined>,
  list: readonly DqIssue[],
  issueText: IssueRenderer,
): void {
  const current = slot.value;
  if (current === undefined) return;
  slot.set({
    ...current,
    dq_calculated: list.map(issue => issueMark(issue, issueText.dqIssueText(issue))),
  });
}

/** A `SolverInput` over a plain "no flag" read — a box volume, a vent's geometry, a radiator's
 *  own T/S spec: a number a solve needs but never writes back to, so it never had a C/E state to
 *  report. `entered` is simply "a value is present" (`read() !== null`), matching how every one
 *  of these solve inputs is treated today (`Vb_m3 != null`, never `Vb_m3.entered`). */
export function inputOf<T>(read: () => T | null): SolverInput<T> {
  return {
    get value() { return read(); },
    get entered() { return read() !== null; },
  };
}

/** Builds one half of a solved pair (vent `tuning_goal_hz` ↔ `length_m`, PR `addedMass_kg` ↔
 *  `tuning_goal_hz`) — entering or explicitly clearing this member atomically clears the sibling
 *  too, in the same write (S2-7d2). One write, not two: writing this member then separately
 *  clearing the sibling would let a resolve run in between on the intermediate state — this
 *  member's new fact, the sibling's still-stale one — and re-derive the sibling right back from a
 *  value the caller is in the middle of retracting. `commitPair(entry)` must replace this
 *  member's own slot with `entry` and the sibling's with `undefined`, in one call to whatever
 *  slot (or slots) they share — the caller already knows both concrete field names and, when the
 *  pair spans two different parent records (a vent's own `length_m` vs. its chamber's
 *  `tuning_goal_hz`), which ancestor slot reaches both, so it writes the literal itself; no
 *  computed-key indexing here to lose type safety over.
 *
 *  `clear()` is overridden as a class method, not routed through the constructor's `writes`,
 *  specifically so `setNotAvailable()` — the solver's own "could not derive this" signal, called
 *  on every resolve where the pair is incomplete, entered or not — stays self-only:
 *  `DualWriteFieldImpl`'s `setNotAvailable()` also ends up calling `writes.clear()` when this
 *  member isn't entered, and routing that through the atomic pair-clear would wipe a
 *  just-entered sibling on every routine "can't derive this today," not only on a real user
 *  retraction. `ownEntry` is this member's own plain `entryField` — reused for the read, and for
 *  `calculated`/`dq`/the solver's own `clear`, none of which ever touch the sibling.
 *
 *  The class-level `.clear()` override only cascades when this member is currently the pair's
 *  stated fact (`this.entered`): clearing a merely calculated field — the sibling's own
 *  derived echo, not a fact anyone stated — must not reach across and erase the other member's
 *  real entered value. Only retracting the actual target resets the pair. */
export function pairedField(
  commitPair: (entry: SpecEntryJson | undefined) => void,
  ownEntry: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable,
): Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
  class PairedField extends DualWriteFieldImpl<number> {
    override clear(): void {
      if (this.entered) commitPair(undefined);
      else ownEntry.clear();
    }
  }
  return new PairedField(() => ownEntry, {
    entered: (v: number) => commitPair({ state: 'E', value: v }),
    clear: () => ownEntry.clear(),
    calculated: (v: number) => ownEntry.setCalculated(v),
    dq: (list) => ownEntry.setDq([...list]),
  });
}
