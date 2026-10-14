import {type App, inject, type InjectionKey} from 'vue';
import type {DriverBrowsingState} from './driverBrowsingState.js';
import type {DriverSelection} from './driverSelection.js';
import type {DesignIO} from './applicationIO.js';
import type {DesignFiles} from './fileImportExport.js';
import type {DriverDrafts} from './driverDraft.js';
import type {ConfirmPort, ConfirmDialogState} from './confirmPort.js';
import type {
    BundledDriverRepo,
    BundledPassiveRadiatorRepo,
    CloudSync,
    FileStorage,
    MyDriverRepo,
    MyPassiveRadiatorRepo,
    PrefsRepo,
    ProjectRepo,
    StorageHistory,
    ViewStateRepo
} from '@openisd/persistence';
import type {Logging} from '../logging/flash.js';
import type {FaultLog} from '../diagnostics/faultLog.js';
import type {Engine} from '@openisd/design/engine';
import type {ReleaseWatch} from './releaseWatch.js';
import type {AppVersionPort} from './appVersion.js';
import type {VersionIndex} from './versionIndex.js';
import type {AppState} from './appState.js';
import type {PresentationState} from './presentationState.js';

/**
 * What the presentation layer is given.
 *
 * The UI depends on `logic` and nothing else: it receives this facade at the root through
 * Vue's provide/inject and never imports a service. Everything on it was CONSTRUCTED by the
 * composition root (`main.ts`) — no component reaches for a ready-made instance, so a test
 * can mount the same tree over substitutes.
 *
 * `myPassiveRadiators` and `myDrivers` are repositories the UI is handed directly: the PR browser and
 * the driver editor read and write records without any workflow in between, so wrapping them
 * in a logic module would add a layer that decides nothing. `driverFileStorage` is the same
 * direct-handoff shape for a STORAGE port: the driver editor's `.wdr`/`.owdr` export is a
 * one-shot save with no workflow of its own, and it is a SEPARATE `FileStorage` instance from
 * `designIO`'s — sharing one would mean exporting a driver silently retargets the project
 * Save button's retained file handle.
 */
export interface AppLogic {
  engine: Engine;
  logging: Logging;
  driverBrowsing: DriverBrowsingState;
  selection: DriverSelection;
  designIO: DesignIO;
  designFiles: DesignFiles;
  driverDrafts: DriverDrafts;
  myPassiveRadiators: MyPassiveRadiatorRepo;
  prefs: PrefsRepo;
  bundledPassiveRadiators: BundledPassiveRadiatorRepo;
  bundledDrivers: BundledDriverRepo;
  myDrivers: MyDriverRepo;
  driverFileStorage: FileStorage;
  projectRepo: ProjectRepo;
  viewStateRepo: ViewStateRepo;
  /** The backups held in this browser: the Options "Storage history" page. */
  storageHistory: StorageHistory;
  faultLog: FaultLog;
  releases: ReleaseWatch;
  appVersion: AppVersionPort;
  /** Every hosted build, read once at start; About lists them. */
  versionIndex: VersionIndex;
  confirmPort: { port: ConfirmPort; state: ConfirmDialogState };
  /** The open projects, focused project's curves and issues, application settings. */
  appState: AppState;
  /** Which dialogs are open, chart zoom, unit and colour preferences. */
  presentation: PresentationState;
  /** Reads the project ID recorded before an OAuth redirect, so boot can refocus it. */
  recordedProjectId: () => string | null;
  /** Cloud sync facade, or null when the store opened read-only. */
  cloudSync: CloudSync | null;
}

export const APP_LOGIC: InjectionKey<AppLogic> = Symbol('openisd.app');

/** The composition root installs the facade here, once, before mount. */
export function provideApp(app: App, logic: AppLogic): void {
  app.provide(APP_LOGIC, logic);
}

/** How a component reaches the app. Throws rather than defaulting: a component rendered
 *  outside the root is a wiring bug, and a silent fallback would hide it. */
export function useApp(): AppLogic {
  const logic = inject(APP_LOGIC);
  if (!logic) throw new Error('useApp(): no AppLogic provided — the app was mounted without its composition root');
  return logic;
}
