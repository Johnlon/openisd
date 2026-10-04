/**
 * myPassiveRadiatorRepo — the My Passive Radiators saved library. It stores the same envelope
 * as My Drivers, `{ schema, entries: [{ uuid, record }] }`, where each `record` is a passive
 * radiator record validated by the domain's own seam (`fromConformingRecord`).
 *
 * bugs/archive/BUG_20260909_the_my_passive_radiators_library_stores_five_loose_numbers_instead_of_a_radiator_record.md
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createMyPassiveRadiatorRepo, MY_PASSIVE_RADIATORS_KEY} from '../src/repos/myPassiveRadiatorRepo.js';
import type {KeyValueStorage} from '../src/storage/keyValueStorage.js';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** An in-memory storage, so each test sees only what it put there itself. */
function memoryStorage(): KeyValueStorage & { raw(key: string): string | null } {
  const held = new Map<string, string>();
  return {
    get: (k) => held.get(k) ?? null,
    set: (k, v) => { held.set(k, v); },
    remove: (k) => { held.delete(k); },
    raw: (k) => held.get(k) ?? null,
    watch: () => () => {},
  };
}

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });

function passiveRadiatorRecord() {
  return {
    brand: scraped('Dayton'), model: scraped('DSA175-PR'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000001' },
    sku: { value: 'TEST-PR-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-PR-SKU' }] },
    driver_type: scraped('passive-radiator'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/pr.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      'passive-radiator': {
        Fs_hz: spec(20), Sd_m2: spec(0.014), Cms_m_per_N: spec(0.0011),
        Mms_kg: spec(0.06), Rms_kg_per_s: spec(1.5), Xmax_m: spec(0.012),
      },
    },
  };
}

function aRadiator(): OpenISDPassiveRadiatorStandalone {
  const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(passiveRadiatorRecord());
  if (Array.isArray(pr)) throw new Error('fixture radiator must conform: ' + pr.join('; '));
  return pr;
}

describe('myPassiveRadiatorRepo', () => {
  it('writes the same envelope shape as My Drivers', () => {
    const storage = memoryStorage();
    const repo = createMyPassiveRadiatorRepo(storage);

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
    const repo = createMyPassiveRadiatorRepo(storage);
    repo.upsert(aRadiator());

    const back = createMyPassiveRadiatorRepo(storage).list();
    assert.equal(back.length, 1);
    // The whole point: brand and model survive a save, which the five-number row discarded.
    assert.equal(back[0].passiveRadiator.model.value, 'DSA175-PR');
    assert.equal(back[0].passiveRadiator.brand.value, 'Dayton');
  });

  it('a saved radiator keeps its uuid across a read, so a row can be deleted by identity', () => {
    const storage = memoryStorage();
    const saved = createMyPassiveRadiatorRepo(storage).upsert(aRadiator());
    assert.ok(saved, 'the fixture storage is writable, so the save must succeed');

    const repo = createMyPassiveRadiatorRepo(storage);
    const listed = repo.list();
    assert.ok(saved);
    assert.equal(listed[0].uuid, saved.uuid, 'the uuid is adopted on read, never re-minted');

    repo.remove(saved.uuid);
    assert.equal(createMyPassiveRadiatorRepo(storage).list().length, 0);
  });
});
