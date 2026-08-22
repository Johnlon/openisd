/**
 * `myDrivers.ts::list()` is the seam that reads unchecked browser-storage data. A record that
 * does not conform to `_OpenISDDriverJson` (the flat legacy shape this key predates, or any
 * other malformed blob) must be refused here — never handed downstream, where
 * `driverHasDqIssues`/`recordStandingIsOk` assume every field the type declares required is
 * actually present (`bugs/BUG_20260822_driverstanding_throws_on_a_record_with_no_quality_block.md`).
 *
 * A refused record is never ERASED from storage: `upsert`/`remove` preserve it untouched
 * alongside whatever conforming records they write (QO81, pending ratification) — only
 * `list()`'s in-memory result drops it.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../src/db/kv.js';
import { createMyDriverRepo, MY_DRIVERS_KEY } from '../../src/db/myDrivers.js';
import type { _OpenISDDriverJson } from '@openisd/model';
import { driverHasDqIssues } from '../../src/db/driverRepo.js';

describe('myDrivers.ts::list() — refuses records that do not conform to _OpenISDDriverJson', () => {
  it('returns only the valid record when the stored list mixes a flat legacy record with a valid one', () => {
    const flatLegacy = {
      name: 'Spec Fixture Driver', brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    };
    const valid: _OpenISDDriverJson = {
      uuid: { value: 'valid-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Valid', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'valid-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store);
    const list = repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].brand?.value, 'Valid');
  });

  it('the picker code path over the filtered result does not throw', () => {
    const flatLegacy = {
      name: 'Spec Fixture Driver', brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    };
    const valid: _OpenISDDriverJson = {
      uuid: { value: 'valid-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Valid', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'valid-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store);
    for (const record of repo.list()) {
      assert.doesNotThrow(() => driverHasDqIssues({ name: 'x', record }));
    }
  });

  it('returns an empty list when every stored record is invalid', () => {
    const flatLegacy = {
      name: 'Spec Fixture Driver', brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy]) });
    const repo = createMyDriverRepo(store);
    assert.deepEqual(repo.list(), []);
  });

  it('returns every record when all are valid', () => {
    const first: _OpenISDDriverJson = {
      uuid: { value: 'first-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'First', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'first-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const second: _OpenISDDriverJson = {
      uuid: { value: 'second-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Second', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'second-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([first, second]) });
    const repo = createMyDriverRepo(store);
    assert.equal(repo.list().length, 2);
  });
});

describe('myDrivers.ts — upsert/remove preserve non-conforming stored entries (QO81, pending ratification)', () => {
  it('upsert writes the new record without erasing an unrecognised stored blob', () => {
    const flatLegacy = {
      name: 'Spec Fixture Driver', brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    };
    const existingValid: _OpenISDDriverJson = {
      uuid: { value: 'existing-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Existing', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'existing-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const newValid: _OpenISDDriverJson = {
      uuid: { value: 'new-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'New', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'new-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, existingValid]) });
    const repo = createMyDriverRepo(store);

    repo.upsert(newValid);

    const stored = JSON.parse(store.get(MY_DRIVERS_KEY) ?? '[]') as unknown[];
    assert.equal(stored.length, 3, 'the legacy blob, the existing valid record, and the new one');
    assert.ok(
      stored.some(r => JSON.stringify(r) === JSON.stringify(flatLegacy)),
      'the unrecognised legacy blob must survive the write untouched',
    );
    assert.ok(
      stored.some(r => (r as { brand?: { value?: string } }).brand?.value === 'Existing'),
      'the pre-existing valid record must survive',
    );
    assert.ok(
      stored.some(r => (r as { brand?: { value?: string } }).brand?.value === 'New'),
      'the newly upserted record must be written',
    );
  });

  it('remove drops only the identified valid record and leaves the unrecognised blob in place', () => {
    const flatLegacy = {
      name: 'Spec Fixture Driver', brand: 'Spec', model: 'Fixture',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    };
    const valid: _OpenISDDriverJson = {
      uuid: { value: 'valid-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Valid', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Driver', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'valid-driver', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      disposition: { value: 'ok', definition: 'x', detail: '' },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    const store = createMemoryStore({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store);

    const removed = repo.remove('valid/driver');
    assert.equal(removed, true);

    const stored = JSON.parse(store.get(MY_DRIVERS_KEY) ?? '[]') as unknown[];
    assert.equal(stored.length, 1, 'only the legacy blob remains');
    assert.ok(
      stored.some(r => JSON.stringify(r) === JSON.stringify(flatLegacy)),
      'the unrecognised legacy blob must survive the removal untouched',
    );
    assert.equal(
      stored.some(r => (r as { brand?: { value?: string } }).brand?.value === 'Valid'),
      false,
      'the removed valid record must be gone',
    );
  });
});
