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
import {createMyDriverRepo, MY_DRIVERS_KEY} from '../src/repos/myDriverRepo.js';
import type {KeyValueStorage} from '../src/storage/keyValueStorage.js';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

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

function aDriver(): OpenISDDriver {
  const d = OpenISDDriver.fromConformingRecord(driverRecord(), engine);
  if (Array.isArray(d)) throw new Error('fixture driver must conform: ' + d.join('; '));
  return d;
}

describe('myDriverRepo', () => {
  it('writes { schema, entries: [{ uuid, record }] }', () => {
    const storage = memoryStorage();
    const repo = createMyDriverRepo(storage, engine);

    repo.upsert(aDriver());

    const written: unknown = JSON.parse(storage.raw(MY_DRIVERS_KEY) ?? 'null');
    if (!isRecord(written)) throw new Error('the bucket must hold an object');
    assert.equal(typeof written.schema, 'number', 'the envelope states its schema version');
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
    const repo = createMyDriverRepo(storage, engine);
    repo.upsert(aDriver());

    const back = createMyDriverRepo(storage, engine).list();
    assert.equal(back.length, 1);
    assert.equal(back[0].driver.model.value, 'RS225');
    assert.equal(back[0].driver.brand.value, 'Dayton');
  });
});
