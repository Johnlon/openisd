/**
 * Unit tests for `groupByManufacturer` (`packages/ui/src/logic/driverBrowsingState.ts`) — the
 * manufacturer-tree view over an already-filtered driver list (WinISD's New Project wizard
 * driver picker: Manufacturer > Model).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { groupByManufacturer } from '../../src/logic/driverBrowsingState.js';
import type { FileEntry } from '@openisd/persistence';
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';

function fileFor(brand: string, model: string): FileEntry {
  const record: _OpenISDDriverJson = {
    uuid: { value: `uuid-${brand}-${model}`, definition: 'stable record identity' },
    quality: {
      rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: brand, origin: 'manual', definition: 'the company that makes the driver', dq: [] },
    brand: { value: brand, origin: 'manual', definition: 'the selling brand', dq: [] },
    model: { value: model, origin: 'manual', definition: "the vendor's exact designation", dq: [] },
    sku: { value: `${brand}-${model}`, definition: 'canonical identity code', grounds: [] },
    driver_type: { value: 'woofer', origin: 'manual', definition: 'what kind of driver this is', dq: [] },
    data_sources: { value: {}, definition: 'the record-wide provenance index' },
    authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
    specs: { woofer: {} },
  };
  const driver = OpenISDDriver.fromJsonRecord(record);
  return { name: `${brand} ${model}`, record: driver };
}

describe('groupByManufacturer', () => {
  it('sorts manufacturers alphabetically', () => {
    const files = [fileFor('SoundImports', 'X1'), fileFor('Dayton Audio', 'DC160S-4'), fileFor('B&C', 'Y2')];
    const groups = groupByManufacturer(files);
    assert.deepEqual(groups.map(g => g.manufacturer), ['B&C', 'Dayton Audio', 'SoundImports']);
  });

  it('sorts models alphabetically within a manufacturer', () => {
    const files = [
      fileFor('Dayton Audio', 'E150HE-44'),
      fileFor('Dayton Audio', 'DC250-8'),
      fileFor('Dayton Audio', 'DC160S-4'),
    ];
    const groups = groupByManufacturer(files);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].files.map(f => f.name), [
      'Dayton Audio DC160S-4', 'Dayton Audio DC250-8', 'Dayton Audio E150HE-44',
    ]);
  });

  it('groups multiple manufacturers, each with its own models', () => {
    const files = [
      fileFor('Dayton Audio', 'DC250-8'),
      fileFor('Peerless', 'SLS-8'),
      fileFor('Dayton Audio', 'DC160S-4'),
    ];
    const groups = groupByManufacturer(files);
    assert.deepEqual(groups.map(g => g.manufacturer), ['Dayton Audio', 'Peerless']);
    assert.deepEqual(groups[0].files.map(f => f.name), ['Dayton Audio DC160S-4', 'Dayton Audio DC250-8']);
    assert.deepEqual(groups[1].files.map(f => f.name), ['Peerless SLS-8']);
  });

  it('reflects an already-narrowed (filtered) list rather than bypassing it', () => {
    // The filter step has already dropped everything but one Dayton Audio row — grouping
    // must not reach past that and pull other rows back in.
    const files = [fileFor('Dayton Audio', 'DC160S-4')];
    const groups = groupByManufacturer(files);
    assert.deepEqual(groups.map(g => g.manufacturer), ['Dayton Audio']);
    assert.equal(groups[0].files.length, 1);
  });

  it('is empty when the filtered list is empty', () => {
    assert.deepEqual(groupByManufacturer([]), []);
  });

  it('buckets a driver with no brand/manufacturer under "Unclassified"', () => {
    const f: FileEntry = { name: 'x' };
    const groups = groupByManufacturer([f]);
    assert.deepEqual(groups.map(g => g.manufacturer), ['Unclassified']);
  });
});
