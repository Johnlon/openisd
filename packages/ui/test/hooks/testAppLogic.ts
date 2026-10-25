/**
 * A real `AppLogic`, built the same way `main.ts` builds it — in-memory storage and a fetch
 * that is never called in place of the browser-backed pieces — so a hooks test can `provide()`
 * the composition root's facade without a cast. `overrides` replaces whichever piece the test
 * actually exercises.
 */
import {VersionIndex} from '../../src/logic/versionIndex.js';
import {
  createBundledDriverRepo,
  createBundledPassiveRadiatorRepo,
  createFileOpen,
  createFileStorage,
  createMemoryStorage,
  createPrefsRepo,
  isStoredDataFault,
  createProjectBin, createStorageUsage,
  createProjectBinMarks,
  createBrowserStoragePort,
  createPersistenceStatus,
  createSaveSignal,
} from '@openisd/persistence';
import {createLogging} from '../../src/logging/flash.js';
import {createFaultLog} from '../../src/diagnostics/faultLog.js';
import {createDriverSelection} from '../../src/logic/driverSelection.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import {createApplicationIO} from '../../src/logic/applicationIO.js';
import {DesignFiles} from '../../src/logic/fileImportExport.js';
import {DriverDrafts} from '../../src/logic/driverDraft.js';
import {createConfirmPort, type ConfirmPort} from '../../src/logic/confirmPort.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import type {AppLogic} from '../../src/logic/app.js';
import {AppUpdate} from '../../src/logic/appUpdate.js';
import {createAppVersionPort} from '../../src/logic/appVersion.js';
import {appSettingsRepoOn, backupOn, backupRepoOn, myDriverRepoOn, myPassiveRadiatorRepoOn, projectRepoOn, viewStateRepoOn, exportedFilesOn, storageHistoryOn} from '../fixtures/repoOn.js';

const CATALOGUE_MAX_AGE_MS = 60 * 60 * 1000;
const unusedFetch: typeof fetch = () => Promise.reject(new Error('fetch not used in this test'));
// Fake confirm port for tests — always confirms
const fakeConfirmPort: ConfirmPort = {
  ask: async () => true,
};

export function testAppLogic(overrides: Partial<AppLogic> = {}): AppLogic {
  const { appState, presentation } = createAppStateFixture();
  const engine = appState.engine;
  const logging = createLogging();
  const storage = createMemoryStorage();
  const faultLog = createFaultLog(() => undefined, () => ({
    view: viewStateRepoOn(storage), appSettings: appSettingsRepoOn(storage),
  }), (thrown) => isStoredDataFault(thrown) ? thrown.store : null, {lines: () => [], summary: () => null}, {lines: () => []}, () => null, () => '');
  const driverRepo = createBundledDriverRepo({
    fetch: unusedFetch, baseUrl: '/', engine, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now,
  });
  const myDriverRepo = myDriverRepoOn(storage, engine);
  const prefs = createPrefsRepo(storage, () => undefined);
  const myPassiveRadiators = myPassiveRadiatorRepoOn(storage);
  const bundledPassiveRadiators = createBundledPassiveRadiatorRepo({
    fetch: unusedFetch, baseUrl: '/', maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now,
  });
  const fileStorage = createFileStorage();
  const driverFileStorage = createFileStorage();
  const selection = createDriverSelection({ appState, presentation });
  const projectRepo = projectRepoOn(engine, fileStorage, storage, 'http://localhost');
  const binBackup = backupOn(storage);
  const projectBin = createProjectBin({
    projects: projectRepo, marks: createProjectBinMarks(storage, binBackup), backup: binBackup,
    device: () => 'Test device', now: Date.now, onSaved: () => undefined,
  });
  const designFiles = new DesignFiles(engine, projectRepo, exportedFilesOn());
  const driverDrafts = new DriverDrafts(engine, appState.appContext);
  const confirmPort = createConfirmPort();
  const driverBrowsing = createDriverBrowsingState({
    driverRepo, myDriverRepo, prefs, logging, selection, files: designFiles,
    confirmReset: fakeConfirmPort, exportNotice: {exported: () => undefined}, appState, presentation,
  });
  const viewStateRepo = viewStateRepoOn(storage);
  const backup = backupRepoOn(storage);
  const storageUsage = createStorageUsage(storage, projectBin);
  const designIO = createApplicationIO({ engine,  logging, fileStorage, fileOpen: createFileOpen(), projectRepo, files: designFiles, backup, storageUsage, confirmPort: fakeConfirmPort, appState, presentation });

  const base: AppLogic = {
    engine, logging, driverBrowsing, selection, designIO, designFiles, driverDrafts,
    myPassiveRadiators, prefs, bundledPassiveRadiators, bundledDrivers: driverRepo, myDrivers: myDriverRepo,
    driverFileStorage, faultLog, projectRepo, projectBin, viewStateRepo, storageHistory: storageHistoryOn(storage, projectRepo), storageUsage,
    browserStorage: createBrowserStoragePort(undefined, 'This browser'), persistence: createPersistenceStatus(createBrowserStoragePort(undefined, 'This browser'), storage), saves: createSaveSignal(),
    appUpdate: new AppUpdate({
      container: {addEventListener: () => {}},
      visibility: {onVisible: () => {}},
      timer: {every: () => {}},
      anyUnsaved: () => false,
      reload: () => {},
      caches: {keys: () => Promise.resolve([]), delete: () => Promise.resolve(true)},
    }),
    appVersion: createAppVersionPort(false, '', null, 'release'),
    versionIndex: new VersionIndex('', Promise.resolve(null)),
    confirmPort, appState, presentation,
    recordedProjectId: () => null,
    cloudSync: null,
  };
  return Object.assign({}, base, overrides);
}
