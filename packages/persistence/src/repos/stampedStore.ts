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

/** Write the stamp into `storage` when it does not already hold it. */
export function stampStore(storage: ListableStorage, stamp: StoreStamp): void {
  const layout = String(stamp.layout);
  if (storage.get(OPENISD_STORAGE_LAYOUT_KEY) !== layout) storage.set(OPENISD_STORAGE_LAYOUT_KEY, layout);
  if (storage.get(OPENISD_STORAGE_BUILD_KEY) !== stamp.build.text) storage.set(OPENISD_STORAGE_BUILD_KEY, stamp.build.text);
}

export function createStampedStore(inner: ListableStorage, stamp: StoreStamp): ListableStorage {
  return {
    keys: () => inner.keys(),
    get: key => inner.get(key),
    set(key, value) {
      inner.set(key, value);
      if (isStoreDataKey(key)) stampStore(inner, stamp);
    },
    remove: key => { inner.remove(key); },
    watch: (key, onChange) => inner.watch(key, onChange),
  };
}
