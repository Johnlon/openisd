import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinIsdDriverConverter, openIsdDriverToWinIsdDriver} from '../../domain/winIsdDriverConverter.js';
import {wdrDriverDiffs, oidDriverDiffs, textRoundTripDiff, jsonRoundTripDiffs} from '../../domain/driverRoundTripDiffs.js';
import {OpenISDDriver} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {diffWdrValues} from './wdrDiff.js';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';

/** The engine every projection in this file uses — factory settings, as the bridge's own. */
const engine = createEngine();

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus');

/** A real `driver.yml`: Dayton CE28N-4, a woofer-section record carrying `scraper_meta`. */
function daytonDriverYml(): string {
  return readFileSync(join(FIXTURES, 'dayton-ce28n-4.driver.yml'), 'utf8');
}

/** A second, DIFFERENT real `driver.yml`: Scan-Speak 15W/4424G00 — used only where a test needs
 *  two real records that disagree, never as a stand-in for a hand-built one. */
function scanspeakDriverYml(): string {
  return readFileSync(join(FIXTURES, 'scanspeak-15w-4424g00.driver.yml'), 'utf8');
}

const scraped = <T,>(value: T) => ({ value });

const spec = (read_value: number) => ({ state: 'E' as const, value: read_value, origin: 'manual', readings: { manual: { read_value } } });

function recordDriver() {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: 'ACME-WIDGET', grounds: [{ origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(40), Re_ohm: spec(6), Sd_m2: spec(0.0133), Vas_m3: spec(0.03),
        Qts: spec(0.4), Qes: spec(0.45),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return openIsdDriverToWinIsdDriver(driver, []);
}

const here = dirname(fileURLToPath(import.meta.url));

const WDR_TEXT = readFileSync(
  join(here, '..', '..', '..', '..', 'drivers', 'myprobes', 'inconsistencies', 'inconsistency-test-qts-C.wdr'),
  'utf8',
);

function driverOf(wdr: string): OpenISDDriver {
  const { record } = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(wdr));
  const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('WinISD driver diffs', () => {
  describe('the diff primitives — each mismatch arm exercised directly, per their own doc comments', () => {
    it('wdrDriverDiffs reports a snapshot mismatch between two different real .wdr outputs', () => {
      const a = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      const b = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(scanspeakDriverYml());
      assert.ok(a.wdr !== null && b.wdr !== null, 'both fixtures must produce a .wdr, or this proves nothing');

      const wa = WinISDDriver.fromWdrIni(a.wdr);
      const wb = WinISDDriver.fromWdrIni(b.wdr);

      assert.deepEqual(wdrDriverDiffs(wa, wa), [], 'a driver never disagrees with itself');
      const diffs = wdrDriverDiffs(wa, wb);
      assert.equal(diffs.length, 1);
      assert.match(diffs[0], /snapshot mismatch/);
    });

    it('oidDriverDiffs reports a snapshot mismatch between two different real OpenISD drivers', () => {
      const engine = createEngine();
      const daytonParsed = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      const scanspeakParsed = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(scanspeakDriverYml());
      assert.ok(daytonParsed.openisd !== null && scanspeakParsed.openisd !== null);

      const daytonRecord: unknown = JSON.parse(daytonParsed.openisd);
      const scanspeakRecord: unknown = JSON.parse(scanspeakParsed.openisd);
      const daytonDriver = OpenISDDriver.fromConformingRecord(daytonRecord, engine);
      const scanspeakDriver = OpenISDDriver.fromConformingRecord(scanspeakRecord, engine);
      assert.ok(!Array.isArray(daytonDriver) && !Array.isArray(scanspeakDriver),
        'both fixtures must build a valid driver, or this proves nothing');

      assert.deepEqual(oidDriverDiffs(daytonDriver, daytonDriver), [], 'a driver never disagrees with itself');
      const diffs = oidDriverDiffs(daytonDriver, scanspeakDriver);
      assert.equal(diffs.length, 1);
      assert.match(diffs[0], /snapshot mismatch/);
    });

    it('textRoundTripDiff reports one error naming the given field when the texts differ, none when they match', () => {
      assert.deepEqual(textRoundTripDiff('some-field', 'some message', 'same', 'same'), []);

      const diffs = textRoundTripDiff('some-field', 'some message', 'a', 'b');
      assert.deepEqual(diffs, [{ level: 'error', field: 'some-field', message: 'some message' }]);
    });

    it('wdrDriverDiffs falls back to "" for a .wdr header field the driver never states', () => {
      // A real .wdr's rows, but built with an empty header object — `headerField()` then returns
      // `undefined` for brand/model/manufacturer/providedBy/comment/dateAdded, forcing the `?? ""`
      // fallback in `wdrDriverSnapshotJson` rather than a hand-built header disagreeing by design.
      const { wdr } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      assert.ok(wdr !== null);
      const real = WinISDDriver.fromWdrIni(wdr);
      const noHeader = WinISDDriver.build({}, real.rows(), []);

      assert.deepEqual(wdrDriverDiffs(noHeader, noHeader), [], 'a driver never disagrees with itself, even with an empty header');
      const diffs = wdrDriverDiffs(real, noHeader);
      assert.equal(diffs.length, 1);
      assert.match(diffs[0], /snapshot mismatch/);
    });

    it('jsonRoundTripDiffs reports json-round-trip when the text cannot be parsed back at all', () => {
      assert.deepEqual(jsonRoundTripDiffs(JSON.stringify({ a: 1 }, null, 2)), [], 'a real, well-formed openisd.json round-trips clean');

      const diffs = jsonRoundTripDiffs('{not valid json');
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0].field, 'json-round-trip');
      assert.match(diffs[0].message, /cannot be parsed back/);
    });
  });

  describe('diffWdrValues — as-read values vs the independently-derived record', () => {
    it('reports no mismatch when the .wdr states exactly what the record derives', () => {
      const derived = recordDriver();
      const asRead = WinISDDriver.fromWdrIni(derived.toWdrIni());
      const mismatches = diffWdrValues(asRead, derived);
      assert.deepEqual(mismatches, []);
    });

    it('surfaces a stated value that disagrees with the record as a data-quality signal, not a silent overwrite', () => {
      const derived = recordDriver();
      // Hand-edit Fs in the .wdr text as if WinISD's own editor changed it after export.
      const edited = derived.toWdrIni().replace(/^Fs=40$/m, 'Fs=41.5');
      const asRead = WinISDDriver.fromWdrIni(edited);

      // The mismatch is REPORTED, not silently applied — diffWdrValues never mutates either side.
      const mismatches = diffWdrValues(asRead, derived);
      assert.equal(mismatches.length, 1);
      assert.equal(mismatches[0].field, 'Fs');
      assert.match(mismatches[0].message, /41\.5/);
      assert.match(mismatches[0].message, /40/);

      // Neither WinISDDriver was mutated by the diff.
      assert.equal(asRead.cell('Fs').value, '41.5');
      assert.equal(derived.cell('Fs').value, '40');
    });

    it('does not compare a field the .wdr never stated — only what it asserts', () => {
      const derived = recordDriver();
      // A .wdr the writer never touched Le on — Le is 0 by WinISD's own default, not-available,
      // and must not be treated as an asserted "0" that then falsely disagrees with anything.
      const asRead = WinISDDriver.fromWdrIni(derived.toWdrIni());
      assert.equal(asRead.cell('Le').state, 'not-available');
      const mismatches = diffWdrValues(asRead, derived);
      assert.equal(mismatches.some(m => m.field === 'Le'), false);
    });
  });

  describe('diffWdrValues — a WinISD-stored C value that disagrees with the fresh derivation is flagged', () => {
    it('surfaces the stale Qts=0.500 (C) against the freshly-derived ~0.358 as a warn-level mismatch', () => {
      const sourceWdr = WinISDDriver.fromWdrIni(WDR_TEXT);
      const driver = driverOf(WDR_TEXT);

      const derivedWdr = openIsdDriverToWinIsdDriver(driver, []);
      assert.ok(derivedWdr, 'projection failed');

      const mismatches = diffWdrValues(sourceWdr, derivedWdr);
      const qtsMismatch = mismatches.find(m => m.field === 'Qts');
      assert.ok(qtsMismatch, 'expected a Qts mismatch between the stored C value and the fresh derivation');
      assert.equal(qtsMismatch!.level, 'warn');
      assert.match(qtsMismatch!.message, /0\.5/);
    });
  });
});
