/**
 * `ManagedDriver` — the one facade over every driver state layer (ARCHITECTURE.md §3
 * "`ManagedDriver` — the one facade over every state layer"). Nothing outside it may read or
 * write ground state, committed state, or the edit/what-if overlay directly — a component, a
 * workflow, a service, anything, reaches a driver's state only through this class.
 *
 * Wraps three things (`docs/design/STATE_MODEL.md`'s layer table, given a single owning
 * object):
 *   - ground state    — that document's Baseline/Ground: the driver exactly as loaded.
 *   - committed state   — that document's Committed design: the live `OpenISDDriver` the
 *                          charts are drawn from, held as an `OpenISDDriver`.
 *   - an overlay        — a Dialog draft (editing) OR a What-if overlay — never both at once.
 *
 * ── The edit lifecycle ──
 * `beginEdit()` opens a draft over committed state. `commitEdit()` writes the draft into
 * committed state and discards the draft. `cancelEdit()` discards the draft without writing
 * anything — committed state is byte-identical to before `beginEdit()`, provenance marks
 * included.
 *
 * ── The what-if lifecycle ──
 * `beginWhatIf()` opens an overlay read from committed state. `cancelWhatIf()` discards it.
 * There is no `commitWhatIf()` — a what-if explores values the app cannot verify against
 * physical reality, so nothing ever promotes one into the design. The only way a what-if
 * session ends is `cancelWhatIf()`, and it always discards.
 *
 * ── The OpenISDDriver is PRIVATE internal state ──
 * `OpenISDDriver` maps the `openisd.yml` record, and it sits BEHIND this class: no instance of
 * one ever leaves. A caller reads with `cell()`/`metaCell()`/`toDriver()`/`errors()` and writes
 * with `enter()`/`clear()`/`enterMeta()`/`clearMeta()`, and this class routes each to whichever
 * layer is effective. Handing the driver out instead would let a caller mutate it behind the
 * facade, with no notification and no what-if guard.
 *
 * ── Subscription is single-channel ──
 * A consumer subscribes to `ManagedDriver` and to nothing beneath it. This class alone decides
 * when a subscriber is notified:
 *   - An edit draft is silent. Typing into an open edit produces no notification, because this
 *     class never subscribes to the draft's own `subscribe()`. `commitEdit()` writes the draft
 *     into committed state, and it is THAT WRITE — not the act of committing — that triggers the
 *     one notification a subscriber receives.
 *   - A what-if overlay is live. This class subscribes to the overlay for as long as it is
 *     open, so every change re-fires immediately. `beginWhatIf()`/`cancelWhatIf()` themselves
 *     also notify, since they change which layer is effective.
 *
 * ── A what-if never leaks into anything persistent (ARCHITECTURE.md §3) ──
 * Its value is unverified against physical reality — nothing outside the live overlay is
 * allowed to see it. `ManagedDriver` cancels any active what-if ITSELF, before every operation
 * that reads committed state for a purpose beyond driving the open charts: `beginEdit()`,
 * `recordToPersist()` (the one path a save/export/share-link/My-Drivers-save operation has to
 * a persistable record), and a load. This is this class's own responsibility, not the caller's
 * — the bug it closes structurally is real: `useDesignIO.ts` once had a per-call-site guard
 * `endAnyActiveWhatIfBeforeIO()`, called at the top of save/save-as/export-wdr/export-wpr/
 * export-owdr but NOT `shareLink()`. One call site forgot. With `recordToPersist()` as the only
 * route to a persistable record, there is no path left that can forget.
 *
 * ── "Never both at once" ──
 * `beginEdit()` cancels an active what-if first (the rule above). Symmetrically,
 * `beginWhatIf()` discards an active edit draft first (silently — an open, uncommitted draft
 * produces no notification per the asymmetry above, so discarding it produces none either):
 * an edit draft and a what-if overlay are two readings of "the one overlay slot", and only
 * `ManagedDriver` may decide which one occupies it.
 */
import { OpenISDDriver } from '@openisd/model';
import type { Cell, MetaCell, SpecField, MetaField } from '@openisd/model';
import type { DriverError, ConsistencyIssue, Driver as EngineDriver } from '@openisd/engine';

/** The openisd.yml record shape — what `OpenISDDriver.toRecord()` hands back. */
type DriverRecord = ReturnType<OpenISDDriver['toRecord']>;

export type ManagedDriverListener = () => void;

type Overlay =
  | { kind: 'edit'; draft: OpenISDDriver }
  | { kind: 'whatif'; overlay: OpenISDDriver; unsubscribe: () => void };

/** A deep copy of a driver's own record, safe to hold without aliasing the caller's
 *  object graph — every `OpenISDDriver.fromRecord` call in this file passes one of
 *  these, never a record another layer of `ManagedDriver` is still holding a reference
 *  to; without it, editing the draft would mutate ground/committed through the shared
 *  object graph, since `OpenISDDriver` does not clone what it is handed (`private
 *  constructor(record)`). Generic because the record's shape has no exported name —
 *  `OpenISDDriver` is the one external form (`@openisd/model`). */
function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class ManagedDriver {
  #ground: OpenISDDriver;
  #committed: OpenISDDriver;
  #overlay: Overlay | null = null;
  readonly #listeners = new Set<ManagedDriverListener>();

  private constructor(ground: OpenISDDriver, committed: OpenISDDriver) {
    this.#ground = ground;
    this.#committed = committed;
  }

  /** Build a `ManagedDriver` with ground and committed both seeded from `driver` — the state
   *  the moment a driver is chosen/loaded (`docs/design/STATE_MODEL.md` rule 5, "the baseline
   *  is the driver as chosen"). The two are independent copies from the first instant. */
  static fromRecord(record: DriverRecord): ManagedDriver {
    return new ManagedDriver(
      OpenISDDriver.fromRecord(cloneRecord(record)),
      OpenISDDriver.fromRecord(cloneRecord(record)),
    );
  }

  /** A ManagedDriver holding a driver with nothing stated — what the app holds before one has
   *  been chosen. Here rather than at the call site so no caller needs to name `OpenISDDriver`
   *  to make one: this class is its ONLY holder. */
  static createEmpty(): ManagedDriver {
    return ManagedDriver.fromRecord(OpenISDDriver.empty().toRecord());
  }

  /** Adopt a record (a library pick, a file open, a restored snapshot) as the loaded driver.
   *  The record→driver construction happens HERE, so a caller with bytes in hand never has to
   *  reach for `OpenISDDriver` itself. Same semantics as `load()` in every other respect. */
  loadRecord(record: DriverRecord): void {
    this.#loadDriver(OpenISDDriver.fromRecord(record));
  }

  /** Replace the held driver with one that has nothing stated — "no driver chosen". */
  loadEmpty(): void {
    this.#loadDriver(OpenISDDriver.empty());
  }

  // ---- reads --------------------------------------------------------------------------

  /** The EFFECTIVE driver: the open overlay (edit draft or what-if) if one exists, else
   *  committed state. PRIVATE — an `OpenISDDriver` is this class's internal state and never
   *  leaves it. Handing one out would let a caller mutate the driver behind the facade's
   *  back, with no notification and no what-if guard: exactly what this class exists to
   *  prevent. Every operation a caller needs is published as a method below. */
  #effective(): OpenISDDriver {
    if (this.#overlay?.kind === 'edit') return this.#overlay.draft;
    if (this.#overlay?.kind === 'whatif') return this.#overlay.overlay;
    return this.#committed;
  }

  // ---- reads on the EFFECTIVE driver — what the open charts and panels show ------------

  /** One field's value and its E/C/N provenance. */
  cell(field: SpecField): Cell { return this.#effective().cell(field); }
  /** One metadata field (brand/model/manufacturer) and its provenance. */
  metaCell(field: MetaField): MetaCell { return this.#effective().metaCell(field); }
  /** The resolved, engine-ready driver, or null when a blocking issue means nothing can be
   *  drawn. This is what the charts sweep. */
  toDriver(): EngineDriver | null { return this.#effective().toDriver(); }
  /** What the engine says stops this driver simulating. */
  errors(): DriverError[] { return this.#effective().errors(); }
  /** Stated fields that contradict each other beyond their own precision. */
  consistencyIssues(): ConsistencyIssue[] { return this.#effective().consistencyIssues(); }

  // ---- writes on the EFFECTIVE driver — the overlay when one is open ------------------

  /** Record a hand-entered value on whichever layer is effective. */
  enter(field: SpecField, value: number): void { this.#effective().enter(field, value); }
  /** Drop a hand-entered value on whichever layer is effective. */
  clear(field: SpecField): void { this.#effective().clear(field); }
  /** Record a hand-entered metadata value on whichever layer is effective. */
  enterMeta(field: MetaField, value: string): void { this.#effective().enterMeta(field, value); }
  /** Drop a hand-entered metadata value on whichever layer is effective. */
  clearMeta(field: MetaField): void { this.#effective().clearMeta(field); }

  // ---- the record, for anything persistent -------------------------------------------

  /** The record to SAVE, EXPORT or SHARE — committed state, never an open overlay. Cancels an
   *  active what-if first, as an observable side effect (`isWhatIfActive()` becomes false and
   *  the cancel notifies). That cancellation is STRUCTURAL: this is the only way to reach a
   *  persistable record, so no call site can forget the guard, which is exactly how
   *  `shareLink()` once shipped without one while every sibling had it. */
  recordToPersist(): DriverRecord {
    this.#endWhatIfIfActive();
    return this.#committed.toRecord();
  }

  /** The record exactly as loaded — what Reset goes back to. Never affected by an overlay. */
  groundRecord(): DriverRecord { return this.#ground.toRecord(); }

  isEditActive(): boolean { return this.#overlay?.kind === 'edit'; }
  isWhatIfActive(): boolean { return this.#overlay?.kind === 'whatif'; }

  // ---- edit lifecycle -------------------------------------------------------------------

  /** Open a draft over committed state. Cancels an active what-if first (this file's header).
   *  Idempotent: a second call while a draft is already open is a no-op — it does not reseed
   *  the draft from committed state, which would silently discard whatever the first session
   *  had already typed. Silent: produces no notification. */
  beginEdit(): void {
    this.#endWhatIfIfActive();
    if (this.#overlay?.kind === 'edit') return;
    this.#overlay = { kind: 'edit', draft: OpenISDDriver.fromRecord(cloneRecord(this.#committed.toRecord())) };
  }

  /** Write the draft into committed state and discard it. This write — not the act of calling
   *  commitEdit() — is what produces the one notification (this file's header). A call with
   *  no open edit is a no-op. */
  commitEdit(): void {
    if (this.#overlay?.kind !== 'edit') return;
    const draftRecord = cloneRecord(this.#overlay.draft.toRecord());
    this.#overlay = null;
    this.#committed = OpenISDDriver.fromRecord(draftRecord);
    this.#notify();
  }

  /** Discard the draft. Committed state is untouched — byte-identical to before `beginEdit()`,
   *  provenance marks included, because it was never read from. No notification: nothing
   *  about committed state changed. A call with no open edit is a no-op. */
  cancelEdit(): void {
    if (this.#overlay?.kind !== 'edit') return;
    this.#overlay = null;
  }

  // ---- what-if lifecycle ------------------------------------------------------------------

  /** Open an overlay read from committed state. Discards an active edit draft first (silently
   *  — this file's header, "never both at once"). Idempotent while a what-if is already open.
   *  Notifies once it is open, since it changes which layer `read()` resolves to. Live from
   *  here on: every `.enter()`/`.clear()` on the `OpenISDDriver` `read()` now returns
   *  re-notifies immediately. */
  beginWhatIf(): void {
    if (this.#overlay?.kind === 'whatif') return;
    if (this.#overlay?.kind === 'edit') this.#overlay = null;   // silent discard, no commit
    const overlay = OpenISDDriver.fromRecord(cloneRecord(this.#committed.toRecord()));
    const unsubscribe = overlay.subscribe(() => this.#notify());
    this.#overlay = { kind: 'whatif', overlay, unsubscribe };
    this.#notify();
  }

  /** Reset an open what-if back to the driver AS LOADED — the Tune panel's "Reset". Ends the
   *  current session and opens a fresh overlay seeded from GROUND, not from committed state:
   *  Reset goes back to the library, not to the last keystroke (`docs/design/STATE_MODEL.md`
   *  rule 5). A no-op when no what-if is open — there is nothing to reset. */
  resetOverlayToGround(): void {
    if (this.#overlay?.kind !== 'whatif') return;
    this.#endWhatIfIfActive();
    const overlay = OpenISDDriver.fromRecord(cloneRecord(this.#ground.toRecord()));
    const unsubscribe = overlay.subscribe(() => this.#notify());
    this.#overlay = { kind: 'whatif', overlay, unsubscribe };
    this.#notify();
  }

  /** Discard the what-if overlay — the ONLY way a what-if session ends; there is no
   *  `commitWhatIf()`, ever. Committed state was never touched. Notifies, since it changes
   *  which layer `read()` resolves back to. A call with no open what-if is a no-op. */
  cancelWhatIf(): void {
    this.#endWhatIfIfActive();
  }

  #endWhatIfIfActive(): void {
    if (this.#overlay?.kind !== 'whatif') return;
    this.#overlay.unsubscribe();
    this.#overlay = null;
    this.#notify();
  }

  // ---- load / switch ------------------------------------------------------------------

  /** Adopt `driver` as a freshly-chosen driver: ground and committed both become independent
   *  copies of it (`docs/design/STATE_MODEL.md` rule 5). Cancels any active overlay first —
   *  loading/switching driver is a named trigger of the what-if-never-leaks rule, and an open
   *  edit draft over the driver being replaced has nothing left to commit onto. Notifies once. */
  #loadDriver(driver: OpenISDDriver): void {
    if (this.#overlay?.kind === 'whatif') { this.#overlay.unsubscribe(); }
    this.#overlay = null;
    const cloned = cloneRecord(driver.toRecord());
    this.#ground = OpenISDDriver.fromRecord(cloneRecord(cloned));
    this.#committed = OpenISDDriver.fromRecord(cloned);
    this.#notify();
  }

  // ---- subscription ---------------------------------------------------------------------

  subscribe(fn: ManagedDriverListener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #notify(): void {
    for (const fn of [...this.#listeners]) fn();
  }
}
