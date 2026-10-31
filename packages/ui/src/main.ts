import {AppUpdate} from './logic/appUpdate.js';
import {ScriptedUpdateHost} from './logic/scriptedUpdateHost.js';
import {createLoadingOverlay, type LoadingOverlay} from './logic/loadingOverlay.js';
import {createStoreGateSession} from './logic/storeGate.js';
import StoreGate from './ui/components/StoreGate.vue';
import {createApp} from 'vue';
import App from './ui/App.vue';
import {vLimits} from './ui/directives/limits.js';
import {
    createAppSettingsRepo,
    createBackupRepo,
    createBundledDriverRepo,
    createBundledPassiveRadiatorRepo,
    createFileOpen,
    createFileStorage,
    createBuildStamp,
    createFileSave,
    createExportedFiles,
    createStorageHistory,
    createStorageUsage,
    preRepairCopyText,
    createLocalStorage, createStoragePrefix,
    createMemoryStorage,
    createLayoutSteps,
    STORAGE_LAYOUT,
    createStoreOpening,
    type OpenStore,
    createMyDriverRepo,
    createMyPassiveRadiatorRepo,
    createPrefsRepo,
    createProjectRepo,
    createProjectBin,
    createProjectBinMarks,
    createStoredTextCompaction,
    createQuarantineRetirement,
    createLedgerFollowsRewrite,
    createViewStateRepo,
    isStoredDataFault,
    type CloudSync,
    type SessionLocation,
    createRedirectGuard,
    createTokenStore,
    createImplicitSession,
    createSyncLedger,
    createCloudUiStore,
    createSaveSignal,
    createBrowserStoragePort,
    createPersistenceStatus,
    createSessionStorage,
    createUsageNoticeTab,
} from '@openisd/persistence';
import {DeviceName, cloudSyncReportLines, cloudSyncSummary, isOAuthFragment, type OAuthConfig} from '@openisd/design/cloud';
import {createBrowserTimer, createCloudSyncWiring, createDefaultRunLock} from './logic/cloudSyncWiring.js';
import {followPulledProjects} from './logic/pulledProjects.js';
import {provideCloudSync} from './hooks/CloudSync-hooks.js';
import {handleOAuthBoot} from './logic/boot.js';
import {createLogging} from './logging/flash.js';
import {flashStartupUse} from './logic/startupUsageNotice.js';
import {storedUseOf} from './logic/storedUse.js';
import {createFaultLog} from './diagnostics/faultLog.js';
import {createDriverSelection} from './logic/driverSelection.js';
import {createDriverBrowsingState} from './logic/driverBrowsingState.js';
import {createApplicationIO} from './logic/applicationIO.js';
import {DesignFiles} from './logic/fileImportExport.js';
import {DriverDrafts} from './logic/driverDraft.js';
import {createConfirmPort} from './logic/confirmPort.js';
import {createExportNotice} from './logic/exportNotice.js';
import {provideApp} from './logic/app.js';
import {createAppState, NoFocusedProjectError} from './logic/appState.js';
import {createPresentationState} from './logic/presentationState.js';
import {installTestHooks} from './logic/testHooks.js';
import {createDevVersionPort, createAppVersionPort, type HotUpdateSource} from './logic/appVersion.js';
import {startVersionIndex} from './logic/versionIndex.js';
import {BeaconTelemetry, NoTelemetry, type Telemetry} from './logic/telemetry/telemetry.js';
import {chooseEndpoint} from './logic/telemetry/endpoint.js';
import {CrashReports} from './logic/telemetry/crashReports.js';
import {createErrorContextReaders, ErrorContext, RecentActions} from './logic/telemetry/errorContext.js';
import {crashHash} from './logic/telemetry/crashHash.js';
import {LaunchReporter, platformHintOf, platformOf, type LaunchEnvironment} from './logic/telemetry/launch.js';
import {InstallMarker} from './logic/telemetry/install.js';
import {browserIdOf} from './logic/telemetry/browserId.js';
import {SessionEnd} from './logic/telemetry/sessionEnd.js';
import {registerServiceWorker} from './logic/telemetry/serviceWorker.js';
import {installBrowserListeners} from './logic/telemetry/browserListeners.js';
import {FeatureUse} from './logic/telemetry/featureUse.js';
import {driverPickRecorder} from './logic/telemetry/driverPick.js';
import {provideTelemetryUi} from './hooks/telemetryContext.js';
import {provideAnnouncementCenter} from './hooks/Announcements-hooks.js';
import {announcementEndpointsForHostname, createAnnouncementCenter} from './logic/announcementCenter.js';
import {newUuid} from '@openisd/design';
import {DesktopSizes, PhoneRowSizes, trailOfLocation} from '@openisd/design/fields';
import {createEngine} from '@openisd/design/engine';
import {basicUtc, browserNameOf, formatDateTime, persistenceLine} from '@openisd/design/fields';
import {announceLostKeys} from './logic/lostKeyNotice.js';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './style.css';

/** The browser's storage under this deployment's prefix: the /test/ build keeps a store of its own. */
const storagePrefix = createStoragePrefix(location.pathname);
const localStore = createLocalStorage(storagePrefix);
/** This tab's own storage, under the same prefix: what is remembered once per tab. */
const tabStore = createSessionStorage(storagePrefix);

const REDIRECT_PROJECT_KEY = 'openisd_redirect_project';

/** The project open when the app left for Google sign-in; sessionStorage, so it lasts one tab visit. */
interface RecordedProjectIdStore {
  get(): string | null;
  set(id: string): void;
  clear(): void;
}

const randomBytes = (): Uint8Array => crypto.getRandomValues(new Uint8Array(16));

/** Restore, reset and repair replace stored data wholesale: the sync record is then stale. */
const forgetCloudSyncRecord = (): void => {
  createSyncLedger({storage: localStore, random: randomBytes}).forgetAll();
};

// packages/ui/.env sets it for every build; .env.test leaves it empty for the browser suite.
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || null;
const oauthConfig: OAuthConfig = {
  clientId: googleClientId,
  // The app's own directory, so a snapshot at /snap/<stamp>/ comes back to itself and the root
  // release to the root (John, 14 Oct 2026: Google sent his snapshot sign-in back to the root,
  // which was the old release and ignored the token). The hash and query are not part of it.
  redirectUri: new URL('./', window.location.href).href,
  scopes: ['https://www.googleapis.com/auth/drive.appdata'],
};

/** THE COMPOSITION ROOT: build the app on an open store and mount it. */
function startApp(store: OpenStore, overlay: LoadingOverlay | null, recordedProjectIdStore: RecordedProjectIdStore): void {
  // THE COMPOSITION ROOT (ARCHITECTURE.md §2).
  //
  // The only place in the app that constructs anything. Every service is built here with its
  // collaborators passed in, the logic layer is built on top of those services, and the whole
  // facade is handed to the presentation layer through Vue's provide/inject. Nothing below
  // this file reaches for a ready-made instance, which is what lets any of it be exercised in
  // a test over substitutes.

  // --- services: arguments in, data out, no app state ---
  // FIRST: a fault that fires while the rest of this file runs must still be caught.
  // A repair's backup is a file download: the user keeps it outside the browser.
  // Whether the browser keeps OpenISD's data: asked once, below, once the fault log is up.
  const browserStorage = createBrowserStoragePort('storage' in navigator ? navigator.storage : undefined, browserNameOf(navigator.userAgent));
  const persistence = createPersistenceStatus(browserStorage, localStore);
  const faultLog = createFaultLog((fileName, text) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }, () => ({ view: viewStateRepo, appSettings: appSettingsRepo }),
    (thrown) => isStoredDataFault(thrown) ? thrown.store : null,
    {
      lines: () => cloudSyncReportLines(cloudSync === null ? null : cloudSync.diagnostics()),
      summary: () => cloudSyncSummary(cloudSync === null ? null : cloudSync.diagnostics()),
    },
    {lines: () => [persistenceLine(persistence.outcome())]},
    key => { const held = storage.get(key); return held === null ? null : preRepairCopyText(held); },
    () => localStore.keys().filter(k => k.startsWith('openisd_'))
      .map(k => `${k}: ${(localStore.get(k) ?? '').length} bytes`).join('\n  '));
  faultLog.install();
  void persistence.ask();

  // TELEMETRY: anonymous usage events, fire-and-forget. Built here and handed to what records them.
  // A dev server and the browser suite get `NoTelemetry` (the suite opts one spec in).
  const buildVersion: unknown = import.meta.env.VITE_BUILD_VERSION;
  const appVersionText = typeof buildVersion === 'string' ? buildVersion : '';
  const telemetryEndpoint = chooseEndpoint({
    hostname: location.hostname,
    mode: import.meta.env.MODE,
    testOptIn: Reflect.get(globalThis, 'openisdTelemetryOn') === true,
  });
  const telemetryStorage = localStore;
  const telemetry: Telemetry = telemetryEndpoint === null
    ? new NoTelemetry()
    : new BeaconTelemetry({
        endpoint: telemetryEndpoint,
        version: appVersionText,
        beacon: (url, body) => navigator.sendBeacon(url, body),
        online: () => navigator.onLine,
        now: () => Date.now(),
        sessionId: newUuid(),
        browserId: browserIdOf(telemetryStorage, newUuid),
      });
  const installMarker = new InstallMarker(telemetry, telemetryStorage);
  // STORAGE (port): the browser's key-value storage, opened by the load rules in main.ts: stamped with
  // this build's layout, kept in step with the storage log, and with ONE whole-store backup that every
  // destructive write goes through first.
  const {storage, backup: storageBackup} = store;

  const saves = createSaveSignal();

  // ONE engine for the whole app, built over the application settings: the engine carries the
  // plausibility band and environment, so it reads them from the same repo `appState` writes to.
  const appSettingsRepo = createAppSettingsRepo(storage, storageBackup, fault => console.error(fault), forgetCloudSyncRecord, saves.notify);
  const engine = createEngine({
    ventedLimits: () => appSettingsRepo.ventedLimits(),
    envDefaults: () => appSettingsRepo.envDefaults(),
  });
  // The two live state objects, built once here and handed to everything that needs them.
  const presentation = createPresentationState();
  const appState = createAppState({ engine, appSettings: appSettingsRepo, presentation, telemetry });
  const logging = createLogging();
  // The bundled catalogue — docs/design/BUNDLED_CATALOGUE_API.md. Two repos over the same
  // mechanism: an index fetched when a picker opens, one record fetched when a device is picked,
  // both held for CATALOGUE_MAX_AGE_MS and then fetched again, so a long-lived tab picks up a
  // republished catalogue without a reload. Nothing is awaited here — the app mounts first.
  const CATALOGUE_MAX_AGE_MS = 60 * 60 * 1000;
  const driverRepo = createBundledDriverRepo({ fetch, baseUrl: import.meta.env.BASE_URL, engine, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now });
  const myDriverRepo = createMyDriverRepo(storage, engine, storageBackup, saves.notify);
  const prefs = createPrefsRepo(storage, saves.notify);
  const myPassiveRadiators = createMyPassiveRadiatorRepo(storage, storageBackup, saves.notify);
  const bundledPRs = createBundledPassiveRadiatorRepo({ fetch, baseUrl: import.meta.env.BASE_URL, maxAge_ms: CATALOGUE_MAX_AGE_MS, now: Date.now });
  // STORAGE (port): the interactive file-save destination. Two SEPARATE instances — one for
  // the project (retains the open project's file handle), one for the driver editor's one-shot
  // .wdr/.owdr export — so exporting a driver cannot silently retarget the project Save button.
  const fileStorage = createFileStorage();
  const driverFileStorage = createFileStorage();

  // --- application layer: the app's state and what it does next ---
  const recentActions = new RecentActions();
  const featureUse = new FeatureUse(telemetry, recentActions);
  const selection = createDriverSelection({ appState, presentation, driverPicked: driverPickRecorder(telemetry, driverRepo) });
  // Stored projects written by earlier builds are indented and carry dq_calculated: rewritten once,
  // behind the whole-store backup, and Cloud sync follows it so it sees no edit. A read-only view of a backup is never written.
  if (!store.readOnly) createStoredTextCompaction(storage, storageBackup, createLedgerFollowsRewrite(storage, randomBytes)).run();
  // Refused copies replace the old quarantine copy of the session: it is removed once, behind the backup.
  if (!store.readOnly) createQuarantineRetirement(storage, storageBackup).run();
  const projectRepo = createProjectRepo(engine, fileStorage, storage, new URL('./', window.location.href).href, storageBackup, exportedFiles, report => faultLog.recordRepair(report), saves.notify);
  const deviceName = DeviceName.ofBrowser(navigator.userAgent, navigator.maxTouchPoints);
  const binMarks = createProjectBinMarks(storage, storageBackup);
  const projectBin = createProjectBin({
    projects: projectRepo, marks: binMarks, backup: storageBackup, device: () => deviceName.text, now: Date.now, onSaved: saves.notify,
  });
  const designFiles = new DesignFiles(engine, projectRepo, exportedFiles);
  const driverDrafts = new DriverDrafts(engine, appState.appContext);
  const confirmPort = createConfirmPort();
  const driverBrowsing = createDriverBrowsingState({
    driverRepo, myDriverRepo, prefs, logging, selection, files: designFiles,
    confirmReset: confirmPort.port, exportNotice: createExportNotice(confirmPort.port), appState, presentation,
  });
  const viewStateRepo = createViewStateRepo(storage, storageBackup, forgetCloudSyncRecord);

  const backup = createBackupRepo(storage, storageBackup, Date.now, layoutRules, forgetCloudSyncRecord);
  const storageHistory = createStorageHistory(storageBackup, backup, layoutRules, projectRepo);
  const storageUsage = createStorageUsage(storage, projectBin);
  const designIO = createApplicationIO({ engine, logging, fileStorage, fileOpen: createFileOpen(), projectRepo, files: designFiles, backup, storageUsage, confirmPort: confirmPort.port, appState, presentation, telemetry, featureUse, actions: recentActions });

  // The running build's version is baked in at build time; a dev server has none, which turns the
  // check off. Narrowed, not cast: the env value is untyped.
  const bakedVersion: unknown = buildVersion;
  const isDev = import.meta.env.DEV;
  // Keeps the running build in step with the deployed one. The browser suite's build has no service
  // worker, so there a scripted host stands in (scriptedUpdateHost.ts).
  const updateHost = new ScriptedUpdateHost(location.origin + import.meta.env.BASE_URL);
  const testBuild = import.meta.env.MODE === 'test';
  const appUpdate = new AppUpdate({
    container: testBuild ? updateHost : navigator.serviceWorker,
    visibility: {onVisible: listener => document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') listener(); })},
    timer: {every: (ms, listener) => { setInterval(listener, ms); }},
    anyUnsaved: () => appState.openProjects().some(p => appState.projectHasUnsavedChanges(p)),
    reload: () => location.reload(),
    caches: {keys: () => globalThis.caches.keys(), delete: name => globalThis.caches.delete(name)},
  });
  // The scripted update host, for the browser suite; a no-op in every build but `--mode test` (testHooks.ts).
  installTestHooks({updateHost}, import.meta.env.MODE);
  if (testBuild) void appUpdate.attach(updateHost);
  // The service worker is registered here, not by an injected script, so a refusal is caught.
  if (import.meta.env.VITE_SERVICE_WORKER === 'on' && 'serviceWorker' in navigator) {
    const registerSw = () => void registerServiceWorker(
      navigator.serviceWorker, `${import.meta.env.BASE_URL}sw.js`, import.meta.env.BASE_URL, telemetry,
      platformOf(platformHintOf(navigator), navigator.userAgent)).then(registration => registration === null ? undefined : appUpdate.attach(registration));
    if (document.readyState === 'complete') registerSw(); else window.addEventListener('load', registerSw);
  }

  // Hot update source: on dev server (where import.meta.hot exists), re-fetch version on vite:afterUpdate.
  const hotUpdateSource: HotUpdateSource = {
    onUpdate: (listener: () => void) => {
      import.meta.hot?.on('vite:afterUpdate', listener);
    },
  };

  // App version port: in dev mode fetch from /dev-version.json, in production use baked version.
  const devPort = isDev ? createDevVersionPort(import.meta.env.BASE_URL, fetch) : null;
  // The hosted builds, read once now (nothing is stored): they name the running release's number.
  const versionIndex = startVersionIndex(appVersionText, fetch);
  const appVersion = createAppVersionPort(
    isDev, typeof bakedVersion === 'string' ? bakedVersion : '', devPort, trailOfLocation(location), hotUpdateSource,
    versionIndex.view().then(view => view.running?.version ?? ''),
  );

  const {readScreen, readDialog} = createErrorContextReaders(presentation);

  const errorContext = new ErrorContext({
    screen: readScreen,
    dialog: readDialog,
    projects: () => appState.openProjects().length,
    box: () => appState.focusedProject()?.box.boxType.value ?? 'none',
    actions: recentActions,
    device: () => platformOf(platformHintOf(navigator), navigator.userAgent).toLowerCase(),
  });

  const crashReports = new CrashReports(
    telemetry,
    errorContext,
    (message, frames) => crashHash(appVersionText, message, frames),
  );
  const launchEnvironment = (): LaunchEnvironment => ({
    standalone: matchMedia('(display-mode: standalone)').matches,
    platformHint: platformHintOf(navigator),
    userAgent: navigator.userAgent,
    screenW: screen.width,
    screenH: screen.height,
    lang: navigator.language,
    referrer: document.referrer,
    keysLost: store.lostKeys.map(lost => lost.key),
  });
  const defer = (work: () => void): void => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(work); else setTimeout(work, 0);
  };
  installBrowserListeners({
    target: window,
    visibility: () => document.visibilityState,
    telemetry,
    onUncaught: thrown => crashReports.capture(thrown),
    install: installMarker,
    session: new SessionEnd(telemetry, featureUse, () => Date.now(), Date.now()),
  });

  const cloudUi = createCloudUiStore(localStore);

  let cloudSync: CloudSync | null = null;
  if (!store.readOnly && oauthConfig.clientId !== null) {
    cloudUi.recordLaunch();
    const commitFocusedField = (): void => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    const flushPendingSaves = (): void => {
      const focused = appState.focusedProject();
      const open = appState.openProjects();
      if (focused !== null) {
        projectRepo.saveToStorage(focused);
      }
      projectRepo.saveOpenProjects(open, focused, appState.hiddenTraces(open));
      viewStateRepo.save(appState.currentViewSnapshot());
    };
    const recordOpenProjectId = (): void => {
      const focused = appState.focusedProject();
      if (focused !== null) {
        recordedProjectIdStore.set(focused.uuid());
      } else {
        recordedProjectIdStore.clear();
      }
    };
    const redirectGuard = createRedirectGuard({
      commitFocusedField,
      flushPendingSaves,
      recordOpenProjectId,
      location: { assign: (url: string) => window.location.assign(url) },
    });

    const wiring = createCloudSyncWiring({
      storage,
      projectRepo,
      projectBin,
      binMarks,
      appSettingsRepo,
      backup: storageBackup,
      rules: layoutRules,
      config: oauthConfig,
      guard: redirectGuard,
      fetch,
      online: () => navigator.onLine,
      timer: createBrowserTimer(),
      lock: createDefaultRunLock(),
      visible: () => document.visibilityState === 'visible',
      location: {
        get href() { return window.location.href; },
        get hash() { return window.location.hash; },
        replaceState: (url: string) => { window.history.replaceState(null, '', url); },
      },
      random: randomBytes,
      now: Date.now,
      deviceName,
      projectsPulled: pulled => void followPulledProjects({
        appState,
        projectRepo,
        keptBoth: (copyId, name, item, otherDevice) => wiring.cloudSync.projectKeptBoth(copyId, name, item, otherDevice),
        deviceName,
        now: Date.now,
      }, pulled),
    });

    saves.listen(() => wiring.scheduler.onSave());

    cloudSync = wiring.cloudSync;

    wiring.triggers.onOpen();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          wiring.triggers.onFocus();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        wiring.triggers.onReconnect();
      });
    }
  }

  const app = createApp(App)
    .directive('limits', vLimits);

  provideCloudSync(app, cloudSync, cloudUi);
  provideAnnouncementCenter(app, createAnnouncementCenter(
    window.localStorage,
    window.fetch.bind(window),
    announcementEndpointsForHostname(window.location.hostname),
  ));
  provideTelemetryUi(app, {crashReports, launch: new LaunchReporter(telemetry, launchEnvironment, defer, installMarker), featureUse, actions: recentActions});
  provideApp(app, {
    engine, logging, driverBrowsing, selection, designIO, designFiles, driverDrafts, myPassiveRadiators, prefs,
    bundledPassiveRadiators: bundledPRs, bundledDrivers: driverRepo, myDrivers: myDriverRepo,
    driverFileStorage, faultLog, projectRepo, projectBin, viewStateRepo, storageHistory, storageUsage, browserStorage, persistence, saves, appUpdate, appVersion, versionIndex,
    confirmPort, appState, presentation,
    recordedProjectId: recordedProjectIdStore.get,
    cloudSync,
  });

  // Every uncaught error is logged with `console.error`. A `NoFocusedProjectError` stops there: the
  // shell already shows "No project open". Anything else gets the flash and the crash screen.
  app.config.errorHandler = (err, instance, info) => {
    console.error('[app] uncaught error', err, info, instance);
    // No project open is a state the shell shows, never a crash (John, 16 Oct 2026): the reader that
    // asked is logged above, and the no-project screen stays.
    if (err instanceof NoFocusedProjectError) {
      crashReports.logOnly(err);
      return;
    }
    logging.flash(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    crashReports.capture(err);
  };

  for (const [name, value] of DesktopSizes.cssVars()) document.documentElement.style.setProperty(name, value);
  for (const [name, value] of PhoneRowSizes.TAB.cssVars()) document.documentElement.style.setProperty(name, value);
  app.mount('#app');
  overlay?.onAppMounted();
  flashStartupUse(storedUseOf(projectRepo, storageUsage), createUsageNoticeTab(tabStore), logging.flash);
  if (store.readOnly) logging.flash('Showing a backup read-only. Nothing you change is saved.');
  // A key that was here at the last start and is gone now: say so, and wait for a click.
  void announceLostKeys(store.lostKeys, {
    confirm: confirmPort.port,
    formatTime: formatDateTime,
    exportLog: () => {
      const fileName = `openisd-storage-log-${basicUtc(Date.now())}.json`;
      createFileSave().download(fileName, store.log.exportText(), 'application/json');
      createExportNotice(confirmPort.port).exported({kind: 'storageLog'}, fileName);
    },
  });
}

const overlayElement = document.getElementById('loading-overlay');
// The browser suite's build (mode test) shows no loading overlay: its minimum display time would be
// paid on every spec's page load (John, 12 Oct 2026: "the loading overlay on tests").
if (import.meta.env.MODE === 'test') overlayElement?.remove();
const loadingOverlay = overlayElement && import.meta.env.MODE !== 'test'
  ? createLoadingOverlay({
      element: overlayElement,
      visibilityTarget: document,
      clock: {
        now: () => Date.now(),
        schedule: (fn, ms) => {
          const timer = setTimeout(fn, ms);
          return () => clearTimeout(timer);
        },
      },
    })
  : null;


if (typeof window !== 'undefined' && isOAuthFragment(window.location.hash)) {
  const bootLocation: SessionLocation = {
    get href() { return window.location.href; },
    get hash() { return window.location.hash; },
    replaceState(url: string) { window.history.replaceState(null, '', url); },
  };
  const bootTokenStore = createTokenStore(localStore);
  const bootSession = createImplicitSession({
    config: oauthConfig,
    store: bootTokenStore,
    guard: { leave: () => {} },
    revoker: { revoke: async () => {} },
    location: bootLocation,
    clock: Date.now,
    random: () => {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      return buf;
    },
  });
  await handleOAuthBoot(bootSession, { search: window.location.search, hash: window.location.hash });
}

// THE LOAD RULES come before anything is built or read: the browser store is opened (or refused)
// by `openStore`. An older layout is backed up and migrated; a newer one is not opened at all.
// The migration reads stored projects before the app's settings can be read, so its engine has default settings.
const layoutRules = { layout: STORAGE_LAYOUT, steps: createLayoutSteps(createEngine(), newUuid) };
const exportedFiles = createExportedFiles(layoutRules);
const baked: unknown = import.meta.env.VITE_BUILD_VERSION;
const opening = createStoreOpening(localStore, {
  build: createBuildStamp(typeof baked === 'string' ? baked : ''),
  now: Date.now,
  rules: layoutRules,
  memoryStorage: createMemoryStorage,
  projectRewritten: createLedgerFollowsRewrite(localStore, randomBytes),
}, forgetCloudSyncRecord);

const recordedProjectIdStore: RecordedProjectIdStore = {
  get: (): string | null => {
    try { return sessionStorage.getItem(REDIRECT_PROJECT_KEY); } catch { return null; }
  },
  set: (id: string): void => {
    try { sessionStorage.setItem(REDIRECT_PROJECT_KEY, id); } catch { /* ignore */ }
  },
  clear: (): void => {
    try { sessionStorage.removeItem(REDIRECT_PROJECT_KEY); } catch { /* ignore */ }
  },
};

if (opening.kind === 'ready') {
  startApp(opening, loadingOverlay, recordedProjectIdStore);
} else {
  const gateConfirm = createConfirmPort();
  const session = createStoreGateSession(opening, {
    formatTime: formatDateTime,
    download: (fileName, text) => createFileSave().download(fileName, text, 'application/json'),
    now: Date.now,
    exportNotice: createExportNotice(gateConfirm.port),
    onReady: (open) => { gate.unmount(); startApp(open, loadingOverlay, recordedProjectIdStore); },
  });
  const gate = createApp(StoreGate, {session, confirmState: gateConfirm.state});
  gate.mount('#app');
  loadingOverlay?.onAppMounted();
}
