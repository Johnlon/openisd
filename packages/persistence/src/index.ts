export {
  type BundleRecord,
  type DriverRepo, type DriverRepoDeps, createDriverRepo,
  type DriverBundle, readBundle,
} from './repos/driverRepo.js';

export {
  type BundledPassiveRadiatorRepo, createBundledPassiveRadiatorRepo,
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

export { type SaveResult, type FileStorage, createFileStorage } from './storage/fileStorage.js';

export {
  type ViewSnapshot,
  type ProjectRepo, type FileNaming,
  createProjectRepo,
  PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
} from './repos/projectRepo.js';

// Declared in `@openisd/design`, not here: a consumer of this package gets them from this
// barrel — the one sanctioned re-export site — rather than through a second hop inside
// `projectRepo.ts`, which would relabel them across a module boundary (QO80).
export type { ProjectListing, DeleteChallenge, DeleteOutcome } from '@openisd/design';

export {
  type ViewStateRepo, VIEW_STATE_KEY, createViewStateRepo,
} from './repos/viewStateRepo.js';
