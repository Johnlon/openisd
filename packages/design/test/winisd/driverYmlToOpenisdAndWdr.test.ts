/**
 * `driver.yml` text in → `{ openisd, wdr, errors }` out — the ONE bridge entry `winisd_tools`
 * calls in-process (embedded V8) to generate BOTH derived files for a corpus record.
 *
 * The design is `drivers/drivers.md` Part C, approved by John 2026-08-30. The two ideas that
 * shape these assertions:
 *
 *   - **`scraper_meta` is dropped BY THE TYPE.** `OpenISDDeviceJson` does not declare it, so
 *     serialising through it loses that section structurally. Nothing has to remember to remove
 *     it, and nothing can forget — so the test asserts its absence from the OUTPUT TEXT, which
 *     is the thing a reader of `openisd.yml` actually gets.
 *   - **One call produces both artefacts plus one error array.** Python writes bytes and parses
 *     neither format, so anything this function fails to report is invisible downstream.
 *
 * The fixture is a REAL corpus record, not a hand-built object: a synthetic record proves the
 * function handles what the test author imagined, which is the failure mode this whole migration
 * exists to fix — design had never read a real record.
 *
 * It lives in `packages/design/winisd` and not `packages/design` per John's QO103 ruling ("opt 1",
 * 2026-08-31): winisd already depends on design, so the `.wdr` transformer is reachable here
 * without closing a design → winisd → design cycle.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse, stringify as stringifyYaml } from 'yaml';

import { driverYmlToOpenisdAndWdr } from '../../winisd/driverYmlToOpenisdAndWdr.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus');

/** A real `driver.yml`: Dayton CE28N-4, a woofer-section record carrying `scraper_meta`. */
function daytonDriverYml(): string {
  return readFileSync(join(FIXTURES, 'dayton-ce28n-4.driver.yml'), 'utf8');
}

describe('driverYmlToOpenisdAndWdr — one call, both derived files, one error array', () => {
  it('returns openisd.yml text, wdr text, and an errors array', () => {
    const result = driverYmlToOpenisdAndWdr(daytonDriverYml());

    assert.equal(typeof result.openisd, 'string', 'openisd.yml text');
    assert.equal(typeof result.wdr, 'string', '.wdr text');
    assert.ok(Array.isArray(result.errors), 'errors is always an array, never null');
  });

  it('drops scraper_meta from the emitted openisd.yml', () => {
    const source = daytonDriverYml();
    assert.ok(source.includes('scraper_meta'), 'the fixture must carry scraper_meta, or this proves nothing');

    const { openisd } = driverYmlToOpenisdAndWdr(source);

    assert.ok(openisd !== null, 'a readable record produces openisd.yml');
    assert.ok(!openisd.includes('scraper_meta'), 'scraper_meta must not survive into openisd.yml');
  });

  it('keeps driver.yml key order in openisd.yml, minus scraper_meta', () => {
    const source = daytonDriverYml();
    const sourceKeys = Object.keys(parse(source) as Record<string, unknown>);
    const expected = sourceKeys.filter(k => k !== 'scraper_meta');

    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null, 'a readable record produces openisd.yml');
    const emittedKeys = Object.keys(parse(openisd) as Record<string, unknown>);

    assert.deepEqual(emittedKeys, expected,
      'deterministic ordering: openisd.yml follows driver.yml, per John 2026-08-31');
  });

  it('emits a .wdr whose [Driver] section carries the record brand and model', () => {
    const source = daytonDriverYml();
    const record = parse(source) as { brand: { value: string }; model: { value: string } };

    const { wdr } = driverYmlToOpenisdAndWdr(source);

    assert.ok(wdr!.startsWith('[Driver]'), '.wdr opens its [Driver] section');
    assert.ok(wdr!.includes('Brand=' + record.brand.value), 'Brand row carries the record brand');
    assert.ok(wdr!.includes('Model=' + record.model.value), 'Model row carries the record model');
  });

  it('writes the TRUE wiring in the mandatory VCCon row — parallel=1, series=2 — not WinISD\'s save-bug value', () => {
    // `1` = parallel, `2` = series — docs/design/WINISD_SCHEMA.md §3.2, ParState slot 47,
    // verified against WinISD 2026-06-26. VCCon is mandatory, so a record that states no wiring
    // still gets the row (John, 2026-08-31).
    //
    // The series case is the one that matters: WinISD's own writer always emits VCCon=1 on save
    // whatever the UI shows (§3.2), so a series driver saved by WinISD is indistinguishable from a
    // parallel one. OpenISD writes the true value instead (John, 2026-08-31: "openisd MUST not
    // have same bug"). Asserting 2 here is what stops someone reconciling this function against
    // the oracle file s-connection-serial-2vc.wdr, which carries the bug.
    const stated = (vccon: number | null) => {
      const record = parse(daytonDriverYml()) as { specs: { woofer: Record<string, unknown> } };
      if (vccon === null) delete record.specs.woofer.VCCon;
      else record.specs.woofer.VCCon = {
        origin: 'manufacturer_datasheet',
        readings: { manufacturer_datasheet: { read_value: vccon } },
      };
      const { wdr } = driverYmlToOpenisdAndWdr(stringifyYaml(record));
      return wdr!.split(/\r?\n/).find(l => l.startsWith('VCCon='));
    };

    assert.equal(stated(2), 'VCCon=2', 'a series-wired record writes 2');
    assert.equal(stated(1), 'VCCon=1', 'a parallel-wired record writes 1');
    assert.equal(stated(null), 'VCCon=1', 'the row is present even when the record states no wiring');
  });

  it('projects an APP-AUTHORED record, which carries none of the scraper-only keys', () => {
    // Only brand/model/manufacturer/specs are required. uuid, sku, data_sources, authoritative,
    // quality and product_image describe where a SCRAPE came from, so a driver the app itself
    // authored has none of them — requiring any would force the app to fabricate a scrape that
    // never happened. Every other test here uses a corpus record, which carries all six, so this
    // is the only one that would catch the projection assuming their presence.
    const appAuthored = [
      'brand: {value: Acme, origin: entered}',
      'model: {value: A1, origin: entered}',
      'manufacturer: {value: Acme, origin: entered}',
      'specs:',
      '  woofer:',
      '    Fs:',
      '      origin: entered',
      '      readings: {entered: {read_value: 42}}',
    ].join('\n');

    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(appAuthored);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [], 'nothing blocking');
    assert.ok(openisd !== null, 'openisd.yml is produced');
    assert.ok(wdr !== null, '.wdr is produced');
    assert.ok(wdr.includes('Fs=42'), 'the stated value reaches the .wdr');
  });

  it('STRIPS definition — dead in openisd, and only this bridge removes it', () => {
    // John, 2026-09-01: "definition is 100% dead - it has no place in our openisd work except
    // where I strip it in the bridge". Every metadata envelope, every sku ground and every spec
    // entry in a real driver.yml carries one, so a projection that choked on `definition` would
    // reject the entire corpus, and one that passed it through would put it back in openisd.yml.
    const withDefinitions = [
      'uuid: {value: 00000000-0000-4000-8000-000000000000}',
      'brand: {value: Acme, origin: manufacturer_datasheet, definition: "who sells it"}',
      'model: {value: A1, origin: manufacturer_datasheet, definition: "the model name"}',
      'manufacturer: {value: Acme, origin: manufacturer_datasheet, definition: "who makes it"}',
      'sku: {value: A1-8, grounds: [{origin: manufacturer_datasheet, reading: "A1-8", definition: "how the sku was formed"}]}',
      'driver_type: {value: woofer, origin: manufacturer_datasheet, definition: "the kind"}',
      'authoritative: {value: manufacturer_datasheet}',
      // Required by the schema though the pydantic model calls all three optional — QO113.
      "provided_by: {value: '', origin: manufacturer_datasheet, definition: \"who supplied it\"}",
      "comment: {value: '', origin: manufacturer_datasheet}",
      "added: {value: '2026-09-01', origin: manufacturer_datasheet}",
      'data_sources: {value: {manufacturer_datasheet: "https://example.invalid/ds.pdf"}}',
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      'specs:',
      '  woofer:',
      '    Fs:',
      '      origin: manufacturer_datasheet',
      '      definition: "resonance in free air"',
      '      readings:',
      '        manufacturer_datasheet: {actual_reading: "42 Hz", read_value: 42, read_precision: 1}',
    ].join('\n');

    const { openisd, errors } = driverYmlToOpenisdAndWdr(withDefinitions);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [], 'nothing blocking');
    assert.ok(openisd !== null, 'openisd.yml is produced');
    assert.equal(/(^|\s)definition:/m.test(openisd), false,
      'definition reached the emitted openisd.yml');
  });

  it('reports a parse failure as an error rather than throwing', () => {
    const result = driverYmlToOpenisdAndWdr(': : : not yaml : :');

    assert.equal(result.wdr, null, 'no .wdr from a record that could not be read');
    assert.ok(result.errors.length > 0, 'the reason reaches the caller');
    assert.ok(result.errors.some(e => e.level === 'error'), 'a blocking failure is level:error');
  });
});
