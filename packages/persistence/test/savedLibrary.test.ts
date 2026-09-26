/**
 * The two saved libraries — My Drivers and My Passive Radiators — hold ONE envelope shape,
 * differing only in what each entry's `record` is:
 *
 *     { schema: number, entries: [{ uuid: string, record: <the thing's own record> }] }
 *
 * Every `record` is validated by the domain's own seam (`fromConformingRecord`), so neither
 * repo names a schema and neither asserts a shape. The uuid is minted by the repo and lives
 * OUTSIDE the record — an id inside the record could leak into a file export.
 *
 * bugs/BUG_20260909_the_my_passive_radiators_library_stores_five_loose_numbers_instead_of_a_radiator_record.md
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createMyDriverRepo, MY_DRIVERS_KEY} from '../src/repos/myDriverRepo.js';
import {createMyPassiveRadiatorRepo, MY_PASSIVE_RADIATORS_KEY} from '../src/repos/myPassiveRadiatorRepo.js';
import type {KeyValueStorage} from '../src/storage/keyValueStorage.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {Engine} from '@openisd/design/engine';

const engine = new Engine();

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

function driverRecord() {
  return {
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
        Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
      },
    },
  };
}

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

function aDriver(): OpenISDDriver {
  const d = OpenISDDriver.fromConformingRecord(driverRecord(), engine);
  if (Array.isArray(d)) throw new Error('fixture driver must conform: ' + d.join('; '));
  return d;
}

function aRadiator(): OpenISDPassiveRadiatorStandalone {
  const pr = OpenISDPassiveRadiatorStandalone.fromConformingRecord(passiveRadiatorRecord(), engine);
  if (Array.isArray(pr)) throw new Error('fixture radiator must conform: ' + pr.join('; '));
  return pr;
}

describe('both saved libraries write the same envelope', () => {
  it('My Drivers writes { schema, entries: [{ uuid, record }] }', () => {
    const storage = memoryStorage();
    const repo = createMyDriverRepo(storage, engine);

    repo.upsert(aDriver());

    const written: unknown = JSON.parse(storage.raw(MY_DRIVERS_KEY) ?? 'null');
    assert.ok(written && typeof written === 'object', 'the bucket must hold an object');
    const env = written as { schema?: unknown; entries?: unknown };
    assert.equal(typeof env.schema, 'number', 'the envelope states its schema version');
    assert.ok(Array.isArray(env.entries), 'the envelope holds `entries`, the shared field name');

    const entry = (env.entries as unknown[])[0] as { uuid?: unknown; record?: unknown };
    assert.equal(typeof entry.uuid, 'string', 'the repo mints a uuid per entry');
    assert.ok(entry.record && typeof entry.record === 'object', 'the entry carries the driver record');
    assert.ok(!('uuid' in (entry.record as Record<string, unknown>))
      || (entry.record as { uuid?: { value?: string } }).uuid?.value !== entry.uuid,
      'the storage uuid stays OUTSIDE the record, so it cannot leak into a file export');
  });

  it('My Passive Radiators writes the SAME envelope shape', () => {
    const storage = memoryStorage();
    const repo = createMyPassiveRadiatorRepo(storage, engine);

    repo.upsert(aRadiator());

    const written: unknown = JSON.parse(storage.raw(MY_PASSIVE_RADIATORS_KEY) ?? 'null');
    assert.ok(written && typeof written === 'object', 'the bucket must hold an object');
    const env = written as { schema?: unknown; entries?: unknown };
    assert.equal(typeof env.schema, 'number', 'the envelope states its schema version');
    assert.ok(Array.isArray(env.entries), 'the envelope holds `entries`, same field name as My Drivers');

    const entry = (env.entries as unknown[])[0] as { uuid?: unknown; record?: unknown };
    assert.equal(typeof entry.uuid, 'string', 'a uuid, not a Date.now() id');
    assert.ok(entry.record && typeof entry.record === 'object', 'the entry carries the RADIATOR RECORD, not five loose numbers');
  });
});

describe('both saved libraries return live domain objects', () => {
  it('My Drivers reads back an OpenISDDriver carrying every stored field', () => {
    const storage = memoryStorage();
    const repo = createMyDriverRepo(storage, engine);
    repo.upsert(aDriver());

    const back = createMyDriverRepo(storage, engine).list();
    assert.equal(back.length, 1);
    assert.equal(back[0].driver.model.value, 'RS225');
    assert.equal(back[0].driver.brand.value, 'Dayton');
  });

  it('My Passive Radiators reads back a radiator, not a five-number row', () => {
    const storage = memoryStorage();
    const repo = createMyPassiveRadiatorRepo(storage, engine);
    repo.upsert(aRadiator());

    const back = createMyPassiveRadiatorRepo(storage, engine).list();
    assert.equal(back.length, 1);
    // The whole point: brand and model survive a save, which the five-number row discarded.
    assert.equal(back[0].passiveRadiator.model.value, 'DSA175-PR');
    assert.equal(back[0].passiveRadiator.brand.value, 'Dayton');
  });

  it('a saved radiator keeps its uuid across a read, so a row can be deleted by identity', () => {
    const storage = memoryStorage();
    const saved = createMyPassiveRadiatorRepo(storage, engine).upsert(aRadiator());
    assert.ok(saved, 'the fixture storage is writable, so the save must succeed');

    const repo = createMyPassiveRadiatorRepo(storage, engine);
    const listed = repo.list();
    assert.ok(saved);
    assert.equal(listed[0].uuid, saved.uuid, 'the uuid is adopted on read, never re-minted');

    repo.remove(saved.uuid);
    assert.equal(createMyPassiveRadiatorRepo(storage, engine).list().length, 0);
  });
});
