/**
 * `createStorageBackup` — the ONE whole-store backup (T058). It copies every data key to
 * `openisd_backup_<build stamp of the app that wrote the store>`, keeps ten, never drops the
 * newest backup of a layout, measures by writing, and refuses a destructive write it cannot back up.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createStorageBackup, MAX_BACKUPS} from '../src/repos/storageBackup.js';
import {envelopeText, readEnvelope} from '../src/repos/storageSnapshot.js';
import {
  OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY,
  OPENISD_STORAGE_LAYOUT_KEY, OPENISD_STORAGE_LOG_KEY,
} from '../src/repos/storageKeys.js';
import {BuildStamp} from '../src/repos/buildStamp.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {FIXED_NOW_MS} from './fixtures/repoOn.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';

const keyOf = (stamp: string) => `${OPENISD_BACKUP_PREFIX}${stamp}`;
/** The key a take at FIXED_NOW_MS leaves for a store written by `stamp`. */
const takenKey = (stamp: string) => `${keyOf(stamp)}_20260101T010203Z`;

/** A stored backup envelope, as an earlier take would have left it. */
function backupText(layout: number, takenAt: string, stamp: string, data: Record<string, string> = {a: 'b'}): string {
  return envelopeText({layout, build: BuildStamp.ofStored(stamp), exportedAt: takenAt, data}, false);
}

describe('take', () => {
  it('copies every data key to a key named for the build that wrote the store', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'projects', [OPENISD_MY_DRIVERS_KEY]: 'drivers',
      [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: 'v20251231T2359Z',
      [OPENISD_STORAGE_LOG_KEY]: 'a log',
    });
    const result = createStorageBackup(storage, () => FIXED_NOW_MS).take();

    assert.deepEqual(result, {kind: 'taken', key: takenKey('v20251231T2359Z')});
    const read = readEnvelope(storage.get(takenKey('v20251231T2359Z')) ?? '');
    assert.ok(read.kind === 'ok');
    assert.deepEqual(read.snapshot.data, {[OPENISD_PROJECTS_KEY]: 'projects', [OPENISD_MY_DRIVERS_KEY]: 'drivers'});
    assert.equal(read.snapshot.layout, 1);
    assert.equal(read.snapshot.build.text, 'v20251231T2359Z');
    assert.equal(read.snapshot.exportedAt, '20260101T010203Z');
  });

  it('a store written before stamps existed is named for an unknown build', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'projects'});
    assert.deepEqual(createStorageBackup(storage, () => FIXED_NOW_MS).take(), {kind: 'taken', key: takenKey('vunknown')});
  });

  it('two backups of a store written by one build, taken at different seconds, are both kept', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'first', [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: 'v20251231T2359Z',
    });
    let now = FIXED_NOW_MS;
    const backup = createStorageBackup(storage, () => now);
    backup.take();
    storage.set(OPENISD_PROJECTS_KEY, 'second');
    now += 1000;
    backup.take();

    const held = storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX)).sort();
    assert.deepEqual(held, [takenKey('v20251231T2359Z'), `${keyOf('v20251231T2359Z')}_20260101T010204Z`]);
    const first = readEnvelope(storage.get(held[0]) ?? '');
    assert.ok(first.kind === 'ok');
    assert.equal(first.snapshot.data[OPENISD_PROJECTS_KEY], 'first', 'the earlier backup was not overwritten');
  });

  it('two backups from one build in the same second get a two-digit counter, and neither is lost', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'first', [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: 'v20251231T2359Z'});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
    assert.deepEqual(backup.take(), {kind: 'taken', key: takenKey('v20251231T2359Z')});
    storage.set(OPENISD_PROJECTS_KEY, 'second');
    assert.deepEqual(backup.take(), {kind: 'taken', key: `${takenKey('v20251231T2359Z')}_01`});
    const first = readEnvelope(storage.get(takenKey('v20251231T2359Z')) ?? '');
    assert.ok(first.kind === 'ok');
    assert.equal(first.snapshot.data[OPENISD_PROJECTS_KEY], 'first');
  });

  it('a store with no data has nothing to back up, and writes nothing', () => {
    const storage = createMemoryStorage({[OPENISD_STORAGE_LOG_KEY]: 'only a log'});
    assert.deepEqual(createStorageBackup(storage, () => FIXED_NOW_MS).take(), {kind: 'nothingToBackUp'});
    assert.deepEqual(storage.keys(), [OPENISD_STORAGE_LOG_KEY]);
  });

  it('a backup never holds another backup', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'p', [keyOf('vold')]: backupText(1, '20250101T000000Z', 'vold')});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
    backup.take();
    const read = readEnvelope(storage.get(takenKey('vunknown')) ?? '');
    assert.ok(read.kind === 'ok');
    assert.deepEqual(Object.keys(read.snapshot.data), [OPENISD_PROJECTS_KEY]);
  });
});

describe('retention', () => {
  it(`keeps ${MAX_BACKUPS}, dropping the oldest`, () => {
    const initial: Record<string, string> = {[OPENISD_PROJECTS_KEY]: 'p'};
    for (let i = 0; i < MAX_BACKUPS; i++) {
      const stamp = `v2025010${i}T0000Z`;
      initial[keyOf(stamp)] = backupText(1, `2025010${i}T000000Z`, stamp);
    }
    const storage = createMemoryStorage(initial);
    createStorageBackup(storage, () => FIXED_NOW_MS).take();

    const held = storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));
    assert.equal(held.length, MAX_BACKUPS);
    assert.ok(!held.includes(keyOf('v20250100T0000Z')), 'the oldest went');
    assert.ok(held.includes(takenKey('vunknown')), 'the new one is held');
  });

  it('never drops the newest backup of a layout, however old', () => {
    const initial: Record<string, string> = {[OPENISD_PROJECTS_KEY]: 'p', [OPENISD_STORAGE_LAYOUT_KEY]: '2'};
    // The only layout-1 backup is the OLDEST of all; nine layout-2 backups follow it.
    initial[keyOf('v20240101T0000Z')] = backupText(1, '20240101T000000Z', 'v20240101T0000Z');
    for (let i = 1; i <= 9; i++) {
      const stamp = `v2025010${i}T0000Z`;
      initial[keyOf(stamp)] = backupText(2, `2025010${i}T000000Z`, stamp);
    }
    const storage = createMemoryStorage(initial);
    createStorageBackup(storage, () => FIXED_NOW_MS).take();

    const held = storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));
    assert.equal(held.length, MAX_BACKUPS);
    assert.ok(held.includes(keyOf('v20240101T0000Z')), 'the only layout-1 backup stays');
    assert.ok(!held.includes(keyOf('v20250101T0000Z')), 'the oldest layout-2 backup went instead');
  });

  it('lists newest first with layout, build and time', () => {
    const storage = createMemoryStorage({
      [keyOf('v1')]: backupText(1, '20250101T000000Z', 'v20250101T0000Z'),
      [keyOf('v2')]: backupText(2, '20250202T000000Z', 'v20250202T0000Z'),
    });
    const listed = createStorageBackup(storage, () => FIXED_NOW_MS).list();
    assert.deepEqual(listed.map(i => [i.key, i.layout, i.takenAt]), [
      [keyOf('v2'), 2, '20250202T000000Z'], [keyOf('v1'), 1, '20250101T000000Z'],
    ]);
  });
});

describe('space', () => {
  const data = 'x'.repeat(400);

  it('drops the oldest backups until the copy fits', () => {
    const old = backupText(1, '20250101T000000Z', 'v20250101T0000Z', {k: data});
    const newer = backupText(1, '20250202T000000Z', 'v20250202T0000Z', {k: data});
    const storage = createQuotaStorage(1800, {[OPENISD_PROJECTS_KEY]: data, [keyOf('v20250101T0000Z')]: old, [keyOf('v20250202T0000Z')]: newer});
    // Layout 1's newest is v2025-02-02; the January one is droppable.
    const result = createStorageBackup(storage, () => FIXED_NOW_MS).take();
    assert.equal(result.kind, 'taken');
    assert.equal(storage.get(keyOf('v20250101T0000Z')), null, 'the oldest went to make room');
    assert.notEqual(storage.get(keyOf('v20250202T0000Z')), null, 'the newest of the layout stayed');
  });

  it('a data write that does not fit drops the oldest backups until it does, keeping the newest', () => {
    const old = backupText(1, '20250101T000000Z', 'v20250101T0000Z', {k: data});
    const newer = backupText(1, '20250202T000000Z', 'v20250202T0000Z', {k: data});
    const storage = createQuotaStorage(1800, {[OPENISD_PROJECTS_KEY]: data, [keyOf('v20250101T0000Z')]: old, [keyOf('v20250202T0000Z')]: newer});
    const bigger = 'y'.repeat(900);

    const ok = createStorageBackup(storage, () => FIXED_NOW_MS).write(OPENISD_PROJECTS_KEY, bigger);

    assert.equal(ok, true);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), bigger, 'the save landed');
    assert.equal(storage.get(keyOf('v20250101T0000Z')), null, 'the oldest backup went to make room');
    assert.notEqual(storage.get(keyOf('v20250202T0000Z')), null, 'the newest of the layout stayed');
  });

  it('a data write that cannot fit even then is false and leaves the key as it was', () => {
    const storage = createQuotaStorage(600, {[OPENISD_PROJECTS_KEY]: data});
    const ok = createStorageBackup(storage, () => FIXED_NOW_MS).write(OPENISD_PROJECTS_KEY, 'z'.repeat(700));
    assert.equal(ok, false);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), data);
  });

  it('when it cannot fit even then, says so, writes nothing and refuses the destructive write', () => {
    const storage = createQuotaStorage(600, {[OPENISD_PROJECTS_KEY]: data});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
    let ran = false;

    assert.deepEqual(backup.take(), {kind: 'noRoom'});
    const guarded = backup.guard(() => { ran = true; });

    assert.deepEqual(guarded, {kind: 'refused'});
    assert.equal(ran, false);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), data, 'the data is untouched');
  });
});

describe('guard', () => {
  it('backs the store up, then runs the write, and hands back its value', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'before'});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);

    const guarded = backup.guard(() => {
      const read = readEnvelope(storage.get(takenKey('vunknown')) ?? '');
      assert.ok(read.kind === 'ok', 'the backup exists by the time the write runs');
      assert.equal(read.snapshot.data[OPENISD_PROJECTS_KEY], 'before');
      storage.set(OPENISD_PROJECTS_KEY, 'after');
      return 42;
    });

    assert.deepEqual(guarded, {kind: 'ran', value: 42});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'after');
  });

  it('runs the write on a store with nothing in it', () => {
    const storage = createMemoryStorage();
    assert.deepEqual(createStorageBackup(storage, () => FIXED_NOW_MS).guard(() => 'fresh'), {kind: 'ran', value: 'fresh'});
  });
});

describe('discard', () => {
  it('deletes a backup, and only a backup', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'p', [keyOf('v1')]: backupText(1, '20250101T000000Z', 'v20250101T0000Z')});
    const backup = createStorageBackup(storage, () => FIXED_NOW_MS);
    assert.equal(backup.discard(OPENISD_PROJECTS_KEY), false);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'p');
    assert.equal(backup.discard(keyOf('v1')), true);
    assert.equal(storage.get(keyOf('v1')), null);
    assert.equal(backup.discard(keyOf('v1')), false);
  });
});
