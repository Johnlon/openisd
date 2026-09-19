import {createApp} from 'vue';
import App from './ui/App.vue';
import {vExpoStep} from './ui/directives/expoStep.js';
import {vLimits} from './ui/directives/limits.js';
import {
    createBundledDriverRepo,
    createBundledPassiveRadiatorRepo,
    createFileStorage,
    createLocalStorage,
    createMyDriverRepo,
    createMyPassiveRadiatorRepo,
    createPrefsRepo,
    createProjectRepo,
    createViewStateRepo
} from '@openisd/persistence';
import {Engine} from '@openisd/design/engine';
import {createLogging} from './logging/flash.js';
import {createFaultLog} from './diagnostics/faultLog.js';
import {createDriverSelection} from './logic/driverSelection.js';
import {createDriverBrowsingState} from './logic/driverBrowsingState.js';
import {createApplicationIO} from './logic/useApplicationIO.js';
import {provideApp} from './logic/app.js';
import {NoFocusedProjectError} from './logic/appState.js';
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

// --- services: arguments in, data out, no app state ---
// FIRST: a fault that fires while the rest of this file runs must still be caught.
const faultLog = createFaultLog();
faultLog.install();

const engine = new Engine();

// STORAGE (port): the browser's own key-value storage.
const storage = createLocalStorage();
const logging = createLogging();
// The bundled catalogue — docs/design/BUNDLED_CATALOGUE_API.md. Two repos over the same
// mechanism: an index fetched when a picker opens, one record fetched when a device is picked,
// both held for CATALOGUE_MAX_AGE_MS and then fetched again, so a long-lived tab picks up a
// republished catalogue without a reload. Nothing is awaited here — the app mounts first.
const CATALOGUE_MAX_AGE_MS = 60 * 60 * 1000;
const driverRepo = createBundledDriverRepo({ fetch, baseUrl: import.meta.env.BASE_URL, engine, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now });
const myDriverRepo = createMyDriverRepo(storage, engine);
const prefs = createPrefsRepo(storage);
const myPassiveRadiators = createMyPassiveRadiatorRepo(storage, engine);
const bundledPRs = createBundledPassiveRadiatorRepo({ fetch, baseUrl: import.meta.env.BASE_URL, engine, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now });
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
const projectRepo = createProjectRepo(engine, fileStorage, storage);
const viewStateRepo = createViewStateRepo(storage);
const designIO = createApplicationIO({ logging, fileStorage, projectRepo });

const app = createApp(App)
  .directive('expo-step', vExpoStep)
  .directive('limits', vLimits);

provideApp(app, {
  engine, logging, driverBrowsing, selection, designIO, myPassiveRadiators,
  bundledPassiveRadiators: bundledPRs, myDrivers: myDriverRepo,
  driverFileStorage, faultLog, projectRepo, viewStateRepo,
});

// Visibility only, not a recovery mechanism (PROMPT_RELEASE_HARDENING plan): a
// `NoFocusedProjectError` means the top-level gate itself has a bug, or a caller bypassed it —
// masking that would hide it. `console.error` always; the flash toast is best-effort (Logging
// is already constructed above, so this never races app startup).
app.config.errorHandler = (err, instance, info) => {
  console.error('[app] uncaught error', err, info, instance);
  const message = err instanceof NoFocusedProjectError
    ? 'Something needed an open project, but none is open. Please report this.'
    : `Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
  logging.flash(message);
};

app.mount('#app');
