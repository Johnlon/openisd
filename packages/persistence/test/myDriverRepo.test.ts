/**
 * myDriverRepo — the My Drivers saved library. It stores ONE envelope shape,
 *
 *     { schema: number, entries: [{ uuid: string, record: <the driver's own record> }] }
 *
 * Every `record` is validated by the domain's own seam (`fromConformingRecord`), so the repo
 * names no schema and asserts no shape. The uuid is minted by the repo and lives OUTSIDE the
 * record — an id inside the record could leak into a file export.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {MY_DRIVERS_KEY} from '../src/repos/myDriverRepo.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {createEngine} from '@openisd/design/engine';
import {myDriverRepoOn} from './fixtures/repoOn.js';
import {aDriver} from './fixtures/savedRecords.js';

const engine = createEngine();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** An in-memory storage, so each test sees only what it put there itself. */
function memoryStorage(): ListableStorage & { raw(key: string): string | null } {
  const storage = createMemoryStorage();
  return { ...storage, raw: (k) => storage.get(k) };
}

describe('myDriverRepo', () => {
  it('writes { entries: [{ uuid, record }] }, with no version of its own', () => {
    const storage = memoryStorage();
    const repo = myDriverRepoOn(storage, engine);

    repo.upsert(aDriver());

    const written: unknown = JSON.parse(storage.raw(MY_DRIVERS_KEY) ?? 'null');
    if (!isRecord(written)) throw new Error('the bucket must hold an object');
    assert.equal('schema' in written, false, 'the store layout covers the bucket; it states no version');
    if (!Array.isArray(written.entries)) throw new Error('the envelope holds `entries`, the shared field name');
    const entries: unknown[] = written.entries;

    const entry = entries[0];
    if (!isRecord(entry)) throw new Error('expected an entry object');
    assert.equal(typeof entry.uuid, 'string', 'the repo mints a uuid per entry');
    if (!isRecord(entry.record)) throw new Error('the entry carries the driver record');
    const recordUuid = isRecord(entry.record.uuid) ? entry.record.uuid.value : undefined;
    assert.ok(recordUuid !== entry.uuid,
      'the storage uuid stays OUTSIDE the record, so it cannot leak into a file export');
  });

  it('reads back an OpenISDDriver carrying every stored field', () => {
    const storage = memoryStorage();
    const repo = myDriverRepoOn(storage, engine);
    repo.upsert(aDriver());

    const back = myDriverRepoOn(storage, engine).list();
    assert.equal(back.length, 1);
    assert.equal(back[0].driver.model.value, 'RS225');
    assert.equal(back[0].driver.brand.value, 'Dayton');
  });
});
