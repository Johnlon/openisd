/**
 * The Bin's user actions, shared by both shells' Open project lists: each asks first where it
 * must, then calls the Bin. Moving an open project to the Bin saves its edits first and closes it.
 */
import type {ProjectBin, ProjectRepo} from '@openisd/persistence';
import {deleteForeverMessage, emptyBinMessage, moveToBinMessage} from '@openisd/design/fields';
import type {AppState} from './appState.js';
import type {ConfirmPort} from './confirmPort.js';

/** What an action did: done, the user said no, or the store refused (it was not there, or no backup fitted). */
export type BinActionResult = 'done' | 'cancelled' | 'refused';

export async function moveToBin(
  appState: Pick<AppState, 'openProjects' | 'removeProject' | 'projectHasUnsavedChanges'>,
  repo: Pick<ProjectRepo, 'storedIdOf' | 'saveToStorage'>,
  bin: Pick<ProjectBin, 'moveToBin'>,
  confirm: ConfirmPort,
  id: string,
  name: string,
): Promise<BinActionResult> {
  const confirmed = await confirm.ask({
    title: 'Move to the Bin?',
    message: moveToBinMessage(name),
    confirmLabel: 'Move to Bin',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return 'cancelled';
  const index = appState.openProjects().findIndex(project => repo.storedIdOf(project) === id);
  const open = appState.openProjects()[index];
  // The Bin keeps the project's data: edits not yet saved are saved first, then binned with it.
  if (open !== undefined && appState.projectHasUnsavedChanges(open) && repo.saveToStorage(open).kind !== 'saved') return 'refused';
  if (bin.moveToBin(id) === 'refused') return 'refused';
  if (index >= 0) appState.removeProject(index);
  return 'done';
}

export async function deleteForever(
  bin: Pick<ProjectBin, 'deleteForever'>,
  confirm: ConfirmPort,
  id: string,
  name: string,
): Promise<BinActionResult> {
  const confirmed = await confirm.ask({
    title: 'Delete forever?',
    message: deleteForeverMessage(name),
    confirmLabel: 'Delete forever',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return 'cancelled';
  return bin.deleteForever(id) === 'done' ? 'done' : 'refused';
}

export async function emptyBin(
  bin: Pick<ProjectBin, 'emptyBin'>,
  confirm: ConfirmPort,
  count: number,
  totalSize: string,
): Promise<BinActionResult> {
  const confirmed = await confirm.ask({
    title: 'Empty the Bin?',
    message: emptyBinMessage(count, totalSize),
    confirmLabel: 'Empty Bin',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return 'cancelled';
  return bin.emptyBin() === 'done' ? 'done' : 'refused';
}
