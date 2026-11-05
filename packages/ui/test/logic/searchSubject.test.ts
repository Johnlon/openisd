/**
 * `matchesCriteria` — the filter bar as one predicate — runs over a `SearchSubject`: the handful
 * of facts the filter reads, named once. Two things become a subject: a bundled index row
 * (`searchSubjectOfIndexRow`, no domain object — the picker lists rows off the index) and a
 * My Drivers domain object (`searchSubjectOfDriver`). The predicate is the same for both, which
 * is what keeps a filter from skipping a section (`openisd-ui-design.md` §"Filters apply to
 * every list").
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, OpenISDDriverStandalone} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import type {BundledDriverIndexRow} from '@openisd/persistence';
import {
    chipsOf,
    displayNameOf,
    matchesCriteria,
    statedRangeResult,
    type SearchCriteria,
    type SearchSubject,
    searchSubjectOfDriver,
    searchSubjectOfIndexRow,
} from '../../src/logic/driverDisplay.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'manual', readings: { manual: { read_value } } });

const UUID = '00000000-0000-4000-8000-000000000001';

const driver: OpenISDDriverStandalone = (() => {
  const d = OpenISDDriver.fromConformingRecord({
    uuid: { value: UUID },
    manufacturer: scraped('Tang Band'), brand: scraped('Tang Band'), model: scraped('W5-1138SMF'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(['subwoofer']),
    data_sources: { value: {} },
    quality: { confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: [] },
    specs: { woofer: { Fs_hz: spec(45), Sd_m2: spec(0.0075), Znom_ohm: spec(4) } },
  }, createEngine());
  if (Array.isArray(d)) throw new Error(d.join(', '));
  return d;
})();

const row: BundledDriverIndexRow = {
  uuid: UUID, path: 'tang-band/w5-1138smf', name: 'Tang Band W5-1138SMF', dq: false,
  datasheet: null, productPage: null, listingPage: null,
  chips: chipsOf(driver).types, canonical: chipsOf(driver).canonical,
  Fs_hz: 45, Sd_m2: 0.0075, Xmax_m: null, Vd_m3: null, Znom_ohm: 4,
  freq_low_hz: null, freq_high_hz: null,
};

const noCriteria: SearchCriteria = {
  query: '', typeStates: {}, fsMin: '', fsMax: '', rangeFrom: '', rangeTo: '', rangeKeepUnstated: true, sdMin: '', sdMax: '', selZ: [],
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

  describe('the stated range filter', () => {
    const stating = (freq_low_hz: number | null, freq_high_hz: number | null): SearchSubject =>
      ({ ...searchSubjectOfIndexRow(row), freq_low_hz, freq_high_hz });
    const typed = (rangeFrom: string, rangeTo: string): SearchCriteria => ({ ...noCriteria, rangeFrom, rangeTo });

    it('a driver whose stated range covers what is typed matches', () => {
      assert.equal(statedRangeResult(stating(30, 3000), typed('40', '2000')), 'covers');
      assert.equal(statedRangeResult(stating(40, 2000), typed('40', '2000')), 'covers', 'the ends themselves count');
    });

    it('a driver that stops short at either end is out of the list', () => {
      assert.equal(statedRangeResult(stating(50, 3000), typed('40', '2000')), 'short');
      assert.equal(statedRangeResult(stating(30, 1000), typed('40', '2000')), 'short');
      assert.equal(matchesCriteria(stating(50, 3000), typed('40', '2000')), false);
    });

    it('filling one box checks only that end', () => {
      assert.equal(statedRangeResult(stating(30, 100), typed('40', '')), 'covers');
      assert.equal(statedRangeResult(stating(50, 100), typed('40', '')), 'short');
      assert.equal(statedRangeResult(stating(500, 3000), typed('', '2000')), 'covers');
      assert.equal(statedRangeResult(stating(500, 1000), typed('', '2000')), 'short');
    });

    it('a driver with no stated range stays in the list, marked not stated', () => {
      assert.equal(statedRangeResult(stating(null, null), typed('40', '2000')), 'notStated');
      assert.equal(matchesCriteria(stating(null, null), typed('40', '2000')), true);
    });

    it('a driver stating one end is judged on that end, and is not stated for the other', () => {
      assert.equal(statedRangeResult(stating(50, null), typed('40', '2000')), 'short');
      assert.equal(statedRangeResult(stating(30, null), typed('40', '2000')), 'notStated');
      assert.equal(statedRangeResult(stating(30, null), typed('40', '')), 'covers');
    });

    it('unticking the checkbox hides drivers that state no range, and only those', () => {
      const strict = { ...typed('40', '2000'), rangeKeepUnstated: false };
      assert.equal(matchesCriteria(stating(null, null), strict), false);
      assert.equal(matchesCriteria(stating(30, null), strict), false, 'one end not stated is not stated');
      assert.equal(matchesCriteria(stating(30, 3000), strict), true);
      assert.equal(matchesCriteria(stating(50, 3000), strict), false);
    });

    it('the checkbox does nothing while both boxes are empty', () => {
      assert.equal(matchesCriteria(stating(null, null), { ...noCriteria, rangeKeepUnstated: false }), true);
    });

    it('empty or unreadable boxes mean the filter is off', () => {
      assert.equal(statedRangeResult(stating(null, null), typed('', '')), 'off');
      assert.equal(statedRangeResult(stating(50, 100), typed('abc', '')), 'off');
    });
  });
});
