/**
 * `ManagedDriver` — the one facade over every driver state layer (ARCHITECTURE.md §3
 * "`ManagedDriver` — the one facade over every state layer"). Nothing outside it may read or
 * write ground state, modified state, or the edit/what-if overlay directly — a component, a
 * workflow, a service, anything, reaches a driver's state only through this class.
 *
 * Wraps three things (`docs/design/STATE_MODEL.md`'s layer table, given a single owning
 * object):
 *   - ground state    — that document's Baseline/Ground: the driver exactly as loaded.
 *   - modified state   — that document's Committed design: the live `OpenISDDriver` the
 *                          charts are drawn from, held as an `OpenISDDriver`.
 *   - an overlay        — a Dialog draft (editing) OR a What-if overlay — never both at once.
 *
 * ── The edit lifecycle ──
 * `beginEdit()` opens a draft over modified state. `commitEdit()` writes the draft into
 * modified state and discards the draft. `cancelEdit()` discards the draft without writing
 * anything — modified state is byte-identical to before `beginEdit()`, provenance marks
 * included.
 *
 * ── The what-if lifecycle ──
 * `beginWhatIf()` opens an overlay read from modified state. `cancelWhatIf()` discards it.
 * There is no `commitWhatIf()` — a what-if explores values the app cannot verify against
 * physical reality, so nothing ever promotes one into the design. The only way a what-if
 * session ends is `cancelWhatIf()`, and it always discards.
 *
 * ── Subscription is single-channel ──
 * A consumer subscribes to `ManagedDriver` and to nothing beneath it — `read()` hands back the
 * live `OpenISDDriver` for the CALLER to mutate (`.enter()`/`.clear()`) or inspect
 * (`.cell()`/`.errors()`/…), but `ManagedDriver` alone decides when a *subscriber of
 * `ManagedDriver`* is notified:
 *   - An edit draft is silent. Typing into an open edit (calling `.enter()`/`.clear()` on the
 *     `OpenISDDriver` `read()` returns during an edit) produces no notification, because
 *     `ManagedDriver` never subscribes to the draft's own `subscribe()`. `commitEdit()` writes
 *     the draft into modified state, and it is THAT WRITE — not the act of committing — that
 *     triggers the one notification a subscriber receives.
 *   - A what-if overlay is live. `ManagedDriver` subscribes to the overlay's own `subscribe()`
 *     for as long as it is open, so every change re-fires immediately.
 *     `beginWhatIf()`/`cancelWhatIf()` themselves also notify, since they change which layer
 *     `read()` resolves to.
 *
 * ── A what-if never leaks into anything persistent (ARCHITECTURE.md §3) ──
 * Its value is unverified against physical reality — nothing outside the live overlay is
 * allowed to see it. `ManagedDriver` cancels any active what-if ITSELF, before every operation
 * that reads modified state for a purpose beyond driving the open charts: `beginEdit()`,
 * `readModified()` (the one path a save/export/share-link/My-Drivers-save/driver-switch
 * operation must go through to reach modified state), and `load()`. This is `ManagedDriver`'s
 * own responsibility, not the caller's — the bug this closes structurally is real: today's
 * `packages/ui/src/logic/useDesignIO.ts` has a function `endAnyActiveWhatIfBeforeIO()`,
 * correctly called at the top of `saveProject`/`saveProjectAs`/`exportWdr`/`exportWpr`/
 * `exportOwdr`, but NOT `shareLink()` — a scattered per-call-site guard that one call site
 * forgot. Once callers read modified state only through `readModified()`, there is no path to
 * it that bypasses the cancel.
 *
 * ── "Never both at once" ──
 * `beginEdit()` cancels an active what-if first (the rule above). Symmetrically,
 * `beginWhatIf()` discards an active edit draft first (silently — an open, uncommitted draft
 * produces no notification per the asymmetry above, so discarding it produces none either):
 * an edit draft and a what-if overlay are two readings of "the one overlay slot", and only
 * `ManagedDriver` may decide which one occupies it.
 */
import { OpenISDDriver } from '@openisd/model';

export type ManagedDriverListener = () => void;

type Overlay =
  | { kind: 'edit'; draft: OpenISDDriver }
  | { kind: 'whatif'; overlay: OpenISDDriver; unsubscribe: () => void };

/** A deep copy of a driver's own record, safe to hold without aliasing the caller's
 *  object graph — every `OpenISDDriver.fromRecord` call in this file passes one of
 *  these, never a record another layer of `ManagedDriver` is still holding a reference
 *  to; without it, editing the draft would mutate ground/modified through the shared
 *  object graph, since `OpenISDDriver` does not clone what it is handed (`private
 *  constructor(record)`). Generic because the record's shape has no exported name —
 *  `OpenISDDriver` is the one external form (`@openisd/model`). */
function cloneRecord<T>(record: T): T {
  return structuredClone(record);
}

export class ManagedDriver {
  #ground: OpenISDDriver;
  #modified: OpenISDDriver;
  #overlay: Overlay | null = null;
  readonly #listeners = new Set<ManagedDriverListener>();

  private constructor(ground: OpenISDDriver, modified: OpenISDDriver) {
    this.#ground = ground;
    this.#modified = modified;
  }

  /** Build a `ManagedDriver` with ground and modified both seeded from `driver` — the state
   *  the moment a driver is chosen/loaded (`docs/design/STATE_MODEL.md` rule 5, "the baseline
   *  is the driver as chosen"). The two are independent copies from the first instant. */
  static create(driver: OpenISDDriver): ManagedDriver {
    const record = driver.toRecord();
    return new ManagedDriver(
      OpenISDDriver.fromRecord(cloneRecord(record)),
      OpenISDDriver.fromRecord(cloneRecord(record)),
    );
  }

  // ---- reads --------------------------------------------------------------------------

  /** The EFFECTIVE driver: the open overlay (edit draft or what-if) if one exists, else
   *  modified state. What the open charts, the stat bar, and an open editor's own fields
   *  read and (for an edit draft or what-if overlay) mutate directly. Never cancels anything
   *  — this is "driving the open charts", the one case `ARCHITECTURE.md` §3 excludes from the
   *  what-if cancellation rule. */
  read(): OpenISDDriver {
    if (this.#overlay?.kind === 'edit') return this.#overlay.draft;
    if (this.#overlay?.kind === 'whatif') return this.#overlay.overlay;
    return this.#modified;
  }

  /** Modified state for a purpose BEYOND driving the open charts: saving the project,
   *  saving-as, exporting `.wdr`/`.owdr`/`.wpr`, generating a share link, saving to My
   *  Drivers. Cancels an active what-if first, as an observable side effect
   *  (`isWhatIfActive()` becomes false, and the cancel's own notification fires) — see this
   *  file's header. Never returns an open edit draft; an edit is a separate, still-committed
   *  session and this always reads the last COMMITTED modified state. */
  readModified(): OpenISDDriver {
    this.#endWhatIfIfActive();
    return this.#modified;
  }

  /** The driver exactly as loaded — what Reset returns to (`docs/design/STATE_MODEL.md` rule
   *  5). Never affected by an overlay. */
  readGround(): OpenISDDriver {
    return this.#ground;
  }

  isEditActive(): boolean { return this.#overlay?.kind === 'edit'; }
  isWhatIfActive(): boolean { return this.#overlay?.kind === 'whatif'; }

  // ---- edit lifecycle -------------------------------------------------------------------

  /** Open a draft over modified state. Cancels an active what-if first (this file's header).
   *  Idempotent: a second call while a draft is already open is a no-op — it does not reseed
   *  the draft from modified state, which would silently discard whatever the first session
   *  had already typed. Silent: produces no notification. */
  beginEdit(): void {
    this.#endWhatIfIfActive();
    if (this.#overlay?.kind === 'edit') return;
    this.#overlay = { kind: 'edit', draft: OpenISDDriver.fromRecord(cloneRecord(this.#modified.toRecord())) };
  }

  /** Write the draft into modified state and discard it. This write — not the act of calling
   *  commitEdit() — is what produces the one notification (this file's header). A call with
   *  no open edit is a no-op. */
  commitEdit(): void {
    if (this.#overlay?.kind !== 'edit') return;
    const draftRecord = cloneRecord(this.#overlay.draft.toRecord());
    this.#overlay = null;
    this.#modified = OpenISDDriver.fromRecord(draftRecord);
    this.#notify();
  }

  /** Discard the draft. Modified state is untouched — byte-identical to before `beginEdit()`,
   *  provenance marks included, because it was never read from. No notification: nothing
   *  about modified state changed. A call with no open edit is a no-op. */
  cancelEdit(): void {
    if (this.#overlay?.kind !== 'edit') return;
    this.#overlay = null;
  }

  // ---- what-if lifecycle ------------------------------------------------------------------

  /** Open an overlay read from modified state. Discards an active edit draft first (silently
   *  — this file's header, "never both at once"). Idempotent while a what-if is already open.
   *  Notifies once it is open, since it changes which layer `read()` resolves to. Live from
   *  here on: every `.enter()`/`.clear()` on the `OpenISDDriver` `read()` now returns
   *  re-notifies immediately. */
  beginWhatIf(): void {
    if (this.#overlay?.kind === 'whatif') return;
    if (this.#overlay?.kind === 'edit') this.#overlay = null;   // silent discard, no commit
    const overlay = OpenISDDriver.fromRecord(cloneRecord(this.#modified.toRecord()));
    const unsubscribe = overlay.subscribe(() => this.#notify());
    this.#overlay = { kind: 'whatif', overlay, unsubscribe };
    this.#notify();
  }

  /** Discard the what-if overlay — the ONLY way a what-if session ends; there is no
   *  `commitWhatIf()`, ever. Modified state was never touched. Notifies, since it changes
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

  /** Adopt `driver` as a freshly-chosen driver: ground and modified both become independent
   *  copies of it (`docs/design/STATE_MODEL.md` rule 5). Cancels any active overlay first —
   *  loading/switching driver is a named trigger of the what-if-never-leaks rule, and an open
   *  edit draft over the driver being replaced has nothing left to commit onto. Notifies once. */
  load(driver: OpenISDDriver): void {
    if (this.#overlay?.kind === 'whatif') { this.#overlay.unsubscribe(); }
    this.#overlay = null;
    const cloned = cloneRecord(driver.toRecord());
    this.#ground = OpenISDDriver.fromRecord(cloneRecord(cloned));
    this.#modified = OpenISDDriver.fromRecord(cloned);
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
