/**
 * Stores every project in browser storage as soon as it is open (John, 17 Oct 2026), so no open
 * project is ever "never saved": the stored list holds them all, and only edits made after that
 * are unsaved changes. A project the store will not take is not created: it is closed again and
 * the user is told.
 */
import {watch} from 'vue';
import type {ProjectRepo} from '@openisd/persistence';
import type {AppState} from './appState.js';

export interface NewProjectStoreDeps {
  readonly projectRepo: Pick<ProjectRepo, 'isStored' | 'storeNew'>;
  readonly appState: Pick<AppState, 'openProjects' | 'removeProject'>;
  /** Called once for each project the store would not take (it has been closed again). */
  readonly onFailed: () => void;
}

/** Start storing. Stores what is open now, then each project as it opens. Returns the stop. */
export function startStoringNewProjects(deps: NewProjectStoreDeps): () => void {
  const {projectRepo, appState} = deps;
  const storeOpen = (closeRefused: boolean): void => {
    for (const project of [...appState.openProjects()]) {
      const open = appState.openProjects();
      if (projectRepo.isStored(project, open)) continue;
      if (projectRepo.storeNew(project, open).kind === 'failed') {
        if (closeRefused) appState.removeProject(open.indexOf(project));
        deps.onFailed();
      }
    }
  };
  // What was open before this started is the user's already: a refusal is reported, not closed.
  storeOpen(false);
  return watch(() => appState.openProjects().length, () => storeOpen(true), {flush: 'sync'});
}
