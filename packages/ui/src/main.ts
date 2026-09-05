import { createApp } from 'vue';
import App from './ui/App.vue';
import { vExpoStep } from './ui/directives/expoStep.js';
import { vLimits } from './ui/directives/limits.js';
import { createLocalStorage, createDriverRepo, createMyDriverRepo, createPrefsRepo, createMyPassiveRadiatorRepo, createBundledPassiveRadiatorRepo, createFileStorage, createProjectRepo, createViewStateRepo } from '@openisd/persistence';
import { readBundle } from '@openisd/persistence';
import { Engine } from '@openisd/design/engine';
import { createLogging } from './logging/flash.js';
import { createDiagnostics } from './diagnostics/selftest.js';
import { createFaultLog } from './diagnostics/faultLog.js';
import { createDriverSelection } from './logic/driverSelection.js';
import { createDriverBrowsingState } from './logic/driverBrowsingState.js';
import { createDesignIO } from './logic/useDesignIO.js';
import { provideApp } from './logic/app.js';
import { NoFocusedProjectError } from './logic/appState.js';
import sourcesJson from '../../../drivers/sources.json';
import bundleJson from './drivers-bundle.json';
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

// The bundle is a BUILD ARTIFACT, so its contents are not knowable when this file is compiled.
// `readBundle` looks at the value instead of asserting a shape over it, and it runs AFTER
// `faultLog.install()` so a bundle that fails is a reported fault rather than a blank page with
// nothing in the log.
const loaded = readBundle(bundleJson);
if ('problems' in loaded) {
  throw new Error(
    `drivers-bundle.json is not a usable bundle — rebuild it with scripts/bundle-drivers.mjs:\n` +
    loaded.problems.map(m => `  - ${m}`).join('\n'),
  );
}
const bundle = loaded.bundle;

// STORAGE (port): the browser's own key-value storage.
const storage = createLocalStorage();
const logging = createLogging();
const driverRepo = createDriverRepo({ sources: sourcesJson.sources, bundle, engine: new Engine() });
const myDriverRepo = createMyDriverRepo(storage);
const prefs = createPrefsRepo(storage);
const myPassiveRadiators = createMyPassiveRadiatorRepo(storage);
const bundledPRs = createBundledPassiveRadiatorRepo(bundle).list();
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
const projectRepo = createProjectRepo(storage, fileStorage);
const viewStateRepo = createViewStateRepo(storage);
const designIO = createDesignIO({ logging, fileStorage, projectRepo });

const app = createApp(App)
  .directive('expo-step', vExpoStep)
  .directive('limits', vLimits);

provideApp(app, {
  logging, driverBrowsing, selection, designIO, myPassiveRadiators,
  bundledPassiveRadiators: bundledPRs, myDrivers: myDriverRepo,
  driverFileStorage, diagnostics, faultLog, projectRepo, viewStateRepo,
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
