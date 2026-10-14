import {describe, expect, it} from 'vitest';
import {createStorageUsage} from '../src/repos/storageUsage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECT_BIN_KEY, OPENISD_PROJECTS_KEY, OPENISD_VIEW_KEY,
} from '../src/repos/storageKeys.js';

const size = (key: string, value: string) => key.length + value.length;

describe('storage usage', () => {
  it('sums key and value characters per group; a binned project counts under the Bin, not Projects', () => {
    const backupKey = `${OPENISD_BACKUP_PREFIX}v20260101T0000Z_20260101T000000Z`;
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'p'.repeat(100),
      [OPENISD_MY_DRIVERS_KEY]: 'd'.repeat(20),
      [OPENISD_PROJECT_BIN_KEY]: 'm'.repeat(5),
      [backupKey]: 'b'.repeat(50),
      [OPENISD_BACKUP_KEYS.view]: 'c'.repeat(7),
      [OPENISD_VIEW_KEY]: 'v'.repeat(3),
      'not_openisd': 'x'.repeat(1000),
    });
    const usage = createStorageUsage(storage, {binned: () => [{id: 'a', name: 'A', binnedAt_ms: 0, device: '', bytes: 30}]});
    const projects = size(OPENISD_PROJECTS_KEY, 'p'.repeat(100)) - 30;
    const bin = size(OPENISD_PROJECT_BIN_KEY, 'm'.repeat(5)) + 30;
    const backups = size(backupKey, 'b'.repeat(50)) + size(OPENISD_BACKUP_KEYS.view, 'c'.repeat(7));
    const myDrivers = size(OPENISD_MY_DRIVERS_KEY, 'd'.repeat(20));
    const settings = size(OPENISD_VIEW_KEY, 'v'.repeat(3));
    expect(usage.report()).toEqual({projects, myDrivers, bin, backups, settings, total: projects + myDrivers + bin + backups + settings});
  });
});
