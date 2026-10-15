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
import { syncDisplayOf } from '@openisd/design/cloud';
import type { CloudSync, CloudUiStore } from '@openisd/persistence';

export interface CloudSyncAPI {
  readonly sync: CloudSync | null;
  readonly status: Readonly<Ref<SyncStatus>>;
  readonly conflicts: Readonly<Ref<readonly ConflictCopy[]>>;
  readonly activity: Readonly<Ref<readonly SyncActivity[]>>;
  readonly ui: Readonly<Ref<CloudUiState>>;
  dismissHint(): void;
  setConflictsSeen(count: number): void;
}

export const CloudSyncKey: InjectionKey<CloudSyncAPI> = Symbol.for('openisd.cloudSync');

export function createCloudSyncAPI(sync: CloudSync | null, uiStore: CloudUiStore): CloudSyncAPI {
  const status = ref<SyncStatus>(sync ? sync.status() : { kind: 'off' });
  // shallowRef: a deep ref would unwrap the branded id classes into plain objects.
  const conflicts = shallowRef<readonly ConflictCopy[]>(sync ? sync.conflicts() : []);
  const activity = shallowRef<readonly SyncActivity[]>(sync ? sync.activity() : []);
  const ui = ref<CloudUiState>(uiStore.read());

  if (sync) {
    const unwatch = sync.watch(() => {
      status.value = sync.status();
      conflicts.value = sync.conflicts();
      activity.value = sync.activity();
    });
    if (getCurrentScope()) {
      onScopeDispose(unwatch);
    }
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
    ui: readonly(ui),
    dismissHint,
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
    disconnect,
    openConflict,
    viewConflicts,
    hintTurnOn,
    hintDismiss,
    tap,
  };
}
