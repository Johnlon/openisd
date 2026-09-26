/**
 * Keeps this tab's session and every other tab's the same: this tab's changes are saved for the
 * others, and a session or view another tab saves is adopted here.
 *
 * An adopted session is never saved back. Reading a project mints its embedded driver a fresh
 * id, so a tab that saved what it had just adopted would write different text, every other tab
 * would hear a change and adopt it in turn, and the tabs would echo one record forever.
 * bugs/BUG_20260926_tabs-overwrite-each-others-open-projects.md
 */
import {effectScope, nextTick, watch} from 'vue';
import type {ProjectRepo, ViewStateRepo} from '@openisd/persistence';
import {applyViewSnapshot, currentViewSnapshot, focusedProject, openProjects, projectChanged, restoreProjects} from './appState.js';

/** The storage doors the sync reads and writes through. */
export interface SessionSyncDeps {
  readonly projectRepo: Pick<ProjectRepo, 'saveOpenProjects' | 'loadOpenProjects' | 'watchOpenProjects'>;
  readonly viewStateRepo: Pick<ViewStateRepo, 'save' | 'load' | 'watch'>;
}

/** Start saving and adopting. Returns the call that stops both. Call it after the boot has
 *  restored the session, never before — a save armed during the boot overwrites what it reads. */
export function startSessionSync(deps: SessionSyncDeps): () => void {
  let adopting = false;
  const saveProjects = () => { if (!adopting) deps.projectRepo.saveOpenProjects(openProjects(), focusedProject()); };
  const saveView = () => { if (!adopting) deps.viewStateRepo.save(currentViewSnapshot()); };

  /** Apply another tab's write, holding saves off until the watchers it sets off have run. */
  async function adopt(apply: () => void): Promise<void> {
    adopting = true;
    try {
      apply();
      await nextTick();
    } finally {
      adopting = false;
    }
  }

  const scope = effectScope();
  scope.run(() => {
    watch(projectChanged, saveProjects);
    watch(() => [openProjects().length, focusedProject()?.uuid() ?? null], saveProjects);
    watch(currentViewSnapshot, saveView, {deep: true});
  });

  const stopProjects = deps.projectRepo.watchOpenProjects(() => void adopt(() => {
    const session = deps.projectRepo.loadOpenProjects();
    // A record another tab wrote that will not read is that tab's to report; this tab keeps
    // what it has rather than dropping its projects for an unreadable record.
    if (session === null || Array.isArray(session)) return;
    restoreProjects(session.projects, session.focusedIndex);
  }));
  const stopView = deps.viewStateRepo.watch(() => void adopt(() => {
    const view = deps.viewStateRepo.load();
    if (view) applyViewSnapshot(view);
  }));

  return () => {
    stopProjects();
    stopView();
    scope.stop();
  };
}
