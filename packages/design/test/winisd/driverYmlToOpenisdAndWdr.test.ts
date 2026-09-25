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
 * The function under test lives in `packages/design/domain/driverYmlToOpenisdAndWdr.ts`, on the
 * design side of the design/winisd boundary (John's QO103 ruling, "opt 1", 2026-08-31) — it calls
 * `../winisd`'s `.wdr` transformer, not the other way round. This test file sits under
 * `test/winisd` because it exercises both output legs (openisd AND wdr), not because the source
 * does.
 *
 * D9/D10/D11: the bridge is the sole producer of `origin`/`corroboration`/`state`/`value` on a
 * spec entry — it never trusts a scraped pick, computing both itself from `readings` even when
 * the scraper input still carries a stale pair (`winisd_tools` stopped writing them; old
 * `driver.json` files scraped before that cutover still do).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse, stringify as stringifyYaml} from 'yaml';

import {
  driverYmlToOpenisdAndWdr,
  winIsdDriverTextToOpenIsdDriver,
  wdrDriverDiffs,
  oidDriverDiffs,
  textRoundTripDiff,
  wdrRecordRoundTripDiffs,
  jsonRoundTripDiffs,
} from '../../domain/driverYmlToOpenisdAndWdr.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '../../domain/index.js';
import {Engine} from '../../engine/index.js';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {checkOpenisdRoundTrip} from '../../../../scripts/roundTripGate.mjs';

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

  it('emits openisd.json keys sorted alphabetically — deterministic bytes, not driver.yml order', () => {
    // John, 2026-09-20: the JSON emitter sorts keys A→Z so the emitted TEXT is canonical. Two
    // records that CARRIED the same data in different insertion orders now produce byte-identical
    // files, and `JSON.parse(text)` → `JSON.stringify` reproduces the very bytes. The old
    // invariant (openisd followed driver.yml's order, per 2026-08-31) is replaced by sorted order.
    const source = daytonDriverYml();
    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null, 'a readable record produces openisd.json');

    const emitted = Object.keys(parse(openisd) as Record<string, unknown>);
    assert.deepEqual(emitted, [...emitted].sort(),
      'top-level keys are alphabetical');
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
      '      readings: {manufacturer_datasheet: {actual_reading: "24 Hz", read_value: 24, read_precision: 0.5}}',
      '    Sd_m2:',
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

  it('the emitted openisd.json survives its own text round trip — A1 === A2, I1 === I2', () => {
    // drivers.md Part C step 6. The bridge writes TEXT, and a reader of that text must get back
    // what the bridge held. Parse the emitted JSON and re-serialise it: any difference means the
    // writer and the reader disagree, and every openisd.json on disk is then a lossy copy of a
    // record nobody can reconstruct.
    const { openisd } = driverYmlToOpenisdAndWdr(daytonDriverYml());
    assert.ok(openisd !== null);

    const I2 = JSON.parse(openisd);            // text A1 -> record I2
    const A2 = JSON.stringify(I2, null, 2);    // record I2 -> text A2
    assert.deepEqual(I2, JSON.parse(A2), 'I2 !== the record A2 parses back to');
    assert.equal(A2, openisd, 'A1 !== A2 — the JSON writer and reader disagree');
    assert.equal(openisd, openisd, 'self equality is trivial');
  });

  it('the emitted openisd.yml differs from driver.yml ONLY by the keys we drop', () => {
    // The most basic check there is: openisd.yml IS driver.yml minus `scraper_meta`, minus every
    // `definition`, minus `origin` on a top-level metadata field, plus what the app's own export
    // adds (John, 2026-08-31, 2026-09-01, 2026-09-05, 2026-09-20 option A, D9/D11): `dq_calculated`,
    // the `state`/`value` pair on every entered spec entry, the `state: C` entries the solver
    // derives on load, and — since driver.yml stopped carrying them (D15) — the `origin`/
    // `corroboration` a spec entry now gets computed for it here rather than supplied. Anything
    // else that changed is a silent loss, and this is the assertion that names it.
    const source = daytonDriverYml();
    const { openisd } = driverYmlToOpenisdAndWdr(source);
    assert.ok(openisd !== null);

    const isCalculatedEntry = (v: unknown): boolean =>
      v !== null && typeof v === 'object' && !Array.isArray(v) && (v as { state?: unknown }).state === 'C';
    const stripDeep = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(stripDeep);
      if (v === null || typeof v !== 'object') return v;
      return Object.fromEntries(Object.entries(v as Record<string, unknown>)
        .filter(([k, x]) => k !== 'definition' && k !== 'scraper_meta' && k !== 'origin'
          && k !== 'corroboration' && k !== 'dq_calculated' && k !== 'state' && k !== 'value'
          && !isCalculatedEntry(x))
        .map(([k, x]) => [k, stripDeep(x)]));
    };

    const openisdRecord = stripDeep(parse(openisd)) as Record<string, unknown>;
    const sourceRecord = stripDeep(parse(source)) as Record<string, unknown>;

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

  it('reports a parse failure as ONE clean error rather than a garbled fallback-validation list', () => {
    const result = driverYmlToOpenisdAndWdr(': : : not yaml : :');

    assert.equal(result.openisd, null, 'no openisd.yml from a record that could not be read');
    assert.equal(result.wdr, null, 'no .wdr from a record that could not be read');
    // Regression: driverYmlToOpenisdRecord used to hand back a bare DriverError object, which the
    // caller told apart from a real record with isRecord() — a check a DriverError, being itself a
    // plain object, always passed too. The YAML-parse failure fell through into
    // OpenISDDriver.fromConformingRecord() as if it were the record, producing a pile of unrelated
    // schema-validation errors instead of the one clean message below.
    assert.equal(result.errors.length, 1, 'the parse failure is the ONLY error reported');
    assert.equal(result.errors[0].level, 'error');
    assert.match(result.errors[0].message, /^could not parse as YAML: /);
  });

  it('a driver.yml that parses to null is refused, naming "null" rather than crashing on .specs', () => {
    const result = driverYmlToOpenisdAndWdr('');

    assert.equal(result.openisd, null);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /parsed to null, not a record/);
  });

  it('a driver.yml that parses to a scalar is refused, naming its typeof', () => {
    const result = driverYmlToOpenisdAndWdr('42');

    assert.equal(result.openisd, null);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /parsed to number, not a record/);
  });

  it('a non-object `specs` passes through unchanged rather than crashing the reject-readings walk', () => {
    const result = driverYmlToOpenisdAndWdr('specs: 5\n');

    // Not a valid record either way — this is about surviving the walk, not about `specs: 5`
    // becoming a usable driver.
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0, 'a record with no mandatory fields is refused');
  });

  it('a non-object spec SECTION passes through unchanged rather than crashing the reject-readings walk', () => {
    const result = driverYmlToOpenisdAndWdr('specs:\n  woofer: 5\n');

    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0, 'a record with no mandatory fields is refused');
  });
});

describe('winIsdDriverTextToOpenIsdDriver — the reverse direction, for .wdr/.owdr import', () => {
  it('a .wdr with a stated field the driver schema rejects reads back as errors, not a driver', () => {
    const engine = new Engine();
    const { wdr } = driverYmlToOpenisdAndWdr(daytonDriverYml());
    assert.ok(wdr !== null);
    // Corrupt a mandatory, ParState-E ("Q") row so the record this text reads back as fails the
    // same schema that accepted the untouched fixture — a real .wdr's own reader disagreeing with
    // the driver seam, not a defect in the Dayton fixture (see the round-trip test above).
    const corrupted = wdr.replace(/^Qts=.*$/m, 'Qts=not-a-number');

    const { value, errors } = winIsdDriverTextToOpenIsdDriver(corrupted, engine);

    assert.equal(value, null, 'a driver with an unparseable mandatory field cannot be built');
    assert.ok(errors.some(e => e.field === 'driver'), `expected a 'driver' field error, got: ${JSON.stringify(errors)}`);
  });
});

describe('the diff primitives — each mismatch arm exercised directly, per their own doc comments', () => {
  it('wdrDriverDiffs reports a snapshot mismatch between two different real .wdr outputs', () => {
    const a = driverYmlToOpenisdAndWdr(daytonDriverYml());
    const b = driverYmlToOpenisdAndWdr(scanspeakDriverYml());
    assert.ok(a.wdr !== null && b.wdr !== null, 'both fixtures must produce a .wdr, or this proves nothing');

    const wa = WinISDDriver.fromWdrIni(a.wdr);
    const wb = WinISDDriver.fromWdrIni(b.wdr);

    assert.deepEqual(wdrDriverDiffs(wa, wa), [], 'a driver never disagrees with itself');
    const diffs = wdrDriverDiffs(wa, wb);
    assert.equal(diffs.length, 1);
    assert.match(diffs[0], /snapshot mismatch/);
  });

  it('oidDriverDiffs reports a snapshot mismatch between two different real OpenISD drivers', () => {
    const engine = new Engine();
    const daytonParsed = driverYmlToOpenisdAndWdr(daytonDriverYml());
    const scanspeakParsed = driverYmlToOpenisdAndWdr(scanspeakDriverYml());
    assert.ok(daytonParsed.openisd !== null && scanspeakParsed.openisd !== null);

    const daytonRecord = JSON.parse(daytonParsed.openisd);
    const scanspeakRecord = JSON.parse(scanspeakParsed.openisd);
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
    const { wdr } = driverYmlToOpenisdAndWdr(daytonDriverYml());
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

describe('wdrRecordRoundTripDiffs — the .wdr -> record leg refusing to read back', () => {
  it('reports wdr-record-round-trip when the .wdr we hold reads back as a record the driver seam refuses', () => {
    const engine = new Engine();
    const { openisd, wdr } = driverYmlToOpenisdAndWdr(daytonDriverYml());
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
    const header = Object.fromEntries(
      (['brand', 'model', 'manufacturer', 'providedBy', 'comment', 'dateAdded'] as const)
        .map((field) => [field, w2.headerField(field)])
        .filter(([, value]) => value !== undefined)
    );
    const corruptW2 = WinISDDriver.build(header, corruptRows, []);

    const diffs = wdrRecordRoundTripDiffs(driver1, corruptW2, engine);

    assert.equal(diffs.length, 1, `expected exactly one diff, got: ${JSON.stringify(diffs)}`);
    assert.equal(diffs[0].field, 'wdr-record-round-trip');
    assert.match(diffs[0].message, /the \.wdr we wrote reads back as a record the driver seam refuses/);
  });

  it('reports a genuine mismatch through the success-path map when driver1 and w2 come from different real records', () => {
    // Both fixtures individually build a valid driver and a valid .wdr — the disagreement here is
    // real content (Dayton vs ScanSpeak), not a corrupted row, so this exercises the `.map()` over
    // `oidDriverDiffs`/`wdrDriverDiffs` on the success path, past the `Array.isArray(driver3)` guard
    // the test above covers.
    const engine = new Engine();
    const daytonParsed = driverYmlToOpenisdAndWdr(daytonDriverYml());
    const scanspeakParsed = driverYmlToOpenisdAndWdr(scanspeakDriverYml());
    assert.ok(daytonParsed.openisd !== null && scanspeakParsed.wdr !== null);

    const driver1 = OpenISDDriver.fromConformingRecord(JSON.parse(daytonParsed.openisd), engine);
    assert.ok(!Array.isArray(driver1), 'the Dayton fixture must build a valid driver, or this proves nothing');
    const w2 = WinISDDriver.fromWdrIni(scanspeakParsed.wdr);

    const diffs = wdrRecordRoundTripDiffs(driver1, w2, engine);

    assert.ok(diffs.length > 0, 'a Dayton driver1 paired with a ScanSpeak w2 must disagree');
    assert.ok(diffs.every((d) => d.field === 'wdr-record-round-trip'), `expected every diff field to be wdr-record-round-trip, got: ${JSON.stringify(diffs)}`);
  });
});

describe('driverYmlToOpenisdAndWdr — WinISD-safe text', () => {
  /** The Dayton fixture with the offending characters injected into the free-text fields a
   *  scraper really fills, so both derived files are built from text a manufacturer site could
   *  genuinely have produced. */
  function daytonWithUnsafeText(): string {
    const record = parse(daytonDriverYml());
    record.brand.value = 'Dayton™ Wärme';
    record.model.value = 'CE28N–4 “Titanium” 1″';
    record.comment = { value: 'Xmax ≤ 2.5 mm … rated 90 dB' };
    return stringifyYaml(record);
  }

  it('translates the characters WinISD cannot draw out of openisd.json', () => {
    const { openisd } = driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
    assert.ok(openisd !== null, 'the fixture must still project');

    for (const bad of ['™', '–', '“', '”', '″', '…', ' ']) {
      assert.ok(!openisd.includes(bad), `openisd.json still carries ${JSON.stringify(bad)}`);
    }
    assert.ok(openisd.includes('Dayton(TM)'), 'TM spelled out');
    assert.ok(openisd.includes('CE28N-4 \\"Titanium\\" 1\\"'), 'dashes and quotes are ASCII');
  });

  it('removes the 0xA4-carrying characters that would corrupt the .wdr', () => {
    const { openisd } = driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
    assert.ok(openisd !== null);

    assert.ok(!openisd.includes('ä'), 'a-with-diaeresis is C3 A4 and tears a .wdr value in half');
    assert.ok(!openisd.includes('≤'), 'less-than-or-equal is E2 89 A4');
    assert.ok(openisd.includes('Waerme'), 'spelled the German way');
    assert.ok(openisd.includes('Xmax <= 2.5 mm'), 'spelled in ASCII');
  });

  it('leaves the .wdr free of them too, because it is built from the cleaned record', () => {
    const { wdr } = driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
    assert.ok(wdr !== null, 'a woofer record must produce a .wdr');

    for (const bad of ['™', '–', '“', '”', '″', '…', ' ', 'ä', '≤']) {
      assert.ok(!wdr.includes(bad), `.wdr still carries ${JSON.stringify(bad)}`);
    }
  });

  it('reports every rewrite as a warn naming the field and both characters', () => {
    const { errors } = driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
    const rewrites = errors.filter((e) => e.field.startsWith('winisd-safe-text'));

    assert.ok(rewrites.length > 0, 'a rewrite nobody is told about is a silent edit');
    assert.ok(rewrites.every((e) => e.level === 'warn'), 'cosmetic, never blocking');
    assert.ok(
      rewrites.some((e) => e.field === 'winisd-safe-text:brand.value' && e.message.includes('™') && e.message.includes('(TM)')),
      `expected a brand rewrite naming both sides, got: ${JSON.stringify(rewrites)}`
    );
  });

  it('says nothing about a record that needed no rewrite', () => {
    const { errors } = driverYmlToOpenisdAndWdr(daytonDriverYml());
    assert.deepEqual(errors.filter((e) => e.field.startsWith('winisd-safe-text')), []);
  });
});
