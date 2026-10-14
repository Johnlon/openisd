export type {
  BundledIndexRow, BundledDriverIndexRow, BundledPassiveRadiatorIndexRow, IndexRead, IndexRows, IndexProblems,
} from './repos/bundledIndex.js';
export { type BundledDriverRepo, type BundledDriverRepoDeps, createBundledDriverRepo, readBundledDriverIndex } from './repos/bundledDriverRepo.js';

export {
  type BundledPassiveRadiatorRepo, type BundledPassiveRadiatorRepoDeps, createBundledPassiveRadiatorRepo, readBundledPassiveRadiatorIndex,
} from './repos/bundledPassiveRadiatorRepo.js';

// The envelope both saved libraries share. A consumer names `BrokenEntry` (the unreadable-entry
// surface); the envelope itself is storage's own business and is not exported.
export type { BrokenEntry, SavedWrite } from './repos/savedEntries.js';

export {
  MY_DRIVERS_KEY, type MyDriversRead,
  type MyDriverRepo, createMyDriverRepo,
} from './repos/myDriverRepo.js';

export {
  MY_PASSIVE_RADIATORS_KEY, type MyPassiveRadiatorsRead,
  type MyPassiveRadiatorRepo, createMyPassiveRadiatorRepo,
} from './repos/myPassiveRadiatorRepo.js';

export { FAVORITES_KEY, type PrefsRepo, createPrefsRepo } from './repos/prefsRepo.js';
export { APP_SETTINGS_KEY, type AppSettingsRepo, createAppSettingsRepo } from './repos/appSettingsRepo.js';

export {
  type KeyValueStorage, type ListableStorage, type SharedMemoryStorage, createLocalStorage, createMemoryStorage, createSharedMemoryStorage,
} from './storage/keyValueStorage.js';

export { createFileSave, type FileSave } from './storage/fileSave.js';
export { createFileOpen, type FileOpen, type FilePick, type FilePickerFilter } from './storage/fileOpen.js';

export {
  OPENISD_STATE_KEY, OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_VIEW_KEY,
  OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY,
  OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY,
  OPENISD_STORAGE_KEYS, OPENISD_BACKUP_KEYS,
  OPENISD_STORAGE_LAYOUT_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LOG_KEY, OPENISD_BACKUP_PREFIX,
} from './repos/storageKeys.js';

export { STORAGE_LAYOUT } from './storageLayout.js';
export { BuildStamp, createBuildStamp } from './repos/buildStamp.js';
export { type LayoutRules, type LayoutStep, type FileJson } from './repos/layoutMigration.js';
export { LAYOUT_STEPS } from './repos/layoutSteps.js';
export { createStorageHistory, type HistoryFile, type HistoryRow, type StorageHistory } from './repos/storageHistory.js';
export { createExportedFiles, type ExportedFiles, type OpenedFile } from './repos/exportedFile.js';
export {
  type BackupInfo, type BackupResult, type Guarded, type StorageBackup, MAX_BACKUPS, NO_ROOM_TO_BACK_UP, createStorageBackup,
} from './repos/storageBackup.js';
export { type LostKey, type LogEntry, type StorageLog, MAX_LOG_ENTRIES, createStorageLog } from './repos/storageLog.js';
export {
  type OpenStore, type StoreOpening, type BlockReason, type OpenStoreDeps, createStoreOpening,
} from './repos/storeGate.js';

export { type SaveResult, type FileStorage, createFileStorage } from './storage/fileStorage.js';

export {
  type ViewSnapshot,
  type ProjectRepo, type StoredProjectListing, type OpenProjectSession, type FileNaming, type ProjectRepairReport,
  createProjectRepo,

  PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
} from './repos/projectRepo.js';

export {
  type ViewStateRepo, VIEW_STATE_KEY, createViewStateRepo,
} from './repos/viewStateRepo.js';

export {
  type BackupRepo, type RestoreResult, type RestoreOptions, createBackupRepo,
} from './repos/backupRepo.js';

export { type StoreName, type StoredDataFault, createStoredDataFault, isStoredDataFault } from './repos/storedDataFault.js';

export {
  type RedirectGuard,
  type RedirectGuardDeps,
  type RedirectLocation,
  createRedirectGuard,
} from './cloud/auth/redirectGuard.js';

export {
  type ImplicitSessionDeps,
  type SessionLocation,
  createImplicitSession,
} from './cloud/auth/implicitSession.js';

export {
  type AuthStorage,
  type TokenStore,
  OPENISD_CLOUD_AUTH_KEY,
  createTokenStore,
} from './cloud/auth/tokenStore.js';

export {
  type CloudUiStorage,
  type CloudUiStore,
  OPENISD_CLOUD_UI_KEY,
  createCloudUiStore,
} from './cloud/cloudUiStore.js';

export {
  type Http,
  type HttpMethod,
  type HttpRequest,
  type HttpResponse,
  createFetchHttp,
} from './cloud/http.js';

export {
  type Revoker,
  createGoogleRevoker,
} from './cloud/auth/googleRevoker.js';

export {
  type CloudSession,
  type CloudStore,
} from './cloud/cloudStore.js';

export {
  type DriveStoreDeps,
  createDriveStore,
} from './cloud/drive/driveStore.js';

export {
  type LedgerRow,
  type SyncLedger,
  createSyncLedger,
  relistOnce,
} from './cloud/syncLedger.js';

export {
  type LocalDoc,
  type LocalDocs,
  type LocalRead,
} from './cloud/localDocs.js';

export {
  type ProjectDocsDeps,
  createProjectDocs,
} from './cloud/docs/projectDocs.js';

export {
  type SavedEntryDocsDeps,
  createSavedEntryDocs,
} from './cloud/docs/savedEntryDocs.js';

export {
  type SingletonDocsDeps,
  createSingletonDocs,
} from './cloud/docs/singletonDocs.js';

export {
  type SavedEntries,
  type SavedEntriesSpec,
  createSavedEntries,
} from './repos/savedEntries.js';

export {
  type FavouritesRepo,
  type SingletonDocRepo,
  createFavouritesRepo,
} from './repos/appSettingsRepo.js';

export {
  type RunOutcome,
  type SyncEngine,
} from './cloud/syncRun.js';

export {
  type SyncEngineDeps,
  createSyncEngine,
} from './cloud/syncEngine.js';

export {
  type RunLock,
  type SyncScheduler,
  type SyncSchedulerDeps,
  type SyncTriggers,
  type Timer,
  createSyncScheduler,
} from './cloud/syncScheduler.js';

export {
  type AccountNamer,
  type CloudIdentity,
  createAccountNamer,
} from './cloud/accountNamer.js';

export {
  type CloudSync,
  type CloudSyncDeps,
  createCloudSync,
} from './cloud/cloudSync.js';

export {
  type SaveSignal,
  createSaveSignal,
} from './cloud/saveSignal.js';


