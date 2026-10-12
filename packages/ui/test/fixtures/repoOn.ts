/** Test seams: a repo built over a storage with a whole-store backup on that same storage, as the
 *  composition root builds them. */
import {
  createAppSettingsRepo, createBackupRepo, createExportedFiles, createMyDriverRepo, createMyPassiveRadiatorRepo, createProjectRepo,
  createStorageBackup, createViewStateRepo, LAYOUT_STEPS, STORAGE_LAYOUT,
  type FileStorage, type ListableStorage, type ProjectRepairReport, type StorageBackup, type StoredDataFault,
} from '@openisd/persistence';
import type {Engine} from '@openisd/design/engine';

const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 1, 2, 3);

export const exportedFilesOn = () => createExportedFiles({ layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS });

export function backupOn(storage: ListableStorage): StorageBackup {
  return createStorageBackup(storage, () => FIXED_NOW_MS);
}

export const projectRepoOn = (
  engine: Engine, files: FileStorage, storage: ListableStorage, address: string,
  onRepaired?: (report: ProjectRepairReport) => void,
) => createProjectRepo(engine, files, storage, address, backupOn(storage), exportedFilesOn(), onRepaired);

export const myDriverRepoOn = (storage: ListableStorage, engine: Engine) =>
  createMyDriverRepo(storage, engine, backupOn(storage));

export const myPassiveRadiatorRepoOn = (storage: ListableStorage) =>
  createMyPassiveRadiatorRepo(storage, backupOn(storage));

export const viewStateRepoOn = (storage: ListableStorage) => createViewStateRepo(storage, backupOn(storage));

export const appSettingsRepoOn = (storage: ListableStorage, onUnreadable?: (fault: StoredDataFault) => void) =>
  createAppSettingsRepo(storage, backupOn(storage), onUnreadable);

export const backupRepoOn = (storage: ListableStorage) =>
  createBackupRepo(storage, backupOn(storage), () => FIXED_NOW_MS, { layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS });
