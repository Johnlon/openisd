/** REPO: stamps the store with the layout and build of the app that writes it. Every write of a
 *  data key leaves `openisd_storage_layout` and `openisd_storage_build` naming this app, so the
 *  next start knows which layout the data is in and which build to name a backup after. */
import type {BuildStamp} from './buildStamp.js';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY} from './storageKeys.js';
import {isStoreDataKey} from './storageSnapshot.js';

export interface StoreStamp {
  readonly layout: number;
  readonly build: BuildStamp;
}

/** The layout `storage` is stamped with, or null when it has none. */
function storedLayout(storage: ListableStorage): number | null {
  const text = storage.get(OPENISD_STORAGE_LAYOUT_KEY);
  const layout = text === null ? NaN : Number(text);
  return Number.isInteger(layout) ? layout : null;
}

/** Write the stamp into `storage` when it does not already hold it. A layout is never lowered. */
export function stampStore(storage: ListableStorage, stamp: StoreStamp): void {
  const layout = String(stamp.layout);
  const held = storedLayout(storage);
  if (held !== stamp.layout && (held === null || held < stamp.layout)) storage.set(OPENISD_STORAGE_LAYOUT_KEY, layout);
  if (storage.get(OPENISD_STORAGE_BUILD_KEY) !== stamp.build.text) storage.set(OPENISD_STORAGE_BUILD_KEY, stamp.build.text);
}

/** `restoring` is true only for a restore that replaces the whole store, which may take it to a lower
 *  layout; every other writer is refused on a store a newer build has taken. */
export function createStampedStore(inner: ListableStorage, stamp: StoreStamp, restoring: boolean): ListableStorage {
  return {
    keys: () => inner.keys(),
    get: key => inner.get(key),
    set(key, value) {
      const held = storedLayout(inner);
      if (!restoring && isStoreDataKey(key) && held !== null && held > stamp.layout) {
        throw new Error('A newer OpenISD has updated this browser\'s saved data. Reload this tab to keep working; nothing was lost.');
      }
      inner.set(key, value);
      if (isStoreDataKey(key)) stampStore(inner, stamp);
      if (restoring && isStoreDataKey(key) && storedLayout(inner) !== stamp.layout) inner.set(OPENISD_STORAGE_LAYOUT_KEY, String(stamp.layout));
    },
    remove: key => { inner.remove(key); },
    watch: (key, onChange) => inner.watch(key, onChange),
  };
}
