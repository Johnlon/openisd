/** Test seams: a repo built over a storage with a whole-store backup on that same storage, as the
 *  composition root builds them. */
import {
  createAppSettingsRepo, createBackupRepo, createExportedFiles, createStorageHistory, createMyDriverRepo, createMyPassiveRadiatorRepo, createProjectRepo,
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
  onRepaired: (report: ProjectRepairReport) => void = () => undefined,
  onSaved: () => void = () => undefined,
) => createProjectRepo(engine, files, storage, address, backupOn(storage), exportedFilesOn(), onRepaired, onSaved);

export const myDriverRepoOn = (storage: ListableStorage, engine: Engine, onSaved: () => void = () => undefined) =>
  createMyDriverRepo(storage, engine, backupOn(storage), onSaved);

export const myPassiveRadiatorRepoOn = (storage: ListableStorage, onSaved: () => void = () => undefined) =>
  createMyPassiveRadiatorRepo(storage, backupOn(storage), onSaved);

export const viewStateRepoOn = (storage: ListableStorage) => createViewStateRepo(storage, backupOn(storage), () => undefined);

export const appSettingsRepoOn = (storage: ListableStorage, onUnreadable: (fault: StoredDataFault) => void = () => undefined, onSaved: () => void = () => undefined) =>
  createAppSettingsRepo(storage, backupOn(storage), onUnreadable, () => undefined, onSaved);

export const storageHistoryOn = (storage: ListableStorage) =>
  createStorageHistory(backupOn(storage), backupRepoOn(storage), { layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS });

export const backupRepoOn = (storage: ListableStorage) =>
  createBackupRepo(storage, backupOn(storage), () => FIXED_NOW_MS, { layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS }, () => undefined);
