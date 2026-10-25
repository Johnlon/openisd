import {
  type App,
  type InjectionKey,
  type Ref,
  computed,
  getCurrentScope,
  inject,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
} from 'vue';
import type { SyncStatus, CloudUiState, ConflictCopy, SyncActivity, SyncDisplay, SyncTap } from '@openisd/design/cloud';
import { ProjectId, syncDisplayOf } from '@openisd/design/cloud';
import type { ProjectCloudMarks } from './projectBinView.js';
import type { CloudSync, CloudUiStore } from '@openisd/persistence';

export interface CloudSyncAPI {
  readonly sync: CloudSync | null;
  readonly status: Readonly<Ref<SyncStatus>>;
  readonly conflicts: Readonly<Ref<readonly ConflictCopy[]>>;
  readonly activity: Readonly<Ref<readonly SyncActivity[]>>;
  /** The ids of the saved projects Drive does not have as they are now. */
  readonly projectsNotOnDrive: Readonly<Ref<ReadonlySet<string>>>;
  readonly ui: Readonly<Ref<CloudUiState>>;
  /** The user chose Not now on the reconnect strip; true until the next launch. */
  readonly reconnectDismissed: Readonly<Ref<boolean>>;
  dismissHint(): void;
  dismissReconnect(): void;
  setConflictsSeen(count: number): void;
}

export const CloudSyncKey: InjectionKey<CloudSyncAPI> = Symbol.for('openisd.cloudSync');

export function createCloudSyncAPI(sync: CloudSync | null, uiStore: CloudUiStore): CloudSyncAPI {
  const status = ref<SyncStatus>(sync ? sync.status() : { kind: 'off' });
  // shallowRef: a deep ref would unwrap the branded id classes into plain objects.
  const conflicts = shallowRef<readonly ConflictCopy[]>(sync ? sync.conflicts() : []);
  const activity = shallowRef<readonly SyncActivity[]>(sync ? sync.activity() : []);
  const projectsNotOnDrive = shallowRef<ReadonlySet<string>>(sync ? sync.projectsNotOnDrive() : new Set());
  const ui = ref<CloudUiState>(uiStore.read());
  const reconnectDismissed = ref(false);

  if (sync) {
    const unwatch = sync.watch(() => {
      status.value = sync.status();
      conflicts.value = sync.conflicts();
      activity.value = sync.activity();
      projectsNotOnDrive.value = sync.projectsNotOnDrive();
    });
    if (getCurrentScope()) {
      onScopeDispose(unwatch);
    }
  }

  function dismissReconnect(): void {
    reconnectDismissed.value = true;
  }

  function dismissHint(): void {
    uiStore.dismissHint();
    ui.value = uiStore.read();
  }

  function setConflictsSeen(count: number): void {
    uiStore.setConflictsSeen(count);
    ui.value = uiStore.read();
  }
  return {
    sync,
    status: readonly(status),
    conflicts: computed(() => conflicts.value),
    activity: computed(() => activity.value),
    projectsNotOnDrive: computed(() => projectsNotOnDrive.value),
    ui: readonly(ui),
    reconnectDismissed: readonly(reconnectDismissed),
    dismissHint,
    dismissReconnect,
    setConflictsSeen,
  };
}

export function provideCloudSync(app: App, sync: CloudSync | null, uiStore: CloudUiStore): CloudSyncAPI {
  const api = createCloudSyncAPI(sync, uiStore);
  app.provide(CloudSyncKey, api);
  return api;
}

export function useCloudSync(): CloudSyncAPI {
  const api = inject(CloudSyncKey, null);
  if (!api) {
    throw new Error('useCloudSync(): no provider — App.vue must call provideCloudSync()');
  }
  return api;
}

export interface CloudSyncUiAPI {
  available: Readonly<Ref<boolean>>;
  display: Readonly<Ref<SyncDisplay>>;
  connect(): void;
  syncNow(): void;
  reconnect(): void;
  /** Not now on the reconnect strip. */
  dismissReconnect(): void;
  disconnect(): Promise<void>;
  openConflict(id: ConflictCopy['id']): void;
  viewConflicts(): void;
  hintTurnOn(): void;
  hintDismiss(): void;
  tap(action: SyncTap): void;
}

export function useCloudSyncUi(
  updateBannerShown: Readonly<Ref<boolean>>,
  openDialog: () => void,
): CloudSyncUiAPI {
  const cloudSyncAPI = useCloudSync();

  const available = computed(() => cloudSyncAPI.sync !== null);

  const display = computed<SyncDisplay>(() => {
    const status = cloudSyncAPI.status.value;
    const conflicts = cloudSyncAPI.conflicts.value;
    const ui = cloudSyncAPI.ui.value;
    return syncDisplayOf({
      status,
      conflicts,
      activity: cloudSyncAPI.activity.value,
      conflictsSeen: ui.conflictsSeen,
      hintDismissed: ui.hintDismissed,
      launches: ui.launches,
      updateBannerShown: updateBannerShown.value,
      reconnectDismissed: cloudSyncAPI.reconnectDismissed.value,
      configured: available.value,
    });
  });

  function connect(): void {
    cloudSyncAPI.sync?.connect();
  }

  function syncNow(): void {
    void cloudSyncAPI.sync?.syncNow();
  }

  function reconnect(): void {
    cloudSyncAPI.sync?.reconnect();
  }

  async function disconnect(): Promise<void> {
    await cloudSyncAPI.sync?.disconnect();
  }

  function openConflict(id: ConflictCopy['id']): void {
    cloudSyncAPI.sync?.conflictSeen(id);
  }

  function viewConflicts(): void {
    cloudSyncAPI.setConflictsSeen(cloudSyncAPI.conflicts.value.length);
    openDialog();
  }

  function hintTurnOn(): void {
    cloudSyncAPI.dismissHint();
    openDialog();
  }

  function hintDismiss(): void {
    cloudSyncAPI.dismissHint();
  }

  function tap(action: SyncTap): void {
    if (action === 'reconnect') {
      reconnect();
    } else {
      openDialog();
    }
  }

  return {
    available,
    display,
    connect,
    syncNow,
    reconnect,
    dismissReconnect: cloudSyncAPI.dismissReconnect,
    disconnect,
    openConflict,
    viewConflicts,
    hintTurnOn,
    hintDismiss,
    tap,
  };
}

/** What cloud sync says about the saved projects, for the Projects list's marks. */
export function projectCloudMarks(api: CloudSyncAPI): ProjectCloudMarks {
  const status = api.status.value;
  return {
    cloudOn: api.sync !== null && status.kind !== 'off',
    running: status.kind === 'syncing',
    notOnDrive: api.projectsNotOnDrive.value,
    conflictCopies: new Set(api.conflicts.value.flatMap(c => c.id instanceof ProjectId ? [c.id.text] : [])),
  };
}
