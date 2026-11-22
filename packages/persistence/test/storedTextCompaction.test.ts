/**
 * `createStoredTextCompaction` — rewrites the project texts browser storage holds as one compact
 * line without `dq_calculated`, behind the whole-store backup, and only when a text would change.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compactedStoredText} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {createStoredTextCompaction} from '../src/repos/storedTextCompaction.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';
import {backupOn, projectRepoOn} from './fixtures/repoOn.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {readEnvelope} from '../src/repos/storageSnapshot.js';

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
    const held = readEnvelope(storage.get(keys[0] ?? '') ?? '');
    assert.ok(held.kind === 'ok' && held.snapshot.data[OPENISD_PROJECTS_KEY] === entries(pretty), 'the backup holds the projects as they were');
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

  it('writes schemaVersion into a stored project that has none, and then has nothing to do (QO395)', () => {
    const saved = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'design', 'test', 'fixtures', 'air-migration', 'saved-by-t375-sample_project_vented.owpr'), 'utf8');
    const storage = createMemoryStorage({[OPENISD_STATE_KEY]: JSON.stringify({id: 'p1', ...JSON.parse(saved)})});
    const compaction = createStoredTextCompaction(storage, backupOn(storage), () => undefined);
    assert.equal(compaction.run().kind, 'rewritten');
    assert.match(storage.get(OPENISD_STATE_KEY) ?? '', /"schemaVersion":6,/);
    assert.deepEqual(compaction.run(), {kind: 'nothingToDo'});
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

// --- a store of version-3 projects, upgraded behind its (compressed) whole-store backup (T827, QO940.c4) ---

const LIMIT = 5 * 1024 * 1024;

/** The `entries` of a stored bucket: each with its id and project text. */
function entriesIn(bucket: string): {id: string; text: string}[] {
  const parsed: unknown = JSON.parse(bucket);
  if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed) || !Array.isArray(parsed.entries)) throw new Error('not a bucket');
  return parsed.entries.map((e: unknown) => {
    if (typeof e !== 'object' || e === null || !('id' in e) || typeof e.id !== 'string' || !('text' in e) || typeof e.text !== 'string') throw new Error('not an entry');
    return {id: e.id, text: e.text};
  });
}
/** Real saved projects at schemaVersion 3 (single-coil, dual-coil with the wiring defaulted, dual-coil with it entered). */
const v3 = entriesIn(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stored-v3-projects.json'), 'utf8'));
const usedBy = (storage: ListableStorage) => storage.keys().reduce((n, k) => n + k.length + (storage.get(k) ?? '').length, 0);
const idOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const noFiles: FileStorage = {
  save: () => { throw new Error('no file'); }, saveAs: () => { throw new Error('no file'); }, openFileName: () => null, forget: () => { throw new Error('no file'); },
};

/** A projects bucket of version-3 texts under new ids, `fraction` of LIMIT. */
function bucketAt(fraction: number): {bucket: string; list: {id: string; text: string}[]} {
  const list: {id: string; text: string}[] = [];
  let bucket = '';
  do {
    const base = v3[list.length % v3.length];
    const id = idOf(list.length);
    list.push({id, text: base.text.split(base.id).join(id)});
    bucket = JSON.stringify({entries: list.map(e => ({id: e.id, text: e.text, modified: '2026-01-01T00:00:00.000Z'}))});
  } while (OPENISD_PROJECTS_KEY.length + bucket.length < fraction * LIMIT);
  return {bucket, list};
}

describe.each([0.4, 0.46, 0.6])('a store of version-3 projects at %s of capacity', fraction => {
  const {bucket, list} = bucketAt(fraction);

  it('is upgraded behind a whole-store backup, with the store still well under the nearly-full line', () => {
    const storage = createQuotaStorage(LIMIT, {[OPENISD_PROJECTS_KEY]: bucket});
    const outcome = createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();

    assert.equal(outcome.kind, 'rewritten');
    const after = entriesIn(storage.get(OPENISD_PROJECTS_KEY) ?? '');
    assert.deepEqual(after.map(e => e.id), list.map(e => e.id));
    for (const [i, entry] of after.entries()) {
      assert.match(entry.text, /"schemaVersion":6,/, entry.id);
      assert.equal(entry.text, compactedStoredText(list[i].text), entry.id);
    }
    const keys = backupKeys(storage);
    assert.equal(keys.length, 1, 'the whole-store backup is there');
    const held = readEnvelope(storage.get(keys[0] ?? '') ?? '');
    assert.ok(held.kind === 'ok' && held.snapshot.data[OPENISD_PROJECTS_KEY] === bucket, 'and holds the store as it was');
    assert.ok(usedBy(storage) < 0.8 * LIMIT, `used ${(100 * usedBy(storage) / LIMIT).toFixed(1)}%`);
  });

  it('gives each project the same figures as reading its version-3 text in memory', () => {
    const storage = createQuotaStorage(LIMIT, {[OPENISD_PROJECTS_KEY]: bucket});
    const engine = createEngine();
    const read = (id: string) => {
      const project = projectRepoOn(engine, noFiles, storage, 'http://localhost').loadStoredProject(id);
      assert.ok(!Array.isArray(project), id);
      return project.toOwprText();
    };
    const sample = [list[0], list[1], list[2], list[list.length - 1]];
    const expected = sample.map(e => read(e.id));
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.deepEqual(sample.map(e => read(e.id)), expected);
  });
});

describe('a store whose backup cannot fit even compressed', () => {
  it('is refused, and the projects stay as saved', () => {
    const {bucket} = bucketAt(0.05);
    const storage = createQuotaStorage(usedBy(createMemoryStorage({[OPENISD_PROJECTS_KEY]: bucket})) + 50, {[OPENISD_PROJECTS_KEY]: bucket});
    assert.deepEqual(createStoredTextCompaction(storage, backupOn(storage), () => undefined).run(), {kind: 'refused'});
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), bucket);
  });
});
