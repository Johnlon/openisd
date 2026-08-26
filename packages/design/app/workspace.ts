// THE PROTOTYPE APP — the proxy consumer.
//
// It stands in for the real UI and is bound by the same rule: it imports ONLY the package's
// published surface (`@openisd/design` and `@openisd/design/browser`), never a relative path into
// `domain/`. That constraint is the point. Anything this file cannot express is a gap in the
// public API, not a gap in the app — and it will show up here as code that does not compile
// rather than as a discovery made months later while wiring Vue.
//
// It is a WORKSPACE: the set of projects a user has open, which one is focused, and the
// persistence trigger. No rendering, no framework — those are the real app's business. What is
// modelled here is exactly the part that has to be right before any framework is chosen.

import {
  newProject,
  type ManagedProject,
  type OpenISDDriver,
  type ProjectRepo,
  type ProjectListing,
  type DeleteChallenge,
  type DeleteOutcome,
} from '@openisd/design';

/**
 * The open projects and the focus, over a repo.
 *
 * FOCUS IS BY UUID, not by index. An index into a list is invalidated by every open, close and
 * reorder, so it names a different project depending on when it is read; a uuid names the same
 * project for as long as that project exists. This is the shape the real app needs and does not
 * currently have — `appState.ts` still focuses by integer index (QO92).
 */
export class Workspace {
  readonly #repo: ProjectRepo;
  #open: ManagedProject[] = [];
  #focused: string | null = null;
  /** One unsubscribe per open project — dropped when the project closes, so a closed project's
   *  notifications stop reaching the autosave trigger and it can be garbage-collected. */
  readonly #unsubscribes = new Map<string, () => void>();

  constructor(repo: ProjectRepo) {
    this.#repo = repo;
  }

  /** Every open project, in the order they were opened. */
  projects(): readonly ManagedProject[] { return this.#open; }

  /** The focused project, or null when nothing is open — the state the real app must render an
   *  empty view for, rather than dereferencing. */
  focused(): ManagedProject | null {
    return this.#open.find(p => p.uuid() === this.#focused) ?? null;
  }

  /** Focus an already-open project. Unknown uuid is ignored: focus is a view concern, and a
   *  stale click is not worth an exception. */
  focus(uuid: string): void {
    if (this.#open.some(p => p.uuid() === uuid)) this.#focused = uuid;
  }

  /**
   * Start a new design on `driver`, open it and focus it.
   *
   * NOT saved yet: a project the user has not touched has nothing worth storing, and saving on
   * creation would fill the store with blank entries every time someone clicks New.
   */
  create(driver: OpenISDDriver, volume_m3: number): ManagedProject {
    return this.#adopt(newProject(driver).sealed().volume_m3(volume_m3).build());
  }

  /** What the store holds, for a picker — most-recently-modified first. */
  stored(): ProjectListing[] { return this.#repo.list(); }

  /**
   * Open a stored project, or report why it cannot be opened.
   *
   * ALREADY OPEN? FOCUS IT. A loaded project adopts the store key as its identity, so an entry
   * that is already open is recognisable by uuid — and loading it again would give the user two
   * editable copies of one design, both autosaving to the same entry, with the last write
   * winning silently. Focusing is what the user meant by clicking it.
   */
  open(id: string): ManagedProject | string[] {
    const already = this.#open.find(p => p.uuid() === id);
    if (already) { this.#focused = already.uuid(); return already; }

    const loaded = this.#repo.load(id);
    return Array.isArray(loaded) ? loaded : this.#adopt(loaded);
  }

  /**
   * Close a project: stop autosaving it and drop it from memory.
   *
   * Its STORED entry is untouched — closing is not deleting. Whether that is the behaviour the
   * real app wants is still open (QO92); what this prototype settles is that the two operations
   * are separable, and that closing does not need a store call at all.
   */
  close(uuid: string): void {
    this.#unsubscribes.get(uuid)?.();
    this.#unsubscribes.delete(uuid);
    this.#open = this.#open.filter(p => p.uuid() !== uuid);
    if (this.#focused === uuid) this.#focused = this.#open.at(-1)?.uuid() ?? null;
  }

  /** Delete a stored entry, challenged. Open projects are unaffected — one of them may well be a
   *  copy loaded from the entry being deleted, and it keeps its own in-memory identity. */
  deleteStored(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome> {
    return this.#repo.remove(id, confirm);
  }

  /**
   * Take ownership of a project: open it, focus it, and wire the AUTOSAVE TRIGGER.
   *
   * THE TRIGGER IS THE PROJECT'S OWN NOTIFICATION, not a framework's. `subscribe()` fires on every
   * change to whichever layer is effective, so each open project is its own writer and an
   * UNFOCUSED project autosaves exactly like a focused one — the defect that sank the previous
   * autosave, which routed everything through a single focused-project signal (QO92).
   *
   * Saving on EVERY notification is the simplest trigger that can be correct, and is deliberately
   * not debounced here: how much work may be lost is a product decision, and burying it in a
   * timer would be deciding it by accident. Measure first.
   */
  #adopt(project: ManagedProject): ManagedProject {
    this.#open.push(project);
    this.#focused = project.uuid();
    this.#unsubscribes.set(project.uuid(), project.subscribe(() => this.#repo.save(project)));
    return project;
  }
}
