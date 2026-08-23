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
import { createMemoryStorage } from '../../src/persistence/storage/keyValueStorage.js';
import { createMyDriverRepo, MY_DRIVERS_KEY } from '../../src/persistence/repos/myDriverRepo.js';
import { CURRENT_MY_DRIVERS_SCHEMA, myDriversSchema } from '../../src/logic/schemaUpgrade.js';

/** The stored bucket's records, whichever envelope version wraps them. */
function storedDrivers(raw: string | null): unknown[] {
  const parsed = JSON.parse(raw ?? '[]') as unknown;
  return Array.isArray(parsed) ? parsed : (parsed as { drivers: unknown[] }).drivers;
}
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import { driverHasDqIssues } from '../../src/persistence/repos/driverRepo.js';
import { driverFromConformingRecord } from '../../src/logic/managedDriver.js';

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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const list = repo.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].metaCell('brand').value, 'Valid');
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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([first, second]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, existingValid]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);

    repo.upsert(OpenISDDriver.fromJsonRecord(newValid));

    const stored = storedDrivers(store.get(MY_DRIVERS_KEY));
    assert.equal(stored.length, 3, 'the legacy blob, the existing valid record, and the new one');
    assert.ok(
      stored.some(r => (r as { _savedAt?: number; Fs?: number })._savedAt === 1
        && (r as { Fs?: number }).Fs === 41),
      'the unrecognised legacy blob must survive the write (its fields intact; the v1→v2 '
      + 'upgrade may stamp a uuid onto it)',
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
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([flatLegacy, valid]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);

    const removed = repo.remove('valid-uuid');
    assert.equal(removed, true);

    const stored = storedDrivers(store.get(MY_DRIVERS_KEY));
    assert.equal(stored.length, 1, 'only the legacy blob remains');
    assert.ok(
      stored.some(r => (r as { _savedAt?: number })._savedAt === 1),
      'the unrecognised legacy blob must survive the removal untouched',
    );
    assert.equal(
      stored.some(r => (r as { brand?: { value?: string } }).brand?.value === 'Valid'),
      false,
      'the removed valid record must be gone',
    );
  });
});

// ── D21: the QO81 storage-failure package ────────────────────────────────────────────────

/** A minimal conforming record with a chosen uuid. */
function validRecord(uuid: string, brand: string, model: string): _OpenISDDriverJson {
  return {
    uuid: { value: uuid, definition: 'stable record identity' },
    quality: {
      rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: brand, origin: 'manual', definition: 'x', dq: [] },
    brand: { value: brand, origin: 'manual', definition: 'x', dq: [] },
    model: { value: model, origin: 'manual', definition: 'x', dq: [] },
    sku: { value: `${brand}-${model}`.toLowerCase(), definition: 'x', grounds: [] },
    driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
    data_sources: { value: {}, definition: 'x' },
    authoritative: { value: 'manual', definition: 'x' },
    specs: { woofer: {
      Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
      Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
    } },
  } as _OpenISDDriverJson;
}

describe('D21 — format version and the upgrade chain', () => {
  it('a v1 bare array reads, is upgraded to the current envelope, and is saved back IN PLACE', () => {
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([validRecord('u-1', 'A', 'One')]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const read = repo.read();
    assert.equal(read.kind, 'ok');
    assert.equal(read.kind === 'ok' && read.drivers.length, 1);
    const stored = JSON.parse(store.get(MY_DRIVERS_KEY)!) as { schema: number };
    assert.equal(stored.schema, CURRENT_MY_DRIVERS_SCHEMA,
      'the upgraded envelope must be saved over the old shape, same identities');
  });

  it('the v1→v2 step mints a uuid for a record that lacks one — the upgrade IS a save', () => {
    const noUuid = { ...validRecord('', 'B', 'Two'), uuid: { value: '', definition: 'x' } };
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: JSON.stringify([noUuid]) });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const drivers = repo.list();
    assert.equal(drivers.length, 1);
    assert.ok(drivers[0]!.uuid().length > 0, 'a stored record without identity gets one minted');
  });

  it('a bucket written by a NEWER app version is unreadable here — never guessed at', () => {
    const store = createMemoryStorage({
      [MY_DRIVERS_KEY]: JSON.stringify({ schema: CURRENT_MY_DRIVERS_SCHEMA + 1, drivers: [] }),
    });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    assert.equal(repo.read().kind, 'unreadable');
  });
});

describe('D21 — identity is the uuid; names are display only', () => {
  it('same-name drivers coexist; upsert overwrites by uuid alone', () => {
    const store = createMemoryStorage({});
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    repo.upsert(OpenISDDriver.fromJsonRecord(validRecord('u-a', 'Same', 'Name')));
    repo.upsert(OpenISDDriver.fromJsonRecord(validRecord('u-b', 'Same', 'Name')));
    assert.equal(repo.list().length, 2, 'a name collision overwrites nothing');

    const edited = OpenISDDriver.fromJsonRecord(validRecord('u-a', 'Renamed', 'Driver'));
    const res = repo.upsert(edited);
    assert.deepEqual(res, { overwrote: true }, 'same uuid = the same driver, renamed in place');
    assert.equal(repo.list().length, 2);
  });

  it('upsert mints an identity for a draft that has none', () => {
    const store = createMemoryStorage({});
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const draft = OpenISDDriver.fromJsonRecord(validRecord('', 'New', 'Draft'));
    repo.upsert(draft);
    assert.ok(draft.uuid().length > 0, 'saving is what mints identity');
    assert.equal(repo.list()[0]!.uuid(), draft.uuid());
  });
});

describe('D21 — failure surfaces', () => {
  it('inaccessible storage reads as unavailable, not as corruption', () => {
    const store = {
      get(_key: string): string | null { throw new Error('denied'); },
      set(_key: string, _value: string): void { throw new Error('denied'); },
      remove(_key: string): void { throw new Error('denied'); },
    };
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    assert.equal(repo.read().kind, 'unavailable');
    assert.deepEqual(repo.list(), []);
  });

  it('an unreadable bucket is READ-ONLY: every ordinary write refuses, the raw string is exported verbatim', () => {
    const corrupt = '{"version": 2, "drivers": NOT-JSON';
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: corrupt });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);

    const read = repo.read();
    assert.equal(read.kind, 'unreadable');
    assert.equal(read.kind === 'unreadable' && read.raw, corrupt, 'the raw string, verbatim');
    assert.equal(repo.exportRaw(), corrupt);

    assert.equal(repo.upsert(OpenISDDriver.fromJsonRecord(validRecord('u-x', 'X', 'Y'))), null);
    assert.equal(repo.remove('u-x'), false);
    assert.equal(repo.replaceAll([]), false);
    assert.equal(store.get(MY_DRIVERS_KEY), corrupt,
      'the corrupted string is the only copy — nothing may overwrite it');
  });

  it('deleteAll is the ONE sanctioned wipe of an unreadable bucket, and starts a fresh envelope', () => {
    const store = createMemoryStorage({ [MY_DRIVERS_KEY]: 'garbage' });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    repo.deleteAll();
    assert.equal(repo.read().kind, 'ok');
    assert.deepEqual(repo.list(), []);
  });

  it('an entry failing after the chain is preserved untouched and surfaced by name', () => {
    const broken = { brand: { value: 'Ghost' }, model: { value: 'Blob' }, halfARecord: true };
    const store = createMemoryStorage({
      [MY_DRIVERS_KEY]: JSON.stringify({ schema: CURRENT_MY_DRIVERS_SCHEMA, drivers: [broken, validRecord('u-ok', 'A', 'B')] }),
    });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const read = repo.read();
    assert.equal(read.kind, 'ok');
    if (read.kind !== 'ok') return;
    assert.equal(read.drivers.length, 1);
    assert.equal(read.broken.length, 1);
    assert.equal(read.broken[0]!.label, 'Ghost Blob', 'surfaced by NAME, not hidden');
    assert.equal(read.broken[0]!.raw, JSON.stringify(broken), 'its own bytes, exportable verbatim');
    // and removeBroken removes exactly it, leaving the good driver
    assert.equal(repo.removeBroken(read.broken[0]!.key), true);
    const after = repo.read();
    assert.equal(after.kind === 'ok' && after.broken.length, 0);
    assert.equal(repo.list().length, 1);
  });

  it('a driver with missing spec parameters is NEVER excluded — flags yes, exclusion never', () => {
    // Fs only — no Re, no Qts, nothing else. Structurally conforming, parametrically bare.
    const bare = validRecord('u-bare', 'Bare', 'Driver');
    (bare.specs.woofer as Record<string, unknown>) = {};
    const store = createMemoryStorage({
      [MY_DRIVERS_KEY]: JSON.stringify({ schema: CURRENT_MY_DRIVERS_SCHEMA, drivers: [bare] }),
    });
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    assert.equal(repo.list().length, 1,
      'no Fs is no different from a new driver the user left blank — it shows everywhere');
  });
});

describe('D21-R Q3 — importing the same file twice can never silently overwrite (the governing risk)', () => {
  it('two imports of one file are two entries with two identities', () => {
    const store = createMemoryStorage({});
    const repo = createMyDriverRepo(store, driverFromConformingRecord, myDriversSchema);
    const fileRecord = validRecord('the-files-own-uuid', 'FileBrand', 'FileModel');

    // The import path's rule (driverBrowsingState.loadFromDisk): ALWAYS mint fresh before
    // upsert — the file's own uuid is provenance, never the store key.
    const first = OpenISDDriver.fromJsonRecord(structuredClone(fileRecord));
    first.mintFreshUuid();
    repo.upsert(first);
    const second = OpenISDDriver.fromJsonRecord(structuredClone(fileRecord));
    second.mintFreshUuid();
    repo.upsert(second);

    const drivers = repo.list();
    assert.equal(drivers.length, 2, 'importing the same file twice yields two entries');
    assert.notEqual(drivers[0]!.uuid(), drivers[1]!.uuid(), 'each with its own identity');
    assert.ok(drivers.every(d => d.uuid() !== 'the-files-own-uuid'),
      "the file's own uuid is never adopted as the store key");
  });
});
