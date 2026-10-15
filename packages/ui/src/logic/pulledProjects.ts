/**
 * Open projects follow what cloud sync pulled. A saved project a pull replaced is shown in place
 * when it is open with nothing unsaved: same tab, focus and trace. One open with unsaved edits is
 * never overwritten: it is saved as a conflict copy, "<name> (conflict, <day>, <this device>)",
 * stays open as that copy, and the pulled version keeps the name, as a sync conflict does.
 * bugs/BUG_20261015_synced-open-project-does-not-refresh.md
 */
import {newUuid, type OpenISDProject} from '@openisd/design';
import {conflictCopyName, type DeviceName} from '@openisd/design/cloud';
import type {ProjectRepo} from '@openisd/persistence';
import type {AppState} from './appState.js';
import type {PulledProject} from './cloudSyncWiring.js';

export interface PulledProjectsDeps {
  readonly appState: Pick<AppState, 'openProjects' | 'projectHasUnsavedChanges' | 'replaceOpenProject' | 'setOpenIdentity'>;
  readonly projectRepo: Pick<ProjectRepo, 'storedIdOf' | 'loadStoredProject' | 'saveToStorageAs'>;
  /** Told of each open project whose edits were saved as a conflict copy. */
  readonly keptBoth: (copyId: string, name: string, item: string, otherDevice: string) => void;
  readonly deviceName: DeviceName;
  readonly now: () => number;
}

/** What following one pulled project did. */
export type PulledFollow = 'notOpen' | 'refreshed' | 'keptEdits' | 'refused';

export function followPulledProjects(deps: PulledProjectsDeps, pulled: readonly PulledProject[]): readonly PulledFollow[] {
  return pulled.map(p => followOne(deps, p));
}

function followOne(deps: PulledProjectsDeps, pulled: PulledProject): PulledFollow {
  const {appState, projectRepo} = deps;
  const open = appState.openProjects().find(project => projectRepo.storedIdOf(project) === pulled.id);
  if (open === undefined) return 'notOpen';
  if (appState.projectHasUnsavedChanges(open)) return keepEdits(deps, open, pulled);
  const fresh = projectRepo.loadStoredProject(pulled.id);
  if (Array.isArray(fresh)) return 'refused';
  appState.replaceOpenProject(open, fresh);
  return 'refreshed';
}

function keepEdits(deps: PulledProjectsDeps, open: OpenISDProject, pulled: PulledProject): PulledFollow {
  const item = open.name.value;
  const name = conflictCopyName(item, deps.deviceName, deps.now());
  const copyId = newUuid();
  open.name.set(name);
  if (deps.projectRepo.saveToStorageAs(open, copyId).kind !== 'saved') return 'refused';
  open.save();
  deps.appState.setOpenIdentity(open, {kind: 'stored', id: copyId});
  deps.keptBoth(copyId, name, item, pulled.from);
  return 'keptEdits';
}
