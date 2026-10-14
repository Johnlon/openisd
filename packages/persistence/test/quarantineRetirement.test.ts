/**
 * The old quarantine copy of the open-project session is retired: refused copies replace it, and
 * the key is removed once, behind the whole-store backup.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createQuarantineRetirement} from '../src/repos/quarantineRetirement.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_QUARANTINE_SESSION_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {backupOn} from './fixtures/repoOn.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';

describe('quarantine retirement', () => {
  it('does nothing, and takes no backup, when there is no old quarantine copy', () => {
    const storage = createMemoryStorage({openisd_projects: '{}'});
    assert.equal(createQuarantineRetirement(storage, backupOn(storage)).run(), 'nothingToDo');
    assert.equal(storage.keys().some(key => key.startsWith(OPENISD_BACKUP_PREFIX)), false);
  });

  it('removes the old copy after a whole-store backup that still holds it', () => {
    const storage = createMemoryStorage({[OPENISD_QUARANTINE_SESSION_KEY]: '{"entries":[]}', openisd_projects: '{}'});
    assert.equal(createQuarantineRetirement(storage, backupOn(storage)).run(), 'retired');
    assert.equal(storage.get(OPENISD_QUARANTINE_SESSION_KEY), null);
    const [backupKey] = storage.keys().filter(key => key.startsWith(OPENISD_BACKUP_PREFIX));
    assert.ok(backupOn(storage).read(backupKey)?.includes('openisd_quarantine_session'));
  });

  it('refuses, and removes nothing it did not have to, when live data alone cannot be backed up', () => {
    const storage = createQuotaStorage(250, {openisd_projects: 'x'.repeat(120), [OPENISD_QUARANTINE_SESSION_KEY]: 'y'.repeat(20)});
    assert.equal(createQuarantineRetirement(storage, backupOn(storage)).run(), 'refused');
    assert.equal(storage.get('openisd_projects'), 'x'.repeat(120));
  });
});
