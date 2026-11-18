/**
 * Asks the user to save, when Cloud sync is on: it sends saved versions only, so a project with
 * unsaved edits stays on this device (John, 18 Nov 2026, QO946.c245 "ok do that").
 *
 * After UNSAVED_ASK_AFTER_MS of unsaved edits on a project the bar appears, for that project once per
 * app session, and never while a dialog is open. Save saves that project; Later hides the bar for
 * the session. With sync off nothing is counted and nothing appears. The screens only show `bar`.
 */
import {shallowRef, type Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {savedMessage} from '@openisd/design/fields';
import {
  UNSAVED_ASK_AFTER_MS,
  unsavedBarOf,
  type UnsavedBar,
  type UnsavedProject,
} from '@openisd/design/cloud';
import type {Timer} from '@openisd/persistence';

export interface UnsavedNudgeDeps {
  readonly openProjects: () => readonly OpenISDProject[];
  readonly hasUnsaved: (project: OpenISDProject) => boolean;
  readonly nameOf: (project: OpenISDProject) => string;
  /** Cloud sync is on (connected in any state). */
  readonly syncOn: () => boolean;
  /** Any dialog is open: the bar waits. */
  readonly dialogOpen: () => boolean;
  readonly now: () => number;
  readonly timer: Timer;
  /** Saves one open project; false when the save was refused. */
  readonly save: (project: OpenISDProject) => Promise<boolean>;
  readonly flash: (message: string) => void;
}

export interface UnsavedNudge {
  /** The bar to show now, or null. */
  readonly bar: Readonly<Ref<UnsavedBar | null>>;
  /** The open projects whose unsaved changes are not synced: empty while sync is off. */
  unsavedProjects(): readonly UnsavedProject[];
  /** Saves the project `id` and says so; true when it was saved. */
  save(id: string): Promise<boolean>;
  /** Later: hides the bar for the rest of the session. */
  later(): void;
  /** One look at the open projects; the timer calls it every TICK_MS. */
  tick(): void;
  /** Stops the timer. */
  stop(): void;
}

/** How often the open projects are looked at. */
const TICK_MS = 10_000;

export function createUnsavedNudge(deps: UnsavedNudgeDeps): UnsavedNudge {
  const bar = shallowRef<UnsavedBar | null>(null);
  /** When each project was first seen with unsaved edits (while sync is on). */
  const unsavedSince = new Map<string, number>();
  /** Projects already asked this session, whatever the answer. */
  const asked = new Set<string>();

  function projectById(id: string): OpenISDProject | null {
    return deps.openProjects().find(p => p.uuid() === id) ?? null;
  }

  function unsavedProjects(): readonly UnsavedProject[] {
    if (!deps.syncOn()) return [];
    return deps.openProjects().filter(deps.hasUnsaved).map(p => ({id: p.uuid(), name: deps.nameOf(p)}));
  }

  function tick(): void {
    if (!deps.syncOn()) {
      unsavedSince.clear();
      bar.value = null;
      return;
    }
    const now = deps.now();
    const unsaved = unsavedProjects();
    const ids = new Set(unsaved.map(p => p.id));
    for (const id of [...unsavedSince.keys()]) if (!ids.has(id)) unsavedSince.delete(id);
    for (const id of ids) if (!unsavedSince.has(id)) unsavedSince.set(id, now);
    if (bar.value !== null && !ids.has(bar.value.id)) bar.value = null;
    if (bar.value !== null || deps.dialogOpen()) return;
    const due = unsaved.find(p => !asked.has(p.id) && now - (unsavedSince.get(p.id) ?? now) >= UNSAVED_ASK_AFTER_MS);
    if (due === undefined) return;
    asked.add(due.id);
    bar.value = unsavedBarOf(due);
  }

  async function save(id: string): Promise<boolean> {
    const project = projectById(id);
    if (project === null) return false;
    const saved = await deps.save(project);
    if (!saved) return false;
    deps.flash(savedMessage(deps.nameOf(project)));
    unsavedSince.delete(id);
    if (bar.value?.id === id) bar.value = null;
    return true;
  }

  function later(): void {
    bar.value = null;
  }

  const stop = deps.timer.every(TICK_MS, tick);
  return {bar, unsavedProjects, save, later, tick, stop};
}
