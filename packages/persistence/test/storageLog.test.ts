/**
 * `createStorageLog` — what the store held at each start, so a key that was there and is gone is
 * seen and said (T058). John lost every saved driver at localhost:4000 and nothing recorded it.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createStorageLog, MAX_LOG_ENTRIES, type LogEntry} from '../src/repos/storageLog.js';
import {OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY, OPENISD_STORAGE_LOG_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';

const T1 = Date.UTC(2026, 9, 12, 20, 0, 0);
const T2 = Date.UTC(2026, 9, 12, 21, 30, 5);

function entriesOf(storage: ReturnType<typeof createMemoryStorage>): LogEntry[] {
  const parsed: unknown = JSON.parse(storage.get(OPENISD_STORAGE_LOG_KEY) ?? '{}');
  assert.ok(typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries));
  const held: unknown[] = parsed.entries;
  const entries: LogEntry[] = [];
  for (const entry of held) {
    assert.ok(typeof entry === 'object' && entry !== null && 'at' in entry && typeof entry.at === 'string' && 'keys' in entry);
    const keys: unknown = entry.keys;
    assert.ok(typeof keys === 'object' && keys !== null);
    entries.push({at: entry.at, keys: Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, typeof v === 'number' ? v : null]))});
  }
  return entries;
}

describe('recordStart', () => {
  it('writes one entry: an ISO 8601 basic time, each key present with its length, owned keys absent as null', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'twelve chars', [OPENISD_PROJECTS_KEY]: 'abc'});
    const lost = createStorageLog(storage, () => T1).recordStart();

    assert.deepEqual(lost, []);
    const [entry] = entriesOf(storage);
    assert.equal(entry.at, '20261012T200000Z');
    assert.equal(entry.keys[OPENISD_MY_DRIVERS_KEY], 12);
    assert.equal(entry.keys[OPENISD_PROJECTS_KEY], 3);
    assert.equal(entry.keys[OPENISD_STATE_KEY], null, 'a key the app owns and the store lacks is recorded as absent');
    assert.ok(!(OPENISD_STORAGE_LOG_KEY in entry.keys), 'the log does not list itself');
  });

  it('says nothing the first time, and when every key is still there', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers'});
    assert.deepEqual(createStorageLog(storage, () => T1).recordStart(), []);
    assert.deepEqual(createStorageLog(storage, () => T2).recordStart(), []);
  });

  it('a key in the previous entry and gone now is lost, with the time it was last seen', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers', [OPENISD_STATE_KEY]: 'state'});
    createStorageLog(storage, () => T1).recordStart();
    storage.remove(OPENISD_MY_DRIVERS_KEY); // the browser, not the app
    storage.remove(OPENISD_STATE_KEY);

    const lost = createStorageLog(storage, () => T2).recordStart();

    assert.deepEqual(lost, [
      {key: OPENISD_MY_DRIVERS_KEY, what: 'Saved drivers', plural: true, lastSeenAt: '20261012T200000Z'},
      {key: OPENISD_STATE_KEY, what: 'The autosaved project', plural: false, lastSeenAt: '20261012T200000Z'},
    ]);
  });

  it('a loss is said once: the start after it sees the key absent both times', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers'});
    createStorageLog(storage, () => T1).recordStart();
    storage.remove(OPENISD_MY_DRIVERS_KEY);
    createStorageLog(storage, () => T2).recordStart();
    assert.deepEqual(createStorageLog(storage, () => T2).recordStart(), []);
  });

  it(`keeps the last ${MAX_LOG_ENTRIES} entries`, () => {
    const storage = createMemoryStorage();
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) createStorageLog(storage, () => T1 + i * 1000).recordStart();
    const entries = entriesOf(storage);
    assert.equal(entries.length, MAX_LOG_ENTRIES);
    assert.equal(entries[0].at, '20261012T200005Z', 'the five oldest went');
  });

  it('an unreadable log is started afresh', () => {
    const storage = createMemoryStorage({[OPENISD_STORAGE_LOG_KEY]: '{not json'});
    assert.deepEqual(createStorageLog(storage, () => T1).recordStart(), []);
    assert.equal(entriesOf(storage).length, 1);
  });
});

describe('observe', () => {
  it('a key the app removes itself is not lost at the next start', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers'});
    const log = createStorageLog(storage, () => T1);
    log.recordStart();
    log.observe(storage).remove(OPENISD_MY_DRIVERS_KEY);

    assert.deepEqual(createStorageLog(storage, () => T2).recordStart(), []);
  });

  it('a key the app first wrote this session is lost if it then vanishes behind the app', () => {
    const storage = createMemoryStorage();
    const log = createStorageLog(storage, () => T1);
    log.recordStart();
    log.observe(storage).set(OPENISD_MY_DRIVERS_KEY, 'first saved driver');
    storage.remove(OPENISD_MY_DRIVERS_KEY);

    const lost = createStorageLog(storage, () => T2).recordStart();
    assert.deepEqual(lost.map(l => l.key), [OPENISD_MY_DRIVERS_KEY]);
  });

  it('passes reads, writes and key listing through to the storage', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'p'});
    const log = createStorageLog(storage, () => T1);
    log.recordStart();
    const observed = log.observe(storage);
    observed.set(OPENISD_STATE_KEY, 's');
    assert.equal(storage.get(OPENISD_STATE_KEY), 's');
    assert.equal(observed.get(OPENISD_PROJECTS_KEY), 'p');
    assert.ok(observed.keys().includes(OPENISD_STATE_KEY));
  });
});

describe('exportText', () => {
  it('is the log, as JSON the user can keep', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'd'});
    const log = createStorageLog(storage, () => T1);
    log.recordStart();
    const parsed: unknown = JSON.parse(log.exportText());
    assert.ok(typeof parsed === 'object' && parsed !== null && 'entries' in parsed && Array.isArray(parsed.entries));
    assert.equal(parsed.entries.length, 1);
  });
});
