import {
  type App,
  type InjectionKey,
  type Ref,
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  readonly,
  ref,
} from 'vue';
import type { SyncStatus } from '@openisd/design/cloud';
import type { CloudSync } from '@openisd/persistence';

export interface CloudSyncAPI {
  readonly sync: CloudSync | null;
  readonly status: Readonly<Ref<SyncStatus>>;
}

export const CloudSyncKey: InjectionKey<CloudSyncAPI> = Symbol.for('openisd.cloudSync');

export function createCloudSyncAPI(sync: CloudSync | null): CloudSyncAPI {
  const status = ref<SyncStatus>(sync ? sync.status() : { kind: 'off' });
  if (sync) {
    const unwatch = sync.watch(() => {
      status.value = sync.status();
    });
    if (getCurrentScope()) {
      onScopeDispose(unwatch);
    }
  }
  return {
    sync,
    status: readonly(status),
  };
}

export function provideCloudSync(sync: CloudSync | null, app?: App): CloudSyncAPI {
  const api = createCloudSyncAPI(sync);
  if (app) {
    app.provide(CloudSyncKey, api);
  } else {
    provide(CloudSyncKey, api);
  }
  return api;
}

export function useCloudSync(): CloudSyncAPI {
  const api = inject(CloudSyncKey, null);
  if (!api) {
    throw new Error('useCloudSync(): no provider — App.vue must call provideCloudSync()');
  }
  return api;
}
