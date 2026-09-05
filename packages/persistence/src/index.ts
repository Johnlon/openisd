// PARED BACK — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What this package still offers is ONE thing: turning the pre-built bundle into domain objects,
// for drivers and for passive radiators. Storage, My Drivers, projects, prefs and view state are
// commented out in place — restore a piece when the app needs it, and until then it is not
// carried through the packages/model → packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

export {
  type SourceEntry, type FileEntry, type BundleRecord,
  normaliseDate,
  type DriverRepo, type DriverRepoDeps, createDriverRepo,
  type DriverBundle, readBundle,
} from './repos/driverRepo.js';

// export {
//   type BundledPassiveRadiator, type BundledPassiveRadiatorRepo, createBundledPassiveRadiatorRepo,
// } from './repos/bundledPassiveRadiatorRepo.js';

// export {
//   type StoredEntry, type MyDriversSchema, MY_DRIVERS_KEY,
//   type BrokenEntry, type MyDriversRead,
//   type MyDriverRepo, createMyDriverRepo,
// } from './repos/myDriverRepo.js';
//
// export {
//   MY_PASSIVE_RADIATORS_KEY, type PRLibEntry,
//   type MyPassiveRadiatorRepo, createMyPassiveRadiatorRepo,
// } from './repos/myPassiveRadiatorRepo.js';
//
// export { FAVORITES_KEY, type PrefsRepo, createPrefsRepo } from './repos/prefsRepo.js';
//
// export {
//   type KeyValueStorage, createLocalStorage, createMemoryStorage,
// } from './storage/keyValueStorage.js';
//
// export { createFileSave, type FileSave } from './storage/fileSave.js';
//
// export { type SaveResult, type FileStorage, createFileStorage } from './storage/fileStorage.js';
//
// export {
//   type UiState, type ViewSnapshot,
//   type ProjectSchema, type ProjectRepo, type FileNaming,
//   createProjectRepo,
// } from './repos/projectRepo.js';
//
// export {
//   type ViewStateRepo, VIEW_STATE_KEY, createViewStateRepo,
// } from './repos/viewStateRepo.js';
//
// export {
//   PROJECT_EXT, projectNameFromFilename, projectFilename, copyOfName, uniqueName,
// } from './repos/projectRepo.js';
//
// export { driverKey, fmtHz, shortSource, myDriverEntry, driverHasDqIssues,
//   type SearchCriteria, matchesCriteria, type PreviewSpec, type Preview, previewOf,
//   type DriverSummaryField } from './repos/driverRepo.js';
