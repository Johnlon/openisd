/** Test seams: a repo built over a storage with a whole-store backup on that same storage, as
 *  the app composes them. */
import type {Engine} from '@openisd/design/engine';
import {createEngine} from '@openisd/design/engine';
import type {FileStorage} from '../../src/storage/fileStorage.js';
import type {ListableStorage} from '../../src/storage/keyValueStorage.js';
import {createAppSettingsRepo} from '../../src/repos/appSettingsRepo.js';
import {createMyDriverRepo} from '../../src/repos/myDriverRepo.js';
import {createMyPassiveRadiatorRepo} from '../../src/repos/myPassiveRadiatorRepo.js';
import {createProjectRepo} from '../../src/repos/projectRepo.js';
import {createStorageBackup, type StorageBackup} from '../../src/repos/storageBackup.js';
import {createViewStateRepo} from '../../src/repos/viewStateRepo.js';
import type {ProjectRepairReport} from '../../src/repos/projectRepo.js';
import type {StoredDataFault} from '../../src/repos/storedDataFault.js';
import type {LayoutRules} from '../../src/repos/layoutMigration.js';
import {createExportedFiles} from '../../src/repos/exportedFile.js';
import {layoutStepsOn} from '../../src/repos/layoutSteps.js';
import {STORAGE_LAYOUT} from '../../src/storageLayout.js';

/** The layout rules of the running app. */
export const APP_RULES: LayoutRules = {layout: STORAGE_LAYOUT, steps: layoutStepsOn(createEngine())};

/** 1 Jan 2026 01:02 UTC. */
export const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 1, 2, 3);

export const exportedFilesOn = () => createExportedFiles(APP_RULES);

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
