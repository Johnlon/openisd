// THE PROTOTYPE APP — the proxy consumer.
//
// It stands in for the real UI and is bound by the same rule: it imports ONLY the package's
// published surface (`@openisd/design` and `@openisd/design/browser`), never a relative path into
// `domain/`. That constraint is the point. Anything this file cannot express is a gap in the
// public API, not a gap in the app — and it will show up here as code that does not compile
// rather than as a discovery made months later while wiring Vue.
//
// It is a WORKSPACE: the set of projects a user has open, and which one is focused.

import {
  newProject,
  type OpenISDProject,
  type OpenISDDriver,
  type ProjectRepo,
  type ProjectListing,
  type DeleteChallenge,
  type DeleteOutcome,
} from '@openisd/design';
import { Engine } from '@openisd/design/engine';

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
  /** The one calculation surface, on its way to every project this workspace creates. */
  readonly #engine: Engine;
  #open: OpenISDProject[] = [];
  #focused: string | null = null;
  constructor(repo: ProjectRepo, engine: Engine) {
    this.#repo = repo;
    this.#engine = engine;
  }

  /** Every open project, in the order they were opened. */
  projects(): readonly OpenISDProject[] { return this.#open; }

  /** The focused project, or null when nothing is open — the state the real app must render an
   *  empty view for, rather than dereferencing. */
  focused(): OpenISDProject | null {
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
  create(driver: OpenISDDriver, volume_m3: number): OpenISDProject {
    return this.#adopt(newProject(driver, this.#engine).sealed().volume_m3(volume_m3).build());
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
  open(id: string): OpenISDProject | string[] {
    const already = this.#open.find(p => p.uuid() === id);
    if (already) { this.#focused = already.uuid(); return already; }

    const loaded = this.#repo.load(id);
    return Array.isArray(loaded) ? loaded : this.#adopt(loaded);
  }

  /** Close a project: drop it from memory. Its STORED entry is untouched. */
  close(uuid: string): void {
    this.#open = this.#open.filter(p => p.uuid() !== uuid);
    if (this.#focused === uuid) this.#focused = this.#open.at(-1)?.uuid() ?? null;
  }

  /** Delete a stored entry, challenged. Open projects are unaffected — one of them may well be a
   *  copy loaded from the entry being deleted, and it keeps its own in-memory identity. */
  deleteStored(id: string, confirm: DeleteChallenge): Promise<DeleteOutcome> {
    return this.#repo.remove(id, confirm);
  }

  /** Open a project and focus it. Nothing is written to the store. */
  #adopt(project: OpenISDProject): OpenISDProject {
    this.#open.push(project);
    this.#focused = project.uuid();
    return project;
  }
}
