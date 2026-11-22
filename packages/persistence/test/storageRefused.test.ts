/**
 * Refused copies: a project that would not load is kept whole under `openisd_refused_<stamp>`,
 * outside whole-store backups, dropped only by an explicit discard.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OPENISD_BACKUP_PREFIX, OPENISD_REFUSED_PREFIX} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {isStoreDataKey} from '../src/repos/storageSnapshot.js';
import {backupOn} from './fixtures/repoOn.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';

const STAMP = '20260101T010203Z';

describe('refuse', () => {
  it('keeps the text verbatim under a stamped key and lists it', () => {
    const storage = createMemoryStorage({});
    const backup = backupOn(storage);
    assert.equal(backup.refuse('wouldNotLoad', 'Box A', '{"half":'), true);
    const [copy] = backup.refusedCopies();
    assert.equal(copy.key, `${OPENISD_REFUSED_PREFIX}${STAMP}`);
    assert.deepEqual({at: copy.at, reason: copy.reason, name: copy.name}, {at: STAMP, reason: 'wouldNotLoad', name: 'Box A'});
    assert.equal(backup.readRefused(copy.key)?.text, '{"half":');
  });

  it('numbers a second copy taken in the same second', () => {
    const backup = backupOn(createMemoryStorage({}));
    backup.refuse('wouldNotLoad', 'A', 'one');
    backup.refuse('wouldNotLoad', 'B', 'two');
    assert.deepEqual(backup.refusedCopies().map(c => c.key).sort(), [
      `${OPENISD_REFUSED_PREFIX}${STAMP}`, `${OPENISD_REFUSED_PREFIX}${STAMP}_01`,
    ]);
  });

  it('keeps one copy of the same text however often it is refused', () => {
    const backup = backupOn(createMemoryStorage({}));
    backup.refuse('wouldNotLoad', 'A', 'same');
    backup.refuse('wouldNotLoad', 'A', 'same');
    assert.equal(backup.refusedCopies().length, 1);
  });

  it('is not part of a whole-store backup', () => {
    const storage = createMemoryStorage({});
    backupOn(storage).refuse('wouldNotLoad', 'A', 'x');
    assert.equal(isStoreDataKey(`${OPENISD_REFUSED_PREFIX}${STAMP}`), false);
  });

  it('makes room by dropping whole-store backups, never another refused copy', () => {
    const storage = createQuotaStorage(330);
    const backup = backupOn(storage);
    storage.set(`${OPENISD_BACKUP_PREFIX}old`, 'x'.repeat(150));
    assert.equal(backup.refuse('wouldNotLoad', 'A', 'y'.repeat(100)), true);
    assert.equal(storage.get(`${OPENISD_BACKUP_PREFIX}old`), null);
    assert.equal(backup.refuse('wouldNotLoad', 'B', 'z'.repeat(1000)), false);
    assert.equal(backup.refusedCopies().length, 1);
  });
});

describe('readRefused, discardRefused', () => {
  it('reads nothing from a key that is not a refused copy', () => {
    const storage = createMemoryStorage({other: '{}'});
    assert.equal(backupOn(storage).readRefused('other'), null);
  });

  it('lists a damaged refused copy as unreadable text, and still discards it', () => {
    const key = `${OPENISD_REFUSED_PREFIX}bad`;
    const storage = createMemoryStorage({[key]: 'not json'});
    const backup = backupOn(storage);
    assert.deepEqual(backup.refusedCopies().map(c => c.key), [key]);
    assert.equal(backup.discardRefused(key), true);
    assert.equal(storage.get(key), null);
  });

  it('refuses to discard anything that is not a refused copy', () => {
    const storage = createMemoryStorage({openisd_projects: '{}'});
    assert.equal(backupOn(storage).discardRefused('openisd_projects'), false);
    assert.equal(storage.get('openisd_projects'), '{}');
  });
});
