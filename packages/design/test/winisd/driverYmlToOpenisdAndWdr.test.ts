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
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse, stringify as stringifyYaml} from 'yaml';

import {driverYmlToOpenisdAndWdr} from '../../domain/driverYmlToOpenisdAndWdr.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '../../domain/index.js';
import {Engine} from '../../engine/index.js';
import {checkOpenisdRoundTrip} from '../../../../scripts/roundTripGate.mjs';

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

  it('drops a rejected reading from a multi-source spec entry (John, 2026-09-05)', () => {
    // Real record: Scan-Speak 15W/4424G00. Re has three sources; the datasheet's own OCR
    // misread the ohm glyph as a digit, so that ONE reading is `rejected:
    // ohm-glyph-merged-as-digit` while the listing and product pages agree on the true value.
    // A rejected reading is scraper diagnostic evidence for `driver.yml` — never a value the
    // app should see, so it must not survive into openisd.yml at all.
    const source = readFileSync(
      join(FIXTURES, 'scanspeak-15w-4424g00.driver.yml'), 'utf8');
    assert.ok(source.includes('rejected: ohm-glyph-merged-as-digit'),
      'the fixture must carry a rejected reading, or this proves nothing');

    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null, 'a readable record produces openisd.yml');

    assert.ok(!openisd.includes('rejected'),
      'a rejected reading must not survive into openisd.yml');
    assert.ok(!openisd.includes('ohm-glyph-merged-as-digit'),
      'the rejected reading\'s own entry must be dropped entirely, not just its `rejected` key');

    const reEntry = (parse(openisd) as {
      specs: { woofer: { Re_ohm: { readings: Record<string, unknown> } } }
    }).specs.woofer.Re_ohm;
    assert.deepEqual(Object.keys(reEntry.readings).sort(),
      ['manufacturer_listing_page', 'manufacturer_product_page'],
      'the two USABLE readings survive; only the rejected one is removed');
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
      '    Fs_hz:',
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
      '    Fs_hz:',
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
      '    Fs_hz:',
      '      origin: manufacturer_datasheet',
      '      readings: {manufacturer_datasheet: {actual_reading: "24 Hz", read_value: 24, read_precision: 0.5}}',
      '    Sd_m2:',
      '      origin: manufacturer_datasheet',
      '      readings: {manufacturer_datasheet: {actual_reading: "137 cm2", read_value: 0.0137, read_precision: 0.5}}',
    ].join('\n');

    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(radiator);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [],
      'a radiator having no .wdr is the CONTRACT, not a failure');
    assert.ok(openisd !== null, 'the radiator still gets its openisd.yml');
    assert.equal(wdr, null, 'WinISD has no passive-radiator format');
  });

  it('a PASSIVE RADIATOR is written as the app\'s own export of it — the same seam a driver goes through', () => {
    // `drivers.md` Part C once said a radiator "MUST still get `dq_calculated`" — the bridge's own
    // range marks (Sd of 9 m² was the expected finding). Since 2026-09-20 (John, option A) there
    // is ONE producer of `dq_calculated`: the app. A radiator's openisd.yml is what the app
    // exports for it, marks included whenever the app writes any, and range marks are no longer
    // written to the corpus at all. Fixed point: load what was written, export, nothing changes.
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
      '    Sd_m2:',
      '      origin: entered',
      '      readings: {entered: {read_value: 9}}',
    ].join('\n');

    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(radiator);

    assert.deepEqual(errors.filter(e => e.level === 'error'), [], 'a radiator is not an error');
    assert.equal(wdr, null, 'WinISD has no passive-radiator format');
    assert.ok(openisd !== null);
    const emitted = parse(openisd) as Record<string, unknown>;
    assert.equal(checkOpenisdRoundTrip(emitted, 'dsa175-pr').ok, true, 'the bundler gate refuses what the bridge wrote');
    const loaded = OpenISDPassiveRadiatorStandalone.fromConformingRecord(emitted, new Engine());
    assert.ok(!Array.isArray(loaded), 'the app reads the radiator the bridge wrote');
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.toOpenIsdDeviceJson())), emitted,
      'the radiator on disk is not the radiator the app exports for it');
  });

  it('ONE dq_calculated PRODUCER: the emitted openisd.yml is the app\'s own export of the record (John, 2026-09-20, option A)', () => {
    // The scraper pipeline writes whatever this bridge returns. Until 2026-09-20 the bridge wrote
    // its own `dq_calculated` (range marks, `dqCalculated.ts`) while the app, on loading the same
    // record, wrote a different list (the solver's consistency findings) — so the bundler's
    // round-trip gate (`scripts/roundTripGate.mjs`) refused every record the two disagreed on.
    // Now the bridge loads the record exactly as the app does and emits what the app exports:
    // the marks the app would write are the marks on disk, and every record it writes passes
    // the gate by construction.
    const source = daytonDriverYml();
    const { openisd, errors } = driverYmlToOpenisdAndWdr(source);
    assert.deepEqual(errors.filter(e => e.level === 'error'), []);
    assert.ok(openisd !== null);

    const emitted = parse(openisd) as Record<string, unknown>;
    const gate = checkOpenisdRoundTrip(emitted, 'dayton');
    assert.equal(gate.ok, true, `the bundler gate refuses what the bridge wrote: ${'message' in gate ? gate.message : ''}`);

    // A FIXED POINT: loading what the bridge wrote and exporting it again changes nothing —
    // marks, calculated entries, everything. That is what "the app's own export" means.
    const loaded = OpenISDDriver.fromConformingRecord(emitted, new Engine());
    assert.ok(!Array.isArray(loaded), 'the app reads what the bridge wrote');
    assert.deepEqual(JSON.parse(JSON.stringify(loaded.toOpenIsdDeviceJson())), emitted,
      'the record on disk is not the record the app exports for it');
  });

  it('a dq_calculated the SCRAPER sent in never reaches openisd.yml — the app is the only producer', () => {
    // The scraper's driver.yml is not a producer of `dq_calculated`; anything it carries under
    // that key (an old pipeline's range marks, a hand edit, a stale copy of a previous
    // openisd.yml) is not the app's finding and must not be written as one — `dq_calculated`
    // is not in the driver.yml schema at all (John, 2026-09-20). Three entries: one the app has
    // a finding for (Qts alone — no Qes/Qms to check it against), one it has none for (Sd), and
    // one the solver never touches (weight_kg — not a driver quantity, so loading a record does
    // not recompute it; only the boundary can keep it out). The stale mark must vanish from all.
    const record = parse(daytonDriverYml()) as { specs: { woofer: Record<string, Record<string, unknown>> } };
    const stale = { kind: 'range', severity: 'error', rule: 'range-above-max', params: {}, detail: 'STALE-MARK' };
    record.specs.woofer.Sd_m2.dq_calculated = [{ ...stale, detail: 'STALE-MARK-SD' }];
    record.specs.woofer.Qts.dq_calculated = [{ ...stale, detail: 'STALE-MARK-QTS' }];
    record.specs.woofer.weight_kg.dq_calculated = [{ ...stale, detail: 'STALE-MARK-WEIGHT' }];
    const withStaleMarks = stringifyYaml(record);
    assert.ok(
      withStaleMarks.includes('STALE-MARK-SD') && withStaleMarks.includes('STALE-MARK-QTS') && withStaleMarks.includes('STALE-MARK-WEIGHT'),
      'the fixture must carry the stale marks',
    );
    const { openisd, wdr, errors } = driverYmlToOpenisdAndWdr(withStaleMarks);
    assert.deepEqual(errors.filter(e => e.level === 'error'), []);
    assert.ok(openisd !== null && wdr !== null);
    assert.equal(openisd.includes('STALE-MARK'), false, 'a scraper-supplied dq_calculated reached openisd.yml');
    assert.equal(wdr.includes('STALE-MARK'), false, 'a scraper-supplied dq_calculated reached the .wdr comment');
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
    // `definition`, minus `origin` on a top-level metadata field, plus what the app's own export
    // adds (John, 2026-08-31, 2026-09-01, 2026-09-05, 2026-09-20 option A): `dq_calculated`, the
    // `state`/`value` pair on every entered spec entry, and the `state: C` entries the solver
    // derives on load. Anything else that changed is a silent loss, and this is the assertion
    // that names it.
    const source = daytonDriverYml();
    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null);

    // metadata field `origin` is dropped, but a spec entry's `origin` (which says which source
    // won) and `sku.grounds[].origin` are NOT — so this can't be a blind key filter, it has to
    // walk the same shape `stripMetadataOrigin` does.
    const METADATA_FIELDS = new Set([
      'manufacturer', 'brand', 'model', 'driver_type', 'series', 'nominal_size_cm',
      'product_image', 'description', 'surround_material', 'provided_by', 'comment', 'added',
    ]);
    const isCalculatedEntry = (v: unknown): boolean =>
      v !== null && typeof v === 'object' && !Array.isArray(v) && (v as { state?: unknown }).state === 'C';
    const stripDeep = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(stripDeep);
      if (v === null || typeof v !== 'object') return v;
      return Object.fromEntries(Object.entries(v as Record<string, unknown>)
        .filter(([k, x]) => k !== 'definition' && k !== 'scraper_meta'
          && k !== 'dq_calculated' && k !== 'state' && k !== 'value' && !isCalculatedEntry(x))
        .map(([k, x]) => [k, stripDeep(x)]));
    };
    const stripMetadataOriginForTest = (record: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(Object.entries(record).map(([k, v]) => {
        if (!METADATA_FIELDS.has(k) || typeof v !== 'object' || v === null) return [k, v];
        const { origin: _origin, ...rest } = v as Record<string, unknown>;
        return [k, rest];
      }));

    const openisdRecord = stripDeep(parse(openisd)) as Record<string, unknown>;
    const sourceRecord = stripMetadataOriginForTest(
      stripDeep(parse(source)) as Record<string, unknown>);

    assert.deepEqual(openisdRecord, sourceRecord,
      'openisd.yml differs from driver.yml by something other than the documented drops');
  });

  it('a record with NO device section is refused ONCE, by the schema, naming both shapes it could have taken', () => {
    // `specs: {}` is neither a driver nor a radiator. `specs` is a sum type, so the parse itself
    // refuses the record — before either seam sees it — and its one message names the two shapes
    // a record may take, so a reader learns the whole of why the record is unusable.
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
    const shape = messages.filter(m => m.includes("'specs'") && m.includes('woofer') && m.includes('passive-radiator'));
    assert.equal(shape.length, 1, `one refusal on 'specs' naming both shapes, got: ${messages.join(' | ')}`);
    assert.ok(!messages.some(m => m.includes('no woofer section') || m.includes('not a radiator')),
      'a seam restated the schema\'s refusal second-hand');
  });

  it('a record that is TWO THINGS AT ONCE reports that once, not twice', () => {
    // The schema refuses a `specs` carrying both sections at the parse; neither seam then gets
    // to restate it, so a reader sees the one complaint, not the same fact from two sides.
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
      '    Sd_m2:',
      '      origin: entered',
      '      readings: {entered: {read_value: 0.0137}}',
      '  passive-radiator:',
      '    Sd_m2:',
      '      origin: entered',
      '      readings: {entered: {read_value: 0.0137}}',
    ].join('\n');

    const { errors } = driverYmlToOpenisdAndWdr(both);
    const twoThings = errors.filter(e => e.message.includes("'specs'") && e.message.includes('not both'));

    assert.equal(twoThings.length, 1, `the refusal was reported ${twoThings.length} times: ${errors.map(e => e.message).join(' | ')}`);
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
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'domain', 'driverYmlToOpenisdAndWdr.ts'), 'utf8')
        .includes('wdr-record-round-trip'),
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
