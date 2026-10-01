/**
 * A real `AppLogic`, built the same way `main.ts` builds it — in-memory storage and a fetch
 * that is never called in place of the browser-backed pieces — so a hooks test can `provide()`
 * the composition root's facade without a cast. `overrides` replaces whichever piece the test
 * actually exercises.
 */
import {createEngine} from '@openisd/design/engine';
import {
  createBackupRepo,
  createBundledDriverRepo,
  createBundledPassiveRadiatorRepo,
  createFileOpen,
  createFileStorage,
  createMemoryStorage,
  createMyDriverRepo,
  createMyPassiveRadiatorRepo,
  createPrefsRepo,
  createProjectRepo,
  createViewStateRepo,
} from '@openisd/persistence';
import {createLogging} from '../../src/logging/flash.js';
import {createFaultLog} from '../../src/diagnostics/faultLog.js';
import {createDriverSelection} from '../../src/logic/driverSelection.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import {createApplicationIO} from '../../src/logic/useApplicationIO.js';
import {DesignFiles} from '../../src/logic/fileImportExport.js';
import {DriverDrafts} from '../../src/logic/driverDraft.js';
import {appContext} from '../../src/logic/appState.js';
import type {AppLogic} from '../../src/logic/app.js';

const CATALOGUE_MAX_AGE_MS = 60 * 60 * 1000;
const unusedFetch: typeof fetch = () => Promise.reject(new Error('fetch not used in this test'));

export function testAppLogic(overrides: Partial<AppLogic> = {}): AppLogic {
  const engine = createEngine();
  const logging = createLogging();
  const faultLog = createFaultLog();
  const storage = createMemoryStorage();
  const driverRepo = createBundledDriverRepo({
    fetch: unusedFetch, baseUrl: '/', engine, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now,
  });
  const myDriverRepo = createMyDriverRepo(storage, engine);
  const prefs = createPrefsRepo(storage);
  const myPassiveRadiators = createMyPassiveRadiatorRepo(storage);
  const bundledPassiveRadiators = createBundledPassiveRadiatorRepo({
    fetch: unusedFetch, baseUrl: '/', maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now,
  });
  const fileStorage = createFileStorage();
  const driverFileStorage = createFileStorage();
  const selection = createDriverSelection();
  const projectRepo = createProjectRepo(engine, fileStorage, storage);
  const designFiles = new DesignFiles(engine, projectRepo);
  const driverDrafts = new DriverDrafts(engine, appContext);
  const driverBrowsing = createDriverBrowsingState({
    driverRepo, myDriverRepo, prefs, logging, selection, files: designFiles,
    confirmReset: () => true,
  });
  const viewStateRepo = createViewStateRepo(storage);
  const backup = createBackupRepo(storage);
  const designIO = createApplicationIO({ logging, fileStorage, fileOpen: createFileOpen(), projectRepo, files: designFiles, backup });

  const base: AppLogic = {
    engine, logging, driverBrowsing, selection, designIO, designFiles, driverDrafts,
    myPassiveRadiators, bundledPassiveRadiators, bundledDrivers: driverRepo, myDrivers: myDriverRepo,
    driverFileStorage, faultLog, projectRepo, viewStateRepo,
  };
  return Object.assign({}, base, overrides);
}
