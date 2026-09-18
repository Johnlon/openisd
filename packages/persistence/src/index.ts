export type {
  BundledIndexRow, BundledDriverIndexRow, BundledPassiveRadiatorIndexRow, IndexRead, IndexRows, IndexProblems,
} from './repos/bundledIndex.js';
export { type BundledDriverRepo, type BundledDriverRepoDeps, createBundledDriverRepo, readBundledDriverIndex } from './repos/bundledDriverRepo.js';

export {
  type BundledPassiveRadiatorRepo, type BundledPassiveRadiatorRepoDeps, createBundledPassiveRadiatorRepo, readBundledPassiveRadiatorIndex,
} from './repos/bundledPassiveRadiatorRepo.js';

// The envelope both saved libraries share. A consumer names `BrokenEntry` (the unreadable-entry
// surface); the envelope itself is storage's own business and is not exported.
export type { BrokenEntry } from './repos/savedEntries.js';

export {
  MY_DRIVERS_KEY, type MyDriversRead,
  type MyDriverRepo, createMyDriverRepo,
} from './repos/myDriverRepo.js';

export {
  MY_PASSIVE_RADIATORS_KEY, type MyPassiveRadiatorsRead,
  type MyPassiveRadiatorRepo, createMyPassiveRadiatorRepo,
} from './repos/myPassiveRadiatorRepo.js';

export { FAVORITES_KEY, type PrefsRepo, createPrefsRepo } from './repos/prefsRepo.js';

export {
  type KeyValueStorage, createLocalStorage, createMemoryStorage,
} from './storage/keyValueStorage.js';

export { createFileSave, type FileSave } from './storage/fileSave.js';

export {
  OPENISD_STATE_KEY, OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_VIEW_KEY,
  OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY,
  OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_QUARANTINE_DRIVER_KEY,
  OPENISD_STORAGE_KEYS,
} from './repos/storageKeys.js';

export { type SaveResult, type FileStorage, createFileStorage } from './storage/fileStorage.js';

export {
  type ViewSnapshot,
  type ProjectRepo, type StoredProjectListing, type OpenProjectSession, type FileNaming,
  createProjectRepo,
  PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
} from './repos/projectRepo.js';

export {
  type ViewStateRepo, VIEW_STATE_KEY, createViewStateRepo,
} from './repos/viewStateRepo.js';
