import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {DriverRoundTripCheck} from '../../domain/driverRoundTripDiffs.js';
import {OpenISDDriver} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';
import {type WdrHeader, WinISDDriver} from '../../winisd/winisdDriver.js';

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

describe('wdrRecordRoundTripDiffs', () => {
  describe('wdrRecordRoundTripDiffs — the .wdr -> record leg refusing to read back', () => {
    it('reports wdr-record-round-trip when the .wdr we hold reads back as a record the driver seam refuses', () => {
      const engine = createEngine();
      const { openisd, wdr } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      assert.ok(openisd !== null && wdr !== null);

      const driver1 = OpenISDDriver.fromConformingRecord(JSON.parse(openisd), engine);
      assert.ok(!Array.isArray(driver1), 'the Dayton fixture must build a valid driver, or this proves nothing');

      const w2 = WinISDDriver.fromWdrIni(wdr);
      // Corrupt ONE mandatory row's stated value so the .wdr -> record leg fails the schema that
      // built driver1 in the first place — proving the branch that reports this, not a real
      // Dayton defect (the untouched .wdr round-trips cleanly; see the test above).
      const corruptRows = w2.rows().map(([key, cell]) =>
        key === 'Qts' ? [key, { value: 'not-a-number', state: 'entered' }] as const : [key, cell] as const
      );
      const header = (['brand', 'model', 'manufacturer', 'providedBy', 'comment', 'dateAdded'] as const)
        .reduce<WdrHeader>((acc, field) => {
          const value = w2.headerField(field);
          if (value !== undefined) acc[field] = value;
          return acc;
        }, {});
      const corruptW2 = WinISDDriver.build(header, corruptRows, []);

      const diffs = new DriverRoundTripCheck(engine).wdrRecordRoundTripDiffs(driver1, corruptW2);

      assert.equal(diffs.length, 1, `expected exactly one diff, got: ${JSON.stringify(diffs)}`);
      assert.equal(diffs[0].field, 'wdr-record-round-trip');
      assert.match(diffs[0].message, /the \.wdr we wrote reads back as a record the driver seam refuses/);
    });

    it('reports a genuine mismatch through the success-path map when driver1 and w2 come from different real records', () => {
      // Both fixtures individually build a valid driver and a valid .wdr — the disagreement here is
      // real content (Dayton vs ScanSpeak), not a corrupted row, so this exercises the `.map()` over
      // `oidDriverDiffs`/`wdrDriverDiffs` on the success path, past the `Array.isArray(driver3)` guard
      // the test above covers.
      const engine = createEngine();
      const daytonParsed = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      const scanspeakParsed = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(scanspeakDriverYml());
      assert.ok(daytonParsed.openisd !== null && scanspeakParsed.wdr !== null);

      const driver1 = OpenISDDriver.fromConformingRecord(JSON.parse(daytonParsed.openisd), engine);
      assert.ok(!Array.isArray(driver1), 'the Dayton fixture must build a valid driver, or this proves nothing');
      const w2 = WinISDDriver.fromWdrIni(scanspeakParsed.wdr);

      const diffs = new DriverRoundTripCheck(engine).wdrRecordRoundTripDiffs(driver1, w2);

      assert.ok(diffs.length > 0, 'a Dayton driver1 paired with a ScanSpeak w2 must disagree');
      assert.ok(diffs.every((d) => d.field === 'wdr-record-round-trip'), `expected every diff field to be wdr-record-round-trip, got: ${JSON.stringify(diffs)}`);
    });
  });
});
