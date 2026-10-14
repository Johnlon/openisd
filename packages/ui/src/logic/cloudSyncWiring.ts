import type {
  DeviceName,
  OAuthConfig,
} from '@openisd/design/cloud';
import {
  OPENISD_MY_DRIVERS_KEY,
  OPENISD_MY_PASSIVE_RADIATORS_KEY,
  type AppSettingsRepo,
  type AuthStorage,
  type CloudSession,
  type CloudSync,
  type KeyValueStorage,
  type LayoutRules,
  type ProjectRepo,
  type RedirectGuard,
  type RunLock,
  type RunOutcome,
  type SessionLocation,
  type StorageBackup,
  type SyncEngine,
  type SyncLedger,
  type SyncScheduler,
  type SyncTriggers,
  type Timer,
  createCloudSync,
  createDriveStore,
  createFavouritesRepo,
  createFetchHttp,
  createGoogleRevoker,
  createImplicitSession,
  createProjectDocs,
  createSavedEntries,
  createSavedEntryDocs,
  createSingletonDocs,
  createSyncEngine,
  createSyncLedger,
  createAccountNamer,
  createSyncScheduler,
  relistOnce,
  createTokenStore,
} from '@openisd/persistence';

class InMemoryLock implements RunLock {
  private chain: Promise<unknown> = Promise.resolve();

  async withLock<T>(_name: string, f: () => Promise<T>): Promise<T> {
    const next = this.chain.then(f, f);
    this.chain = next;
    return next;
  }
}

function createNavigatorLockAdapter(locks: LockManager): RunLock {
  return {
    async withLock<T>(name: string, f: () => Promise<T>): Promise<T> {
      return locks.request(name, () => f());
    },
  };
}

export function createDefaultRunLock(): RunLock {
  if (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    navigator.locks !== undefined &&
    navigator.locks !== null &&
    typeof navigator.locks.request === 'function'
  ) {
    return createNavigatorLockAdapter(navigator.locks);
  }
  return new InMemoryLock();
}

export function createBrowserTimer(): Timer {
  return {
    after(ms: number, f: () => void): () => void {
      const handle = setTimeout(f, ms);
      return () => clearTimeout(handle);
    },
    every(ms: number, f: () => void): () => void {
      const handle = setInterval(f, ms);
      return () => clearInterval(handle);
    },
  };
}


export interface CloudSyncWiringDeps {
  readonly storage: KeyValueStorage & AuthStorage;
  readonly projectRepo: ProjectRepo;
  readonly appSettingsRepo: AppSettingsRepo;
  readonly backup: StorageBackup;
  readonly rules: LayoutRules;
  readonly config: OAuthConfig;
  readonly guard: RedirectGuard;
  readonly fetch: typeof fetch;
  /** Whether the browser says it is online; a failed request is "offline" only when it is not. */
  readonly online: () => boolean;
  readonly timer: Timer;
  readonly lock: RunLock;
  readonly visible: () => boolean;
  readonly location: SessionLocation;
  readonly random: () => Uint8Array;
  readonly now: () => number;
  readonly deviceName: DeviceName;
}

export interface CloudSyncWiring {
  readonly cloudSync: CloudSync;
  readonly triggers: SyncTriggers;
  readonly scheduler: SyncScheduler;
  readonly session: CloudSession;
  readonly ledger: SyncLedger;
  readonly engine: SyncEngine;
}

/** Builds sync over a writable store; the caller never builds it on a read-only one. */
export function createCloudSyncWiring(deps: CloudSyncWiringDeps): CloudSyncWiring {
  const {now, random, timer, lock, visible, location} = deps;

  const tokenStore = createTokenStore(deps.storage);
  const revoker = createGoogleRevoker(createFetchHttp(deps.fetch, deps.online));
  const session = createImplicitSession({
    config: deps.config,
    store: tokenStore,
    guard: deps.guard,
    revoker,
    location,
    clock: now,
    random,
  });

  const driveStore = createDriveStore({
    http: createFetchHttp(deps.fetch, deps.online),
    session,
  });

  const ledger = createSyncLedger({
    storage: deps.storage,
    random,
  });
  relistOnce(deps.storage, ledger);

  const projectDocs = createProjectDocs({
    repo: deps.projectRepo,
    rules: deps.rules,
    now,
  });

  const driverEntries = createSavedEntries<unknown>(
    deps.storage,
    { key: OPENISD_MY_DRIVERS_KEY, open: r => r, snapshot: v => v },
    deps.backup,
  );
  const driverDocs = createSavedEntryDocs({
    repo: driverEntries,
    rules: deps.rules,
    now,
  });

  const prEntries = createSavedEntries<unknown>(
    deps.storage,
    { key: OPENISD_MY_PASSIVE_RADIATORS_KEY, open: r => r, snapshot: v => v },
    deps.backup,
  );
  const prDocs = createSavedEntryDocs({
    repo: prEntries,
    rules: deps.rules,
    now,
  });

  const settingsDocs = createSingletonDocs({
    repo: deps.appSettingsRepo,
    rules: deps.rules,
    now,
  });

  const favouritesDocs = createSingletonDocs({
    repo: createFavouritesRepo(deps.storage, deps.backup),
    rules: deps.rules,
    now,
  });

  let cloudSync: CloudSync | null = null;

  const engine = createSyncEngine({
    cloud: driveStore,
    local: [projectDocs, driverDocs, prDocs, settingsDocs, favouritesDocs],
    ledger,
    backup: deps.backup,
    layout: deps.rules.layout,
    now,
    deviceName: deps.deviceName,
    progress: {
      started: () => cloudSync?.runStarted(),
      pushed: (count) => cloudSync?.runPushed(count),
    },
  });

  const namer = createAccountNamer({
    grant: () => session.grant(),
    identity: driveStore,
    nameAccount: (email) => session.nameAccount(email),
    onRefused: (fault) => cloudSync?.accountRefused(fault),
  });

  const scheduler = createSyncScheduler({
    engine,
    session,
    namer,
    timer,
    now,
    lock,
    visible,
    onOutcome: (outcome: RunOutcome) => {
      cloudSync?.onOutcome(outcome);
    },
    debounce_ms: 3000,
    focusGap_ms: 30000,
    tick_ms: 60000,
  });

  cloudSync = createCloudSync({
    session,
    scheduler,
    ledger,
    engine,
    now,
  });

  return {
    cloudSync,
    triggers: scheduler,
    scheduler,
    session,
    ledger,
    engine,
  };
}
