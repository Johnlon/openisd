/**
 * Unit tests for `manufacturerOf` (`packages/persistence/src/repos/driverRepo.ts`) — the
 * manufacturer a row is grouped under in a manufacturer-tree picker view.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { manufacturerOf, type FileEntry } from '@openisd/persistence';
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';

function driverWithBrand(brand: string | null, manufacturer: string | null): OpenISDDriver {
  const record: _OpenISDDriverJson = {
    uuid: { value: 'test-uuid', definition: 'stable record identity' },
    quality: {
      rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: manufacturer ?? '', origin: 'manual', definition: 'the company that makes the driver', dq: [] },
    brand: { value: brand ?? '', origin: 'manual', definition: 'the selling brand', dq: [] },
    model: { value: 'Model', origin: 'manual', definition: "the vendor's exact designation", dq: [] },
    sku: { value: 'test-model', definition: 'canonical identity code', grounds: [] },
    driver_type: { value: 'woofer', origin: 'manual', definition: 'what kind of driver this is', dq: [] },
    data_sources: { value: {}, definition: 'the record-wide provenance index' },
    authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
    specs: { woofer: {} },
  };
  return OpenISDDriver.fromJsonRecord(record);
}

describe('manufacturerOf — record path (record/myDriverData present)', () => {
  it('reads brand off the record', () => {
    const f: FileEntry = { name: 'x', record: driverWithBrand('Dayton Audio', 'SoundImports') };
    assert.equal(manufacturerOf(f), 'Dayton Audio');
  });

  it('falls back to manufacturer when brand is not set', () => {
    const f: FileEntry = { name: 'x', record: driverWithBrand(null, 'SoundImports') };
    assert.equal(manufacturerOf(f), 'SoundImports');
  });

  it('is "Unclassified" when neither brand nor manufacturer is set', () => {
    const f: FileEntry = { name: 'x', record: driverWithBrand(null, null) };
    assert.equal(manufacturerOf(f), 'Unclassified');
  });

  it('myDriverData takes precedence over record', () => {
    const f: FileEntry = {
      name: 'x',
      myDriverData: driverWithBrand('Peerless', null),
      record: driverWithBrand('Dayton Audio', null),
    };
    assert.equal(manufacturerOf(f), 'Peerless');
  });
});

describe('manufacturerOf — federated .wdr text path (no record yet)', () => {
  it('reads Brand out of the raw .wdr text', () => {
    const f: FileEntry = { name: 'x', content: 'Brand=Dayton Audio\r\nModel=E150HE-44\r\n' };
    assert.equal(manufacturerOf(f), 'Dayton Audio');
  });

  it('falls back to Manufacturer when Brand is absent in the raw text', () => {
    const f: FileEntry = { name: 'x', content: 'Manufacturer=SoundImports\r\nModel=E150HE-44\r\n' };
    assert.equal(manufacturerOf(f), 'SoundImports');
  });
});

describe('manufacturerOf — no record and no content (summary-only row)', () => {
  it('is "Unclassified"', () => {
    const f: FileEntry = { name: 'x' };
    assert.equal(manufacturerOf(f), 'Unclassified');
  });
});
