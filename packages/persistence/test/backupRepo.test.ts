/**
 * `createBackupRepo` — one JSON snapshot of every key `storageKeys.ts` lists, and putting one
 * back. The bundled catalogues are never in scope: they live outside this storage entirely
 * (fetched over HTTP), so there is nothing to exclude them FROM.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBackupRepo} from '../src/repos/backupRepo.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY, OPENISD_VIEW_KEY} from '../src/repos/storageKeys.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

describe('createBackupRepo', () => {
  it('exports every populated key and skips empty ones', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: '{"projects":[]}',
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":[]}',
    });
    const backup = createBackupRepo(storage);

    const envelope: unknown = JSON.parse(backup.exportAll());
    assert.ok(isRecord(envelope));
    if (!isRecord(envelope)) throw new Error('unreachable');
    assert.equal(envelope.openisdBackup, true);
    assert.equal(typeof envelope.exportedAt, 'string');
    assert.ok(isRecord(envelope.data));
    if (!isRecord(envelope.data)) throw new Error('unreachable');
    assert.equal(envelope.data[OPENISD_PROJECTS_KEY], '{"projects":[]}');
    assert.equal(envelope.data[OPENISD_MY_DRIVERS_KEY], '{"schema":1,"entries":[]}');
    assert.equal(OPENISD_VIEW_KEY in envelope.data, false, 'a key nothing wrote to is skipped, not stored as null/empty');
  });

  it('round-trips: exporting and importing into a fresh storage reproduces every key', () => {
    const source = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: '{"projects":["a"]}',
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["d1"]}',
    });
    const json = createBackupRepo(source).exportAll();

    const target = createMemoryStorage();
    const result = createBackupRepo(target).importAll(json);

    assert.deepEqual(result, { kind: 'ok', keysRestored: 2 });
    assert.equal(target.get(OPENISD_PROJECTS_KEY), '{"projects":["a"]}');
    assert.equal(target.get(OPENISD_MY_DRIVERS_KEY), '{"schema":1,"entries":["d1"]}');
  });

  it('a restore REPLACES, not merges: a key the backup does not have is cleared, not left alone', () => {
    const target = createMemoryStorage({
      // Present now, but absent from the backup below — a genuine "revert to that point in
      // time", not a backup that only ever adds data.
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["stale, pre-backup driver"]}',
    });
    const backupWithOnlyProjects = JSON.stringify({
      openisdBackup: true, schemaVersion: 1, exportedAt: '2026-01-01T00:00:00.000Z',
      data: { [OPENISD_PROJECTS_KEY]: '{"projects":["restored"]}' },
    });

    const result = createBackupRepo(target).importAll(backupWithOnlyProjects);

    assert.deepEqual(result, { kind: 'ok', keysRestored: 1 });
    assert.equal(target.get(OPENISD_PROJECTS_KEY), '{"projects":["restored"]}');
    assert.equal(target.get(OPENISD_MY_DRIVERS_KEY), null, 'a key absent from the backup must be cleared, not kept');
  });

  it('refuses a non-JSON file and changes nothing', () => {
    const target = createMemoryStorage({ [OPENISD_PROJECTS_KEY]: '{"projects":["untouched"]}' });
    const result = createBackupRepo(target).importAll('not json at all');
    assert.equal(result.kind, 'invalid');
    assert.equal(target.get(OPENISD_PROJECTS_KEY), '{"projects":["untouched"]}');
  });

  it('refuses a JSON file that is not an OpenISD backup envelope and changes nothing', () => {
    const target = createMemoryStorage({ [OPENISD_PROJECTS_KEY]: '{"projects":["untouched"]}' });
    const result = createBackupRepo(target).importAll(JSON.stringify({ some: 'other json file' }));
    assert.equal(result.kind, 'invalid');
    assert.equal(target.get(OPENISD_PROJECTS_KEY), '{"projects":["untouched"]}');
  });
});
