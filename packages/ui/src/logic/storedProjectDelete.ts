/**
 * Deleting one of the browser-stored projects: the shared door both shells' "Open project" lists
 * call. The store removes it under one backup and asks for a sync (Drive then drops it on every
 * device); this module asks first, and closes the project when it is open.
 */
import type {ProjectRepo} from '@openisd/persistence';
import type {AppState} from './appState.js';
import type {ConfirmPort} from './confirmPort.js';

/** What Delete did: removed it, the user said no, or the store refused (it was not there, or no backup fitted). */
export type StoredDeleteResult = 'deleted' | 'cancelled' | 'refused';

export async function deleteStoredProject(
  appState: Pick<AppState, 'openProjects' | 'removeProject'>,
  repo: Pick<ProjectRepo, 'deleteStoredProject' | 'storedIdOf'>,
  confirm: ConfirmPort,
  id: string,
  name: string,
): Promise<StoredDeleteResult> {
  const confirmed = await confirm.ask({
    title: 'Delete project?',
    message: `Delete "${name}"? It is removed from this browser and from Drive on every synced device. A backup is taken first.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return 'cancelled';
  if (repo.deleteStoredProject(id) === 'refused') return 'refused';
  const index = appState.openProjects().findIndex(project => repo.storedIdOf(project) === id);
  if (index >= 0) appState.removeProject(index);
  return 'deleted';
}
