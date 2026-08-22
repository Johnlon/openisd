/**
 * openisdYaml — read tested against REAL Python-written output, not just self-consistency.
 * Fixture: verbatim content of a real openisd.yml this session read directly from the
 * repo (eminence/fs10-20a8, before drivers/ was later cleaned up) — a genuine interop
 * test, not a round-trip of TS-generated data through itself.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { OpenISDDriver } from '../src/openisdDriver.js';

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));
const REAL_YAML = readFileSync(join(FIXTURE_DIR, 'fixtures/real_openisd_fs10-20a8.yml'), 'utf8');
const fromYaml = (text: string): OpenISDDriver => OpenISDDriver.fromJsonRecord(parse(text));
const toYaml = (driver: OpenISDDriver): string => stringify(driver.toJsonRecord(), { sortMapEntries: false });

describe('fromYaml — parses REAL Python-written openisd.yml, not synthetic data', () => {
  it('reads every top-level field correctly', () => {
    const r = fromYaml(REAL_YAML).toJsonRecord();
    assert.equal(r.manufacturer.value, 'Eminence');
    assert.equal(r.manufacturer.origin, 'manufacturer_product_page');
    assert.equal(r.sku.value, 'fs10-20a8');
    assert.equal(r.driver_type.value, 'woofer');
  });

  it('reads the _DerivedField grounds list (sku) — the envelope kind with no origin/readings', () => {
    const r = fromYaml(REAL_YAML).toJsonRecord();
    assert.equal(r.sku.grounds.length, 1);
    assert.equal(r.sku.grounds[0].origin, 'manufacturer_product_page');
  });

  it('reads the _BookkeepingField data_sources map, keyed by SourceRole', () => {
    const r = fromYaml(REAL_YAML).toJsonRecord();
    assert.ok(r.data_sources.value.manufacturer_product_page?.startsWith('https://eminence.com'));
  });

  it('an empty specs.woofer parses to an empty object, not undefined', () => {
    const r = fromYaml(REAL_YAML).toJsonRecord();
    assert.deepEqual(r.specs.woofer, {});
  });
});

describe('toYaml — round-trips a record built in TS', () => {
  it('parses back to the same data after a write/read cycle', () => {
    const original = fromYaml(REAL_YAML);
    const roundTripped = fromYaml(toYaml(original));
    // Compare records, not driver instances: OpenISDDriver's own state (#cache, ...) is
    // private, so assert.deepEqual on two instances sees no own properties on either side and
    // passes vacuously regardless of content — verified empirically, not assumed.
    assert.deepEqual(roundTripped.toJsonRecord(), original.toJsonRecord());
  });

  it('a manually-constructed record with a populated _SpecEntry round-trips, ' +
     'including the readings dict (origin-lifecycle rule)', () => {
    const driver = OpenISDDriver.fromJsonRecord({
      uuid: { value: 'x', definition: 'd' },
      quality: { rating: 'M', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: [] },
      manufacturer: { value: 'Beyma', origin: 'manual', definition: 'd', dq: [] },
      brand: { value: 'Beyma', origin: 'manual', definition: 'd', dq: [] },
      model: { value: '10BR60/V2', origin: 'manual', definition: 'd', dq: [] },
      sku: { value: 'x', definition: 'd', grounds: [{ origin: 'manual', reading: 'x', definition: 'd' }] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'd', dq: [] },
      data_sources: { value: {}, definition: 'd' },
      authoritative: { value: 'manual', definition: 'd' },
      specs: {
        woofer: {
          Fs: {
            origin: 'manual',
            readings: { manual: { actual_reading: '29', read_value: 29.0, read_precision: 0 } },
            dq: [],
          },
        },
      },
    });
    const back = fromYaml(toYaml(driver)).toJsonRecord();
    assert.equal(back.specs.woofer?.Fs?.readings.manual?.read_value, 29.0);
  });
});
