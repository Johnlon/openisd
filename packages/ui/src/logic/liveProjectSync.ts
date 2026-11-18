/**
 * Cloud sync sends the whole project, unsaved edits included (John, 18 Nov 2026, QO946.c247: "why are we
 * sending on saved state and not entire project? why force user to do anything"; c248: option A).
 *
 * Each open project's saved entry holds its saved checkpoint AND its unsaved edits, so a sync run sends
 * both and the other device shows the same checkpoint and the same unsaved edits (Revert means the same
 * on both). SYNC_AFTER_EDIT_MS after the last edit the unsaved layers are written and a run starts; every
 * run writes them first too (`flush`, called by the wiring), so a run never sends less than is on screen.
 * Closing a project without saving clears its unsaved layer in the store, and that is sent as well.
 * An entry that holds another version than the one the open project was last written as (a pull came
 * first) is never written over: the open project is kept as a conflict copy and that is announced.
 * With Cloud sync not connected nothing here writes or runs.
 */
import {effectScope, watch} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {SYNC_AFTER_EDIT_MS} from '@openisd/design/cloud';
import type {ProjectRepo, Timer} from '@openisd/persistence';
import type {AppState} from './appState.js';

export interface LiveProjectSyncDeps {
  readonly appState: Pick<AppState, 'openProjects' | 'projectChanged'>;
  readonly projectRepo: Pick<ProjectRepo, 'storeWithUnsavedLayer' | 'savedStampOf' | 'dropUnsavedLayer'>;
  /** Cloud sync is connected. */
  readonly active: () => boolean;
  readonly timer: Timer;
  /** Starts a sync run now. */
  readonly push: () => void;
  /** Keeps `project` as a conflict copy and announces it: its entry holds another version. */
  readonly keepBoth: (project: OpenISDProject) => void;
}

export interface LiveProjectSync {
  /** Writes every open project's unsaved layer to its saved entry; how many entries changed. */
  flush(): number;
  /** Stops watching the open projects and drops a pending push. */
  stop(): void;
}

export function startLiveProjectSync(deps: LiveProjectSyncDeps): LiveProjectSync {
  const {appState, projectRepo} = deps;
  let cancelPending: (() => void) | null = null;
  /** The `modified` stamp each open project's entry had when the project appeared or was last written. Shared by
   *  every tab (a Save, a pull or a conflict copy changes it; these writes do not), so tabs never conflict. */
  const base = new WeakMap<OpenISDProject, string>();

  /** Writes one project's unsaved layer; true when the store changed (its entry, or a conflict copy). */
  function store(project: OpenISDProject): boolean {
    const result = projectRepo.storeWithUnsavedLayer(project, base.get(project) ?? null);
    switch (result.kind) {
      case 'written':
      case 'same':
        base.set(project, result.stamp);
        return result.kind === 'written';
      case 'moved':
        // Its edits are not lost and the other version is not overwritten: both are kept.
        if (!project.isModified()) return false;
        deps.keepBoth(project);
        return true;
      case 'idle':
      case 'notStored':
      case 'refused':
        return false;
    }
  }

  function flush(): number {
    if (!deps.active()) return 0;
    return appState.openProjects().filter(store).length;
  }

  /** A change to an open project: the push waits until the edits have stopped for SYNC_AFTER_EDIT_MS. */
  function changed(): void {
    if (!deps.active()) return;
    cancelPending?.();
    cancelPending = deps.timer.after(SYNC_AFTER_EDIT_MS, () => {
      cancelPending = null;
      if (flush() > 0) deps.push();
    });
  }

  /** Projects the user closed (the open count fell and their id is open no more) lose their unsaved layer.
   *  A project swapped for its pulled version or for another tab's copy keeps its id, and is not closed. */
  function openChanged(now: readonly OpenISDProject[], before: readonly OpenISDProject[]): void {
    if (!deps.active()) return;
    // A project that has just appeared (opened, shown as pulled, restored, adopted from another tab) comes from its
    // entry as it is now: that entry is its base, so its edits and Revert are written over it and nothing else.
    const appeared = now.filter(project => !before.includes(project)).filter(project => {
      const stamp = projectRepo.savedStampOf(project.uuid());
      if (stamp !== null) base.set(project, stamp);
      return store(project);
    }).length;
    if (appeared > 0) deps.push();
    if (now.length >= before.length) return;
    const stillOpen = new Set(now.map(project => project.uuid()));
    const closed = before.filter(project => !now.includes(project) && !stillOpen.has(project.uuid()));
    const cleared = closed.filter(project => projectRepo.dropUnsavedLayer(project.uuid()) === 'written').length;
    if (cleared > 0) deps.push();
  }

  const scope = effectScope(true);
  scope.run(() => {
    watch(appState.projectChanged, changed);
    watch(() => appState.openProjects(), openChanged);
  });

  return {
    flush,
    stop: () => {
      scope.stop();
      cancelPending?.();
      cancelPending = null;
    },
  };
}
