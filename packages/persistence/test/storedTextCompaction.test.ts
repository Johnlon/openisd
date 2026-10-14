/**
 * `createStoredTextCompaction` — rewrites the project texts browser storage holds as one compact
 * line without `dq_calculated`, behind the whole-store backup, and only when a text would change.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createStoredTextCompaction} from '../src/repos/storedTextCompaction.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';
import {backupOn} from './fixtures/repoOn.js';

const session = {label: 'p', saved: {spec: {Fs: {value: 45, dq_calculated: [{rule: 'x'}]}}}, edited: null};
const pretty = JSON.stringify(session, null, 2);
const compact = JSON.stringify({label: 'p', saved: {spec: {Fs: {value: 45}}}, edited: null});
const entries = (text: string) => JSON.stringify({entries: [{id: 'a', text, modified: '2026-01-01T00:00:00.000Z'}], focusedId: 'a'});
const backupKeys = (storage: ReturnType<typeof createMemoryStorage>) => storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));

describe('run', () => {
  it('rewrites every project text key as a compact line without dq_calculated, and keeps the rest of each record', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: entries(pretty), [OPENISD_OPEN_SESSIONS_KEY]: entries(pretty),
      [OPENISD_QUARANTINE_SESSION_KEY]: entries(pretty), [OPENISD_STATE_KEY]: pretty,
    });
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.equal(outcome.kind, 'rewritten');
    assert.equal(storage.get(OPENISD_STATE_KEY), compact);
    for (const key of [OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY]) {
      assert.equal(storage.get(key), entries(compact), key);
    }
  });

  it('takes one whole-store backup first, holding the texts as they were', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: entries(pretty), [OPENISD_STATE_KEY]: pretty});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    const keys = backupKeys(storage);
    assert.equal(keys.length, 1);
    assert.ok((storage.get(keys[0] ?? '') ?? '').includes(JSON.stringify(entries(pretty)).slice(1, 40)));
  });

  it('reports the characters before and after', () => {
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: pretty});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(outcome, {kind: 'rewritten', charsBefore: pretty.length, charsAfter: compact.length});
  });

  it('does nothing, and takes no backup, when every text is already compact', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: entries(compact), [OPENISD_STATE_KEY]: compact});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.deepEqual(outcome, {kind: 'nothingToDo'});
    assert.equal(backupKeys(storage).length, 0);
  });

  it('does nothing on an empty store', () => {
    const storage = createMemoryStorage({});
    assert.deepEqual(createStoredTextCompaction(storage, backupOn(storage), () => undefined).run(), {kind: 'nothingToDo'});
  });

  it('leaves a text that is not a project, and a key it does not own, exactly as it is', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'not json', [OPENISD_STATE_KEY]: '{"x": 1}', [OPENISD_MY_DRIVERS_KEY]: entries(pretty),
    });
    assert.deepEqual(createStoredTextCompaction(storage, backupOn(storage), () => undefined).run(), {kind: 'nothingToDo'});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'not json');
    assert.equal(storage.get(OPENISD_STATE_KEY), '{"x": 1}');
    assert.equal(storage.get(OPENISD_MY_DRIVERS_KEY), entries(pretty));
  });

  it('rewrites the readable texts of a record and keeps an entry it cannot read', () => {
    const mixed = JSON.stringify({entries: [{id: 'a', text: pretty}, {id: 'b', text: 'garbage'}]});
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: mixed});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), JSON.stringify({entries: [{id: 'a', text: compact}, {id: 'b', text: 'garbage'}]}));
  });

  it('is refused, and writes nothing, when the backup does not fit', () => {
    const initial = {[OPENISD_PROJECTS_KEY]: entries(pretty), [OPENISD_STATE_KEY]: pretty};
    const used = Object.entries(initial).reduce((n, [k, v]) => n + k.length + v.length, 0);
    const storage = createQuotaStorage(used + 10, initial);
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.deepEqual(outcome, {kind: 'refused'});
    assert.equal(storage.get(OPENISD_STATE_KEY), pretty);
  });

  it('a second run finds nothing to do', () => {
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: pretty});
    const compaction = createStoredTextCompaction(storage, backupOn(storage), () => undefined);
    compaction.run();
    assert.deepEqual(compaction.run(), {kind: 'nothingToDo'});
  });
});
