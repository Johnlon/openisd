/**
 * `matchesCriteria` — the filter bar as one predicate — runs over a `SearchSubject`: the handful
 * of facts the filter reads, named once. Two things become a subject: a bundled index row
 * (`searchSubjectOfIndexRow`, no domain object — the picker lists rows off the index) and a
 * My Drivers domain object (`searchSubjectOfDriver`). The predicate is the same for both, which
 * is what keeps a filter from skipping a section (`openisd-ui-design.md` §"Filters apply to
 * every list").
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import type { BundledDriverIndexRow } from '@openisd/persistence';
import {
  matchesCriteria, searchSubjectOfDriver, searchSubjectOfIndexRow, chipsOf, displayNameOf,
  type SearchCriteria, type SearchSubject,
} from '../../src/logic/driverDisplay.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

const UUID = '00000000-0000-4000-8000-000000000001';

const driver: OpenISDDriver = (() => {
  const d = OpenISDDriver.fromConformingRecord({
    uuid: { value: UUID },
    manufacturer: scraped('Tang Band'), brand: scraped('Tang Band'), model: scraped('W5-1138SMF'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped('subwoofer'),
    data_sources: { value: {} },
    authoritative: { value: 'manual' },
    quality: { confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: [] },
    specs: { woofer: { Fs_hz: spec(45), Sd_m2: spec(0.0075), Znom_ohm: spec(4) } },
  }, new Engine());
  if (Array.isArray(d)) throw new Error(d.join(', '));
  return d;
})();

const row: BundledDriverIndexRow = {
  uuid: UUID, path: 'tang-band/w5-1138smf', name: 'Tang Band W5-1138SMF', dq: false,
  datasheet: null, productPage: null, listingPage: null,
  chips: chipsOf(driver).types, canonical: chipsOf(driver).canonical,
  Fs_hz: 45, Sd_m2: 0.0075, Xmax_m: null, Vd_m3: null, Znom_ohm: 4,
};

const noCriteria: SearchCriteria = {
  query: '', typeStates: {}, fsMin: '', fsMax: '', sdMin: '', sdMax: '', selZ: [],
  favoritesOnly: false, favorites: [],
};

describe('searchSubjectOfDriver / searchSubjectOfIndexRow', () => {
  it('an index row and the domain object it was written from become the same subject', () => {
    const fromRow: SearchSubject = searchSubjectOfIndexRow(row);
    const fromDriver: SearchSubject = searchSubjectOfDriver(driver);
    assert.deepEqual(fromRow, fromDriver);
    assert.equal(fromDriver.id, UUID);
    assert.equal(fromDriver.name, displayNameOf(driver));
  });
});

describe('matchesCriteria over a subject', () => {
  it('admits everything with no criteria', () => {
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), noCriteria), true);
  });

  it('text tokens must all appear in the name', () => {
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, query: 'tang 1138' }), true);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, query: 'dayton' }), false);
  });

  it('type chips include and exclude by the row\'s chips', () => {
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, typeStates: { sub: 'include' } }), true);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, typeStates: { tweet: 'include' } }), false);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, typeStates: { sub: 'exclude' } }), false);
  });

  it('Fs and Sd ranges and the impedance set read the row\'s figures', () => {
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, fsMin: '40', fsMax: '50' }), true);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, fsMin: '50' }), false);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, sdMin: '70', sdMax: '80' }), true, 'Sd in cm²');
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, selZ: ['4'] }), true);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, selZ: ['8'] }), false);
  });

  it('favourites-only admits a subject whose id is starred', () => {
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, favoritesOnly: true, favorites: [UUID] }), true);
    assert.equal(matchesCriteria(searchSubjectOfIndexRow(row), { ...noCriteria, favoritesOnly: true, favorites: [] }), false);
  });
});
