import { createApp } from 'vue';
import App from './ui/App.vue';
import { vExpoStep } from './ui/directives/expoStep.js';
import { vLimits } from './ui/directives/limits.js';
import { createLocalStorage } from './persistence/storage/keyValueStorage.js';
import { createDriverRepo } from './persistence/repos/driverRepo.js';
import { createMyDriverRepo } from './persistence/repos/myDriverRepo.js';
import { myDriversSchema } from './logic/schemaUpgrade.js';
import { createPrefsRepo } from './persistence/repos/prefsRepo.js';
import { createPrRepo } from './persistence/repos/prRepo.js';
import { createLogging } from './logging/flash.js';
import { createDiagnostics } from './diagnostics/selftest.js';
import { createFaultLog } from './diagnostics/faultLog.js';
import { createDriverSelection } from './logic/driverSelection.js';
import { createDriverBrowsingState } from './logic/driverBrowsingState.js';
import { driverFromConformingRecord } from './logic/managedDriver.js';
import { createDesignIO } from './logic/useDesignIO.js';
import { createFileStorage } from './persistence/storage/fileStorage.js';
import { provideApp } from './logic/app.js';
import sourcesJson from '../../../drivers/sources.json';
import bundleJson from './drivers-bundle.json';
import type { BundleRecord } from './persistence/repos/driverRepo.js';
import type { BundledPR } from './types.js';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './style.css';

// THE COMPOSITION ROOT (ARCHITECTURE.md §2).
//
// The only place in the app that constructs anything. Every service is built here with its
// collaborators passed in, the logic layer is built on top of those services, and the whole
// facade is handed to the presentation layer through Vue's provide/inject. Nothing below
// this file reaches for a ready-made instance, which is what lets any of it be exercised in
// a test over substitutes.

const bundle = bundleJson as {
  sources?: Array<{ key: string; files: BundleRecord[] }>;
  passiveRadiators?: BundledPR[];
};

// --- services: arguments in, data out, no app state ---
// FIRST: a fault that fires while the rest of this file runs must still be caught.
const faultLog = createFaultLog();
faultLog.install();

// STORAGE (port): the browser's own key-value storage.
const storage = createLocalStorage();
const logging = createLogging();
const driverRepo = createDriverRepo({ sources: sourcesJson.sources, bundle, fromBundleRecord: driverFromConformingRecord });
const myDriverRepo = createMyDriverRepo(storage, driverFromConformingRecord, myDriversSchema);
const prefs = createPrefsRepo(storage);
const prRepo = createPrRepo(storage, bundle);
const diagnostics = createDiagnostics({ report: logging.flash });
// STORAGE (port): the interactive file-save destination. Two SEPARATE instances — one for
// the project (retains the open project's file handle), one for the driver editor's one-shot
// .wdr/.owdr export — so exporting a driver cannot silently retarget the project Save button.
const fileStorage = createFileStorage();
const driverFileStorage = createFileStorage();

// --- application layer: the app's state and what it does next ---
const selection = createDriverSelection();
const driverBrowsing = createDriverBrowsingState({
  driverRepo, myDriverRepo, prefs, logging, selection,
  confirmReset: (question) => confirm(question),
});
const designIO = createDesignIO({ logging, fileStorage });

const app = createApp(App)
  .directive('expo-step', vExpoStep)
  .directive('limits', vLimits);

provideApp(app, {
  logging, driverBrowsing, selection, designIO, prRepo, myDrivers: myDriverRepo,
  driverFileStorage, diagnostics, faultLog,
});

app.mount('#app');
