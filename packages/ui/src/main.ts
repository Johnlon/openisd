import { createApp } from 'vue';
import App from './ui/App.vue';
import { vExpoStep } from './ui/directives/expoStep.js';
import { vLimits } from './ui/directives/limits.js';
import { createLocalStorageStore } from './db/kv.js';
import { createDriverRepo } from './db/driverRepo.js';
import { createMyDriverRepo } from './db/myDrivers.js';
import { createPrefsStore } from './db/prefs.js';
import { createPrRepo } from './db/prLibrary.js';
import { createLogging } from './logging/flash.js';
import { createDiagnostics } from './diagnostics/selftest.js';
import { createFaultLog } from './diagnostics/faultLog.js';
import { createDriverSelection } from './logic/driverSelection.js';
import { createDriverLibrary } from './logic/driverLibrary.js';
import { createDesignIO } from './logic/useDesignIO.js';
import { provideApp } from './logic/app.js';
import sourcesJson from '../../../drivers/sources.json';
import bundleJson from './drivers-bundle.json';
import type { BundleRecord } from './db/driverRepo.js';
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

const store = createLocalStorageStore();
const logging = createLogging();
const driverRepo = createDriverRepo({ sources: sourcesJson.sources, bundle });
const myDriverRepo = createMyDriverRepo(store);
const prefs = createPrefsStore(store);
const prLibrary = createPrRepo(store, bundle);
const diagnostics = createDiagnostics({ report: logging.flash });

// --- application layer: the app's state and what it does next ---
const selection = createDriverSelection({ myDriverRepo });
const library = createDriverLibrary({
  driverRepo, myDriverRepo, prefs, logging, selection,
  confirmReset: (question) => confirm(question),
});
const designIO = createDesignIO({ logging });

const app = createApp(App)
  .directive('expo-step', vExpoStep)
  .directive('limits', vLimits);

provideApp(app, { logging, library, selection, designIO, prLibrary, myDrivers: myDriverRepo, diagnostics, faultLog });

app.mount('#app');
