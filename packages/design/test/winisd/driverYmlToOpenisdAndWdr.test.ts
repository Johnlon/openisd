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

  it('projects an APP-AUTHORED record — every field marked entered, none scraped', () => {
    // A driver a person typed into the app. It is still a RECORD: openisd.yml is driver.yml minus
    // `scraper_meta` and `definition`, plus `dq_calculated` (John, 2026-09-01), so the ten fields
    // `DriverFile` requires are required of it too. What differs is PROVENANCE — every origin is
    // `entered`, nothing claims a datasheet said it — and that `scraper_meta` was never there to
    // drop. This is the only test here not using a corpus record, so it is the one that would
    // catch the projection assuming a scrape happened.
    const appAuthored = [
      'uuid: {value: 00000000-0000-4000-8000-000000000000}',
      'brand: {value: Acme, origin: entered}',
      'model: {value: A1, origin: entered}',
      'manufacturer: {value: Acme, origin: entered}',
      'sku: {value: A1-8, grounds: [{origin: entered, reading: A1-8}]}',
      'driver_type: {value: woofer, origin: entered}',
      'authoritative: {value: entered}',
      'data_sources: {value: {}}',
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      "provided_by: {value: 'A Community Contributor', origin: entered}",
      "comment: {value: '', origin: entered}",
      "added: {value: '2026-09-01', origin: entered}",
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
    assert.ok(!openisd.includes('scraper_meta'), 'nothing invents a scrape that never happened');
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

  it('projects a PASSIVE RADIATOR: openisd.yml yes, wdr null, and NOT an error', () => {
    // `drivers.md` Part C: "A passive radiator returns `wdr: null` with no error — WinISD has no
    // PR format — but MUST still get `dq_calculated`." A radiator refused as "neither a woofer nor
    // a tweeter" is the driver seam answering a question nobody asked of it: 78 of the corpus's
    // records are radiators, and every one of them needs its openisd.yml.
    const radiator = [
      'uuid: {value: 00000000-0000-4000-8000-000000000001}',
      'brand: {value: Dayton Audio, origin: manufacturer_datasheet}',
      'model: {value: DSA175-PR, origin: manufacturer_datasheet}',
      'manufacturer: {value: Dayton Audio, origin: manufacturer_datasheet}',
      'sku: {value: DSA175-PR, grounds: [{origin: manufacturer_datasheet, reading: DSA175-PR}]}',
      'driver_type: {value: passive-radiator, origin: manufacturer_datasheet}',
      'authoritative: {value: manufacturer_datasheet}',
      "data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}}",
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      "provided_by: {value: '', origin: manufacturer_datasheet}",
      "comment: {value: '', origin: manufacturer_datasheet}",
      "added: {value: '2026-09-01', origin: manufacturer_datasheet}",
      'specs:',
      '  passive-radiator:',
      '    Fs:',
      '      origin: manufacturer_datasheet',
      '      readings: {manufacturer_datasheet: {actual_reading: "24 Hz", read_value: 24, read_precision: 0.5}}',
      '    Sd:',
      '      origin: manufacturer_datasheet',
      '      readings: {manufacturer_datasheet: {actual_reading: "137 cm2", read_value: 0.0137, read_precision: 0.5}}',
    ].join('\n');

    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(radiator);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [],
      'a radiator having no .wdr is the CONTRACT, not a failure');
    assert.ok(openisd !== null, 'the radiator still gets its openisd.yml');
    assert.equal(wdr, null, 'WinISD has no passive-radiator format');
  });

  it('a PASSIVE RADIATOR gets dq_calculated too — Part C says it must', () => {
    // `drivers.md` Part C: a radiator "returns `wdr: null` with no error … but MUST still get
    // `dq_calculated`". The bridge conformed the record and threw the radiator away, so all 78
    // radiators in the corpus carried no marks at all
    // (bugs/BUG_20260902_the_bridge_derived_nothing…). Sd of 9 m² is far outside any real
    // radiator, so a range mark is the expected finding.
    const radiator = [
      'uuid: {value: 00000000-0000-4000-8000-000000000002}',
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      'manufacturer: {value: Dayton Audio, origin: entered}',
      'brand: {value: Dayton Audio, origin: entered}',
      'model: {value: DSA175-PR, origin: entered}',
      'sku: {value: DSA175-PR, grounds: [{origin: entered, reading: DSA175-PR}]}',
      'driver_type: {value: passive-radiator, origin: entered}',
      'data_sources: {value: {}}',
      'authoritative: {value: entered}',
      "provided_by: {value: '', origin: entered}",
      "comment: {value: '', origin: entered}",
      "added: {value: '2026-09-01', origin: entered}",
      'specs:',
      '  passive-radiator:',
      '    Sd:',
      '      origin: entered',
      '      readings: {entered: {read_value: 9}}',
    ].join('\n');

    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(radiator);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [], 'a radiator is not an error');
    assert.equal(wdr, null, 'WinISD has no passive-radiator format');
    assert.ok(openisd !== null && openisd.includes('dq_calculated'),
      'the radiator was conformed and then discarded — no marks reached its openisd.yml');
  });

  it('the emitted openisd.yml survives its own text round trip — A1 === A2, I1 === I2', () => {
    // drivers.md Part C step 6. The bridge writes TEXT, and a reader of that text must get back
    // what the bridge held. Parse the emitted yaml and re-serialise it: any difference means the
    // writer and the reader disagree, and every openisd.yml on disk is then a lossy copy of a
    // record nobody can reconstruct.
    const { openisd } = driverYmlToOpenisdAndWdr(daytonDriverYml());
    assert.ok(openisd !== null);

    const I2 = parse(openisd);                 // text A1 -> record I2
    const A2 = stringifyYaml(I2);              // record I2 -> text A2
    assert.deepEqual(I2, parse(A2), 'I2 !== the record A2 parses back to');
    assert.equal(A2, openisd, 'A1 !== A2 — the yaml writer and reader disagree');
  });

  it('the emitted openisd.yml differs from driver.yml ONLY by the keys we drop', () => {
    // The most basic check there is: openisd.yml IS driver.yml minus `scraper_meta`, minus every
    // `definition`, plus `dq_calculated` (John, 2026-09-01). Anything else that changed is a
    // silent loss, and this is the assertion that names it.
    const source = daytonDriverYml();
    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null);

    const strip = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(strip);
      if (v === null || typeof v !== 'object') return v;
      return Object.fromEntries(Object.entries(v as Record<string, unknown>)
        .filter(([k]) => k !== 'definition' && k !== 'scraper_meta' && k !== 'dq_calculated')
        .map(([k, x]) => [k, strip(x)]));
    };

    assert.deepEqual(strip(parse(openisd)), strip(parse(source)),
      'openisd.yml differs from driver.yml by something other than the three keys');
  });

  it('a record with NO device section reports BOTH seams\' refusals, not just the driver\'s', () => {
    // `specs: {}` is neither a driver nor a radiator, so both seams refuse it. Reporting only the
    // driver seam's complaint tells a reader half of why the record is unusable: it names the
    // missing woofer/tweeter and stays silent about the missing passive-radiator section.
    const noSection = [
      'uuid: {value: 00000000-0000-4000-8000-000000000003}',
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      'manufacturer: {value: Dayton Audio, origin: entered}',
      'brand: {value: Dayton Audio, origin: entered}',
      'model: {value: NOTHING, origin: entered}',
      'sku: {value: NOTHING, grounds: [{origin: entered, reading: NOTHING}]}',
      'driver_type: {value: woofer, origin: entered}',
      'data_sources: {value: {}}',
      'authoritative: {value: entered}',
      "provided_by: {value: '', origin: entered}",
      "comment: {value: '', origin: entered}",
      "added: {value: '2026-09-01', origin: entered}",
      'specs: {}',
    ].join('\n');

    const { wdr, errors } = driverYmlToOpenisdAndWdr(noSection);
    const messages = errors.filter(e => e.level === 'error').map(e => e.message);

    assert.equal(wdr, null, 'nothing to simulate, so no .wdr');
    assert.ok(messages.some(m => m.includes('neither a woofer nor a tweeter')),
      'the driver seam\'s refusal reaches the caller');
    assert.ok(messages.some(m => m.includes('not a radiator')),
      'the radiator seam\'s refusal was thrown away');
  });

  it('a record that is TWO THINGS AT ONCE reports that once, not twice', () => {
    // Both seams produce the same sentence for this shape, so concatenating them without
    // de-duplicating would show a reader the identical complaint twice.
    const both = [
      'uuid: {value: 00000000-0000-4000-8000-000000000004}',
      'quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}',
      'manufacturer: {value: Dayton Audio, origin: entered}',
      'brand: {value: Dayton Audio, origin: entered}',
      'model: {value: BOTH, origin: entered}',
      'sku: {value: BOTH, grounds: [{origin: entered, reading: BOTH}]}',
      'driver_type: {value: woofer, origin: entered}',
      'data_sources: {value: {}}',
      'authoritative: {value: entered}',
      "provided_by: {value: '', origin: entered}",
      "comment: {value: '', origin: entered}",
      "added: {value: '2026-09-01', origin: entered}",
      'specs:',
      '  woofer:',
      '    Sd:',
      '      origin: entered',
      '      readings: {entered: {read_value: 0.0137}}',
      '  passive-radiator:',
      '    Sd:',
      '      origin: entered',
      '      readings: {entered: {read_value: 0.0137}}',
    ].join('\n');

    const { errors } = driverYmlToOpenisdAndWdr(both);
    const twoThings = errors.filter(e => e.message.includes('two things at once'));

    assert.equal(twoThings.length, 1, 'the identical refusal was reported by both seams');
  });

  it('the .wdr survives text -> WinISDDriver -> record -> driver -> WinISDDriver -> text', () => {
    // The extended .wdr round trip John asked for: T1 -> W2 -> I3 -> W3 -> T2. Read our own
    // output back into a WinISDDriver (W2), project THAT into a record (I3) and a domain driver,
    // rebuild a WinISDDriver from it (W3), and re-serialise (T2). W2 and W3 must agree — going
    // out to a record and back must not lose or invent anything W2 already stated.
    //
    // Asserted here on the ERROR the bridge itself must raise on this path — a field named
    // `wdr-record-round-trip`, distinct from the simpler text-only `wdr-round-trip` check, so a
    // reader of the errors array can tell which leg of the round trip broke.
    const { wdr, errors } = driverYmlToOpenisdAndWdr(daytonDriverYml());
    assert.ok(wdr !== null);
    const rtErrors = errors.filter(e => e.field === 'wdr-record-round-trip');
    assert.deepEqual(rtErrors, [], `unexpected: ${JSON.stringify(rtErrors)}`);
    // Non-vacuity: the field name itself must be one the bridge actually emits somewhere, or this
    // assertion passes for the wrong reason (nothing ever produces that field, ever).
    assert.ok(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'winisd', 'driverYmlToOpenisdAndWdr.ts'), 'utf8')
        .includes("'wdr-record-round-trip'"),
      'the bridge source does not mention this field at all — the check does not exist yet',
    );
  });

  it('reports a parse failure as an error rather than throwing', () => {
    const result = driverYmlToOpenisdAndWdr(': : : not yaml : :');

    assert.equal(result.wdr, null, 'no .wdr from a record that could not be read');
    assert.ok(result.errors.length > 0, 'the reason reaches the caller');
    assert.ok(result.errors.some(e => e.level === 'error'), 'a blocking failure is level:error');
  });
});
