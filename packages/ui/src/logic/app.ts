import {type App, inject, type InjectionKey} from 'vue';
import type {DriverBrowsingState} from './driverBrowsingState.js';
import type {DriverSelection} from './driverSelection.js';
import type {DesignIO} from './useApplicationIO.js';
import type {
    BundledPassiveRadiatorRepo,
    FileStorage,
    MyDriverRepo,
    MyPassiveRadiatorRepo,
    ProjectRepo,
    ViewStateRepo
} from '@openisd/persistence';
import type {Logging} from '../logging/flash.js';
import type {FaultLog} from '../diagnostics/faultLog.js';
import type {Engine} from '@openisd/design/engine';

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
  myPassiveRadiators: MyPassiveRadiatorRepo;
  bundledPassiveRadiators: BundledPassiveRadiatorRepo;
  myDrivers: MyDriverRepo;
  driverFileStorage: FileStorage;
  projectRepo: ProjectRepo;
  viewStateRepo: ViewStateRepo;
  faultLog: FaultLog;
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
