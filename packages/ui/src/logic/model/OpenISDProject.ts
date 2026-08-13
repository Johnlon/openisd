import type { BoxType, DriverJSON, ProjectMeta, UiParams } from '../../types.js';

/**
 * A project, as one thing.
 *
 * A project is an independent document: `{ id, name, box, P, driver, meta }` and nothing
 * else. It never contains, references or reconstructs another project — that is what made
 * saving one design write copies of the others into its file (see docs/design/STATE_MODEL.md).
 *
 * The class owns the project's whole memory, as layers:
 *
 *   ground     what the file on disk says — the last state saved or loaded.
 *   modified   what the user has since done to it. This IS the project's current content.
 *   transient  a live trial (a what-if scrub, a dialog draft) that reads as the content
 *              while it exists, and is either kept into `modified` or thrown away.
 *
 * Reads resolve to the highest layer that exists: transient if one is running, else
 * modified. `isModified` is derived by comparing modified against ground — never stored,
 * so it cannot disagree with the values.
 *
 * Saving writes the modified layer as the sole content of the `.owpr`, and that written
 * state becomes the new ground: after a save there is, by definition, nothing unsaved.
 * Loading an `.owpr` is the mirror image — the loaded state becomes the ground, and the
 * project opens clean.
 *
 * Framework-free by design (no Vue, no DOM): the UI binds to it, it knows nothing of the UI.
 */

/** Everything a project IS. Not what the app is currently showing of it. */
export interface ProjectContent {
  box: BoxType;
  P: UiParams;
  driver: DriverJSON;
  meta: ProjectMeta;
}

/** The `.owpr` payload: a version stamp and the project's content. One project per file. */
export interface OwprFile {
  v: number;
  name: string;
  content: ProjectContent;
}

export const OWPR_VERSION = 1;

let seq = 0;
function newId(): string {
  seq += 1;
  return `proj-${seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Deep copy, so no two layers (or two projects) can ever share a mutable object. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Order-stable comparison of two contents — the "is this modified?" test. */
function same(a: ProjectContent, b: ProjectContent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class OpenISDProject {
  readonly id: string;
  #ground: ProjectContent | null;   // null = never saved or loaded: nothing to be clean against
  #modified: ProjectContent;
  #transient: ProjectContent | null = null;

  private constructor(content: ProjectContent, ground: ProjectContent | null, id?: string) {
    this.id = id ?? newId();
    this.#modified = clone(content);
    this.#ground = ground ? clone(ground) : null;
  }

  // ── construction ──────────────────────────────────────────────────────────────

  /** A brand-new project. It has no file behind it, so it reads as unsaved from birth. */
  static create(content: ProjectContent): OpenISDProject {
    return new OpenISDProject(content, null);
  }

  /** Open an `.owpr`. The state in the file becomes the ground — the project opens clean. */
  static fromOwpr(file: OwprFile): OpenISDProject {
    const content = clone(file.content);
    if (file.name && !content.meta.name) content.meta.name = file.name;
    return new OpenISDProject(content, content);
  }

  /**
   * Re-create a project from a workspace snapshot: its content, and the ground it had when
   * the session ended, so a project that was clean before a refresh is still clean after it.
   */
  static restore(content: ProjectContent, ground: ProjectContent | null, id: string): OpenISDProject {
    return new OpenISDProject(content, ground, id);
  }

  /**
   * Copy this project. The copy carries its own contents and NOTHING else — no file, no
   * shared ground, no reference back to what it was copied from. Like any project with no
   * file behind it, it is unsaved until it is saved.
   */
  copy(name: string): OpenISDProject {
    const content = clone(this.content());
    content.meta = { ...content.meta, name };
    return new OpenISDProject(content, null);
  }

  // ── reading ───────────────────────────────────────────────────────────────────

  /** The project's current content: the trial if one is running, else the working state. */
  content(): ProjectContent {
    return clone(this.#transient ?? this.#modified);
  }

  /** What the file says. Null when this project has never been saved or loaded. */
  groundContent(): ProjectContent | null {
    return this.#ground ? clone(this.#ground) : null;
  }

  get name(): string {
    return (this.#transient ?? this.#modified).meta.name ?? '';
  }

  /** True when the working state differs from the file — including "there is no file yet". */
  get isModified(): boolean {
    if (!this.#ground) return true;
    return !same(this.#modified, this.#ground);
  }

  /** True when there is a saved state to go back to. */
  get canRevert(): boolean {
    return this.#ground !== null;
  }

  get hasTransient(): boolean {
    return this.#transient !== null;
  }

  // ── writing ───────────────────────────────────────────────────────────────────

  /** Replace the working state. A running trial is left alone — it is what is on screen. */
  update(content: ProjectContent): void {
    this.#modified = clone(content);
  }

  /** Discard everything done since the last save. No-op when there is no saved state. */
  revert(): void {
    if (!this.#ground) return;
    this.#transient = null;
    this.#modified = clone(this.#ground);
  }

  // ── the trial layer ───────────────────────────────────────────────────────────

  /** Start a trial from the current content. Idempotent. */
  beginTransient(): void {
    if (!this.#transient) this.#transient = clone(this.#modified);
  }

  /** Feed the running trial. Ignored when no trial is running — a trial cannot be implied. */
  setTransient(content: ProjectContent): void {
    if (this.#transient) this.#transient = clone(content);
  }

  /** Adopt the trial as the working state. The project is now modified, as you would expect. */
  keepTransient(): void {
    if (!this.#transient) return;
    this.#modified = this.#transient;
    this.#transient = null;
  }

  /** Throw the trial away. The working state is untouched, byte for byte. */
  discardTransient(): void {
    this.#transient = null;
  }

  // ── saving ────────────────────────────────────────────────────────────────────

  /**
   * The bytes to write. A running trial is NOT saved: saving writes the project, and a
   * trial is by definition something the user has not committed to it.
   */
  toOwpr(): OwprFile {
    return { v: OWPR_VERSION, name: this.name, content: clone(this.#modified) };
  }

  /**
   * Call after the bytes are safely written. What was saved becomes the ground, so the
   * project is clean — there is nothing unsaved the instant the save succeeds.
   */
  markSaved(): void {
    this.#ground = clone(this.#modified);
  }
}
