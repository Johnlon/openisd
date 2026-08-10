/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-database/spec.md?html
 */
/**
 * Smoke test for the openisd.yml record types (openisdRecord.ts, ARCHITECTURE.md AD-8).
 * Not a round-trip test yet (no YAML reader/writer exists — AD-8 Step 3) — this proves the
 * TYPE is actually constructible against real data, not just that it compiles in isolation.
 *
 * Fixture values: Beyma 10BR60/V2, the real driver.yml this session read from
 * winisd_drivers/db/datasheets/beyma/10br60v2/driver.yml. Two sources agreeing on Fs (a
 * MATCH), to exercise the multi-reading shape a single-source field wouldn't touch.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { winningReading, type OpenISDRecord, type SpecEntry } from '../src/native/openisdRecord.js';

function fsEntry(): SpecEntry {
  return {
    origin: 'manufacturer_datasheet',
    readings: {
      manufacturer_datasheet: {
        actual_reading: '29 Hz', read_value: 29.0, read_precision: 0.5,
      },
      manufacturer_listing_page: {
        actual_reading: '29 Hz', read_value: 29.0, read_precision: 0.5,
      },
    },
    dq_status: 'MATCH',
    definition: 'free-air resonance frequency (Hz)',
    dq: [],
  };
}

const record: OpenISDRecord = {
  uuid: { value: 'c4169ddc-0000-0000-0000-000000000000', definition: 'stable record identity' },
  quality: {
    rating: 'M', confirmed_fields: ['Fs'], fields_with_issues: [], missing: [], invalid: [],
    parse_errors: [], cross_source_only: [],
  },
  manufacturer: { value: 'Beyma', origin: 'manufacturer_datasheet', definition: 'the company that makes the driver', dq: [] },
  brand: { value: 'Beyma', origin: 'manufacturer_datasheet', definition: 'the selling brand', dq: [] },
  model: { value: '10BR60/V2', origin: 'manufacturer_datasheet', definition: "the vendor's exact designation", dq: [] },
  sku: { value: '10br60v2', definition: 'canonical identity code', grounds: [
    { origin: 'manufacturer_datasheet', reading: '10BR60/V2', definition: 'the printed designation' },
  ] },
  driver_type: { value: 'woofer', origin: 'manufacturer_datasheet', definition: 'what kind of driver this is', dq: [] },
  disposition: { value: 'ok', definition: "the record's own account of its standing", detail: 'complete' },
  data_sources: {
    value: { manufacturer_datasheet: 'https://example.invalid/beyma-10br60v2.pdf' },
    definition: 'the record-wide provenance index',
  },
  authoritative: { value: 'manufacturer_datasheet', definition: 'which indexed source wins the datasheet waterfall' },
  specs: { woofer: { Fs: fsEntry() } },
};

describe('OpenISDRecord — constructible against real fixture data', () => {
  it('holds a real Beyma Fs reading, reachable only via winningReading()', () => {
    const fs = record.specs.woofer?.Fs;
    assert.ok(fs, 'Fs must be present on the woofer section');
    assert.equal(winningReading(fs!).read_value, 29.0);
    assert.equal(winningReading(fs!).actual_reading, '29 Hz');
  });

  it('throws if origin does not name a present reading — mirrors the Python validator', () => {
    const broken: SpecEntry = { origin: 'manual', readings: {}, dq: [] };
    assert.throws(() => winningReading(broken));
  });

  it('a metadata field (ScrapedField) has a flat value, unlike a SpecEntry', () => {
    assert.equal(record.brand.value, 'Beyma');
  });
});
