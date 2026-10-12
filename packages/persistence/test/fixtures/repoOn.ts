/** Test seams: a repo built over a storage with a whole-store backup on that same storage, as
 *  the app composes them. */
import type {Engine} from '@openisd/design/engine';
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
import {LAYOUT_STEPS, type LayoutRules} from '../../src/repos/layoutMigration.js';
import {STORAGE_LAYOUT} from '../../src/storageLayout.js';

/** The layout rules of the running app. */
export const APP_RULES: LayoutRules = {layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS};

/** 1 Jan 2026 01:02 UTC. */
export const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 1, 2, 3);

export function backupOn(storage: ListableStorage): StorageBackup {
  return createStorageBackup(storage, () => FIXED_NOW_MS);
}

export const projectRepoOn = (
  engine: Engine, files: FileStorage, storage: ListableStorage, address: string,
  onRepaired?: (report: ProjectRepairReport) => void,
) => createProjectRepo(engine, files, storage, address, backupOn(storage), onRepaired);

export const myDriverRepoOn = (storage: ListableStorage, engine: Engine) =>
  createMyDriverRepo(storage, engine, backupOn(storage));

export const myPassiveRadiatorRepoOn = (storage: ListableStorage) =>
  createMyPassiveRadiatorRepo(storage, backupOn(storage));

export const viewStateRepoOn = (storage: ListableStorage) => createViewStateRepo(storage, backupOn(storage));

export const appSettingsRepoOn = (storage: ListableStorage, onUnreadable?: (fault: StoredDataFault) => void) =>
  createAppSettingsRepo(storage, backupOn(storage), onUnreadable);
