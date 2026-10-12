/**
 * `createBackupRepo` — one JSON snapshot of the store's data, and putting one back. The bundled
 * catalogues are never in scope: they live outside this storage entirely (fetched over HTTP).
 * A restore KEEPS keys the file lacks unless the user asks to replace everything, and backs the
 * whole store up first (T058).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBackupRepo} from '../src/repos/backupRepo.js';
import {readEnvelope} from '../src/repos/storageSnapshot.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
  OPENISD_VIEW_KEY,
} from '../src/repos/storageKeys.js';
import {STORAGE_LAYOUT} from '../src/storageLayout.js';
import {APP_RULES, backupOn, FIXED_NOW_MS} from './fixtures/repoOn.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function repoOn(storage = createMemoryStorage()) {
  return {storage, repo: createBackupRepo(storage, backupOn(storage), () => FIXED_NOW_MS, APP_RULES)};
}

const REPLACE = {replaceEverything: true};
const KEEP = {replaceEverything: false};

describe('createBackupRepo', () => {
  it('exports every populated key and skips empty ones', () => {
    const {repo} = repoOn(createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: '{"projects":[]}',
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":[]}',
    }));

    const envelope: unknown = JSON.parse(repo.exportAll());
    assert.ok(isRecord(envelope));
    assert.equal(envelope.openisdBackup, true);
    assert.equal(envelope.exportedAt, '20260101T010203Z', 'dates are ISO 8601 basic UTC');
    assert.equal(envelope.layout, 1, 'a store with data and no layout key is layout 1');
    assert.ok(isRecord(envelope.data));
    assert.equal(envelope.data[OPENISD_PROJECTS_KEY], '{"projects":[]}');
    assert.equal(envelope.data[OPENISD_MY_DRIVERS_KEY], '{"schema":1,"entries":[]}');
    assert.equal(OPENISD_VIEW_KEY in envelope.data, false, 'a key nothing wrote to is skipped, not stored as null/empty');
  });

  it('the export names the layout and build that wrote the store, and holds no backups', () => {
    const {repo} = repoOn(createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: '[]',
      [OPENISD_STORAGE_LAYOUT_KEY]: String(STORAGE_LAYOUT),
      [OPENISD_STORAGE_BUILD_KEY]: 'v20251231T2359Z',
      [`${OPENISD_BACKUP_PREFIX}v20250101T0000Z`]: 'an old backup',
    }));
    const read = readEnvelope(repo.exportAll());
    assert.ok(read.kind === 'ok');
    assert.equal(read.snapshot.layout, STORAGE_LAYOUT);
    assert.equal(read.snapshot.build.text, 'v20251231T2359Z');
    assert.deepEqual(Object.keys(read.snapshot.data), [OPENISD_PROJECTS_KEY]);
  });

  it('round-trips: exporting and importing into a fresh storage reproduces every key', () => {
    const json = repoOn(createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: '{"projects":["a"]}',
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["d1"]}',
    })).repo.exportAll();

    const {storage, repo} = repoOn();
    const result = repo.importAll(json, REPLACE);

    assert.deepEqual(result, {kind: 'ok', keysRestored: 2});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), '{"projects":["a"]}');
    // the backup holds no layout key, so it is layout 1: restoring it migrates it
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), '{"entries":["d1"]}');
  });

  const onlyProjects = JSON.stringify({
    openisdBackup: true, schemaVersion: 1, exportedAt: '20260101T000000Z',
    data: {[OPENISD_PROJECTS_KEY]: '{"projects":["restored"]}'},
  });

  it('a restore KEEPS a key the file lacks', () => {
    const {storage, repo} = repoOn(createMemoryStorage({
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["a driver the file lacks"]}',
    }));

    const result = repo.importAll(onlyProjects, KEEP);

    assert.deepEqual(result, {kind: 'ok', keysRestored: 1});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), '{"projects":["restored"]}');
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), '{"schema":1,"entries":["a driver the file lacks"]}');
  });

  it('"replace everything" removes a key the file lacks', () => {
    const {storage, repo} = repoOn(createMemoryStorage({
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["stale, pre-backup driver"]}',
    }));

    const result = repo.importAll(onlyProjects, REPLACE);

    assert.deepEqual(result, {kind: 'ok', keysRestored: 1});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), '{"projects":["restored"]}');
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), null);
  });

  it('either way, the store as it was is backed up before anything changes', () => {
    const {storage, repo} = repoOn(createMemoryStorage({
      [OPENISD_MY_DRIVERS_KEY]: '{"schema":1,"entries":["mine"]}',
    }));
    repo.importAll(onlyProjects, REPLACE);

    const kept = storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));
    assert.equal(kept.length, 1);
    const read = readEnvelope(storage.get(kept[0]) ?? '');
    assert.ok(read.kind === 'ok');
    assert.equal(read.snapshot.data[OPENISD_MY_DRIVERS_KEY], '{"schema":1,"entries":["mine"]}');
  });

  it('refuses a file from a newer layout and changes nothing', () => {
    const {storage, repo} = repoOn(createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'untouched'}));
    const newer = JSON.stringify({openisdBackup: true, layout: STORAGE_LAYOUT + 1, data: {[OPENISD_PROJECTS_KEY]: 'from the future'}});
    const result = repo.importAll(newer, REPLACE);
    assert.equal(result.kind, 'invalid');
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'untouched');
  });

  it('ignores keys in a file that are not store data (a backup or the log smuggled in)', () => {
    const {storage, repo} = repoOn();
    const file = JSON.stringify({openisdBackup: true, data: {
      [OPENISD_PROJECTS_KEY]: 'p', [`${OPENISD_BACKUP_PREFIX}vX`]: 'smuggled', openisd_storage_log: 'smuggled', other: 'foreign',
    }});
    assert.deepEqual(repo.importAll(file, KEEP), {kind: 'ok', keysRestored: 1});
    assert.deepEqual(storage.keys().sort(), [OPENISD_PROJECTS_KEY]);
  });

  it('refuses a non-JSON file and changes nothing', () => {
    const {storage, repo} = repoOn(createMemoryStorage({[OPENISD_PROJECTS_KEY]: '{"projects":["untouched"]}'}));
    const result = repo.importAll('not json at all', REPLACE);
    assert.equal(result.kind, 'invalid');
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), '{"projects":["untouched"]}');
  });

  it('refuses a JSON file that is not an OpenISD backup envelope and changes nothing', () => {
    const {storage, repo} = repoOn(createMemoryStorage({[OPENISD_PROJECTS_KEY]: '{"projects":["untouched"]}'}));
    const result = repo.importAll(JSON.stringify({some: 'other json file'}), REPLACE);
    assert.equal(result.kind, 'invalid');
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), '{"projects":["untouched"]}');
  });
});
