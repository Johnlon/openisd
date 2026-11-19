/**
 * Open projects follow what cloud sync pulled. Sync carries the whole project, its saved checkpoint and
 * its unsaved edits (John, 18 Nov 2026, QO946.c248), so a pulled version shown in place keeps the other
 * device's unsaved edits as unsaved here, and Revert goes back to the same checkpoint on both.
 *
 * - An open project whose store already held everything it shows (nothing typed since its last write)
 *   is shown as pulled, in place: same tab, focus and trace.
 * - When the run kept this device's version as a conflict copy, the open project becomes that copy:
 *   the user keeps what they were looking at, under the copy's name; the run announced the conflict.
 * - An open project holding edits the store did not have yet is never overwritten: it is saved as a
 *   conflict copy, "<name> (conflict, <day>, <this device>)", stays open as that copy, and the pulled
 *   version keeps the name, as a sync conflict does.
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
export type PulledFollow = 'notOpen' | 'refreshed' | 'openAsCopy' | 'keptEdits' | 'refused';

export function followPulledProjects(deps: PulledProjectsDeps, pulled: readonly PulledProject[]): readonly PulledFollow[] {
  return pulled.map(p => followOne(deps, p));
}

function followOne(deps: PulledProjectsDeps, pulled: PulledProject): PulledFollow {
  const {appState, projectRepo} = deps;
  const open = appState.openProjects().find(project => projectRepo.storedIdOf(project) === pulled.id);
  if (open === undefined) return 'notOpen';
  // Everything on screen was in the store when the pull came: nothing of this device's is lost by following it.
  const heldByStore = !appState.projectHasUnsavedChanges(open) || open.toStoredText() === pulled.before;
  if (!heldByStore) return keepEdits(deps, open, pulled);
  const shown = pulled.copyId === null ? pulled.id : pulled.copyId;
  const fresh = projectRepo.loadStoredProject(shown);
  if (Array.isArray(fresh)) return 'refused';
  appState.replaceOpenProject(open, fresh);
  if (pulled.copyId === null) return 'refreshed';
  appState.setOpenIdentity(fresh, {kind: 'stored', id: pulled.copyId});
  return 'openAsCopy';
}

function keepEdits(deps: PulledProjectsDeps, open: OpenISDProject, pulled: PulledProject): PulledFollow {
  return keepAsConflictCopy(deps, open, pulled.from) ? 'keptEdits' : 'refused';
}

/**
 * Keeps the open project, edits and all, as a conflict copy "<name> (conflict, <day>, <this device>)" that
 * stays open and is announced; its saved entry is left to the other version. False when the store refused
 * the copy: the project is then left as it was, name included. `otherDevice` is '' when it is not known.
 */
export function keepAsConflictCopy(deps: PulledProjectsDeps, open: OpenISDProject, otherDevice: string): boolean {
  const item = open.name.value;
  const name = conflictCopyName(item, deps.deviceName, deps.now());
  const copyId = newUuid();
  // The copy is stored under its new name, so the name is set for the save; a refused save gives the project
  // its own name back, never leaving the open project renamed to a copy that was not kept.
  open.name.set(name);
  // Stored as saved (its edits are the copy's checkpoint), as the open project is once saved below.
  if (deps.projectRepo.saveToStorageAs(open.committedSnapshot(), copyId).kind !== 'saved') {
    open.name.set(item);
    return false;
  }
  open.adoptId(copyId);
  open.save();
  deps.appState.setOpenIdentity(open, {kind: 'stored', id: copyId});
  deps.keptBoth(copyId, name, item, otherDevice);
  return true;
}
