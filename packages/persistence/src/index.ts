export {
  type SourceEntry, type FileEntry, type BundleRecord,
  driverKey, classifyTypes, fmtHz, normaliseDate, shortSource,
  myDriverName, myDriverEntry, driverHasDqIssues,
  type SearchCriteria, matchesCriteria,
  type PreviewSpec, type Preview, previewOf,
  parseRepoInput, type SourceFetch,
  type DriverRepo, type DriverRepoDeps, createDriverRepo,
} from './repos/driverRepo.js';

export {
  type StoredEntry, type MyDriversSchema, MY_DRIVERS_KEY,
  type BrokenEntry, type MyDriversRead,
  type MyDriverRepo, createMyDriverRepo,
} from './repos/myDriverRepo.js';

export {
  PR_LIB_KEY, type PRLibEntry, type BundledPR, type PrRepo, createPrRepo,
} from './repos/prRepo.js';

export { FAVORITES_KEY, type PrefsRepo, createPrefsRepo } from './repos/prefsRepo.js';

export {
  type KeyValueStorage, createLocalStorage, createMemoryStorage,
} from './storage/keyValueStorage.js';

// fileSave.ts's own `SaveResult` (carries the raw FileSystemFileHandle) is an internal detail
// of fileStorage.ts's port wrapper, which exposes its own `SaveResult` (name only, no handle)
// as the public shape — export only what a consumer beyond fileStorage.ts actually uses.
export { createFileSave, type FileSave } from './storage/fileSave.js';

export { type SaveResult, type FileStorage, createFileStorage } from './storage/fileStorage.js';

export {
  type UiState, type ViewSnapshot, type ProjectWrite, type ProjectRead,
  type ProjectSchema, type ProjectRepo, type FileNaming, PROJECT_STATE_KEY,
  createProjectRepo,
} from './repos/projectRepo.js';

export {
  PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
} from './repos/projectRepo.js';
