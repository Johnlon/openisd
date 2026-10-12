/**
 * myPassiveRadiatorRepo — the My Passive Radiators saved library. It stores the same envelope
 * as My Drivers, `{ schema, entries: [{ uuid, record }] }`, where each `record` is a passive
 * radiator record validated by the domain's own seam (`fromConformingRecord`).
 *
 * bugs/archive/BUG_20260909_the_my_passive_radiators_library_stores_five_loose_numbers_instead_of_a_radiator_record.md
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {MY_PASSIVE_RADIATORS_KEY} from '../src/repos/myPassiveRadiatorRepo.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {myPassiveRadiatorRepoOn} from './fixtures/repoOn.js';
import {aRadiator} from './fixtures/savedRecords.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** An in-memory storage, so each test sees only what it put there itself. */
function memoryStorage(): ListableStorage & { raw(key: string): string | null } {
  const storage = createMemoryStorage();
  return { ...storage, raw: (k) => storage.get(k) };
}

describe('myPassiveRadiatorRepo', () => {
  it('writes the same envelope shape as My Drivers', () => {
    const storage = memoryStorage();
    const repo = myPassiveRadiatorRepoOn(storage);

    repo.upsert(aRadiator());

    const written: unknown = JSON.parse(storage.raw(MY_PASSIVE_RADIATORS_KEY) ?? 'null');
    if (!isRecord(written)) throw new Error('the bucket must hold an object');
    assert.equal(typeof written.schema, 'number', 'the envelope states its schema version');
    if (!Array.isArray(written.entries)) throw new Error('the envelope holds `entries`, same field name as My Drivers');
    const entries: unknown[] = written.entries;

    const entry = entries[0];
    if (!isRecord(entry)) throw new Error('expected an entry object');
    assert.equal(typeof entry.uuid, 'string', 'a uuid, not a Date.now() id');
    assert.ok(isRecord(entry.record), 'the entry carries the RADIATOR RECORD, not five loose numbers');
  });

  it('reads back a radiator, not a five-number row', () => {
    const storage = memoryStorage();
    const repo = myPassiveRadiatorRepoOn(storage);
    repo.upsert(aRadiator());

    const back = myPassiveRadiatorRepoOn(storage).list();
    assert.equal(back.length, 1);
    // The whole point: brand and model survive a save, which the five-number row discarded.
    assert.equal(back[0].passiveRadiator.model.value, 'DSA175-PR');
    assert.equal(back[0].passiveRadiator.brand.value, 'Dayton');
  });

  it('a saved radiator keeps its uuid across a read, so a row can be deleted by identity', () => {
    const storage = memoryStorage();
    const saved = myPassiveRadiatorRepoOn(storage).upsert(aRadiator());
    assert.ok(saved, 'the fixture storage is writable, so the save must succeed');

    const repo = myPassiveRadiatorRepoOn(storage);
    const listed = repo.list();
    assert.ok(saved);
    assert.equal(listed[0].uuid, saved.uuid, 'the uuid is adopted on read, never re-minted');

    repo.remove(saved.uuid);
    assert.equal(myPassiveRadiatorRepoOn(storage).list().length, 0);
  });
});
