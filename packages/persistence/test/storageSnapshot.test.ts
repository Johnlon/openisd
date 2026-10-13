import {describe, expect, it} from 'vitest';
import {createStorageSnapshot, isStoreDataKey} from '../src/repos/storageSnapshot.js';
import {OPENISD_CLOUD_PREFIX, OPENISD_PROJECTS_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';

describe('isStoreDataKey', () => {
  it('identifies app data keys and excludes cloud, backup and log keys', () => {
    expect(isStoreDataKey(OPENISD_PROJECTS_KEY)).toBe(true);
    expect(isStoreDataKey('openisd_cloud_auth')).toBe(false);
    expect(isStoreDataKey(`${OPENISD_CLOUD_PREFIX}state`)).toBe(false);
    expect(isStoreDataKey(`${OPENISD_CLOUD_PREFIX}ledger`)).toBe(false);
    expect(isStoreDataKey('openisd_backup_v1')).toBe(false);
    expect(isStoreDataKey('openisd_storage_log')).toBe(false);
  });
});

describe('createStorageSnapshot', () => {
  it('a store holding openisd_cloud_auth and openisd_cloud_state plus a project backs up with the project and without both cloud keys', () => {
    const storage = createMemoryStorage({
      openisd_cloud_auth: 'secret-token',
      openisd_cloud_state: 'secret-state',
      [OPENISD_PROJECTS_KEY]: 'projects-payload',
    });
    const snapshot = createStorageSnapshot(storage, () => 1_000_000).take();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.data).toEqual({
      [OPENISD_PROJECTS_KEY]: 'projects-payload',
    });
    expect(snapshot?.data).not.toHaveProperty('openisd_cloud_auth');
    expect(snapshot?.data).not.toHaveProperty('openisd_cloud_state');
  });
});
