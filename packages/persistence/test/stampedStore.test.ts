import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBuildStamp} from '../src/repos/buildStamp.js';
import {createStampedStore} from '../src/repos/stampedStore.js';
import {
  OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY, OPENISD_STORAGE_LOG_KEY,
} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';

const stamp = {layout: 2, build: createBuildStamp('v20260301T040506Z')};

describe('the stamped store', () => {
  it('stamps the layout and build with a write of a data key', () => {
    const inner = createMemoryStorage();
    createStampedStore(inner, stamp).set(OPENISD_MY_DRIVERS_KEY, 'drivers');
    assert.equal(inner.get(OPENISD_MY_DRIVERS_KEY), 'drivers');
    assert.equal(inner.get(OPENISD_STORAGE_LAYOUT_KEY), '2');
    assert.equal(inner.get(OPENISD_STORAGE_BUILD_KEY), 'v20260301T0405Z');
  });

  it('replaces the stamp an older build left', () => {
    const inner = createMemoryStorage({[OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: 'v20250101T0000Z'});
    createStampedStore(inner, stamp).set(OPENISD_MY_DRIVERS_KEY, 'drivers');
    assert.equal(inner.get(OPENISD_STORAGE_LAYOUT_KEY), '2');
    assert.equal(inner.get(OPENISD_STORAGE_BUILD_KEY), 'v20260301T0405Z');
  });

  it('does not stamp for a write that is not store data (a backup, the log)', () => {
    const inner = createMemoryStorage();
    const store = createStampedStore(inner, stamp);
    store.set(`${OPENISD_BACKUP_PREFIX}vx`, 'backup');
    store.set(OPENISD_STORAGE_LOG_KEY, 'log');
    assert.equal(inner.get(OPENISD_STORAGE_LAYOUT_KEY), null);
  });

  it('removes, reads and lists through to the storage', () => {
    const inner = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers'});
    const store = createStampedStore(inner, stamp);
    assert.equal(store.get(OPENISD_MY_DRIVERS_KEY), 'drivers');
    store.remove(OPENISD_MY_DRIVERS_KEY);
    assert.deepEqual(store.keys(), []);
  });
});
