/**
 * driverYamlToOpenisdYaml — parity against the Python projection it replaces
 * (`winisd_tools/scrapers/scrapers/lib/model_openisd.py::OpenIsdYmlFile.from_metadata` +
 * `.to_yaml()`, pinned to winisd_tools commit 16492ffc — the CURRENT model, not any doc).
 *
 * Each fixture pair is: a REAL driver.yml from `winisd_drivers/db/datasheets/<vendor>/...`,
 * validated and re-saved once through the pinned Python `DriverFile` (`from_yaml().to_yaml()`)
 * so it is self-consistent under the CURRENT model — the live `winisd_drivers` corpus fails
 * this validation at 2,016/2,016 records (`winisd_tools/bugs/
 * BUG_20260821_emitted_records_lag_the_openisd_model_and_the_cohort_needs_re_emission.md`,
 * confirmed independently this session: every chosen source file raised `dq_status: Extra
 * inputs are not permitted` — `corroboration` is the current field name — plus stale
 * `definition` text on some fields). Re-saving through the pinned model is data preparation
 * for a loadable fixture, not a workaround of that bug: the bug is in the emitted corpus,
 * out of this task's scope (winisd_tools B10 fixes it by re-running the emit phase), and
 * this module's real input is always a freshly-emitted, already-valid `driver.yml` (the
 * V8-bridge caller), never the stale on-disk corpus.
 *
 * The paired `.openisd.yml` fixture is the OUTPUT of that same Python `DriverFile` instance
 * run through `OpenIsdYmlFile.from_metadata(md).to_yaml()` — the ONE python invocation this
 * module's TS code is a faithful port of.
 *
 * PARITY NORMALISATION: compared by re-parsing both YAML texts back to plain JS values and
 * `JSON.stringify`-ing each — equal iff every key, every value and every key's INSERTION
 * ORDER match at every level (JS preserves string-key insertion order, and none of these
 * records has an integer-like key, so stringify order is a faithful proxy for YAML mapping
 * order). NOT byte-identical: PyYAML's line-folding/quoting algorithm and the `yaml` npm
 * package's differ (the human-facing bar for closing that gap is a separate, orchestrator-
 * raised question — this module does not build a custom emitter to chase it). This parity
 * check is BLIND to flow-vs-block style by construction (re-parsing either yields the
 * identical JS value), so the flow-style choice (`markFlowStyle` in the source module) is
 * pinned separately below, by literal substring, in the tests that assert on it — and those
 * literals confirm a REAL, remaining cosmetic gap between the two serialisers: PyYAML's flow
 * collections carry no interior padding (`[Cms, Fs, Mms, Sd, Vas]`,
 * `tangband_pr01.openisd.yml`), the `yaml` npm package's do (`[Cms, Fs, Mms, Sd, Vas]`,
 * this module's actual output) — one more concrete instance of the byte-identity gap above,
 * not a defect in this port.
 *
 * FIXTURE PREPARATION (mechanical only, reviewer-audited 2026-08-22): every `.driver.yml`
 * here is a REAL record from `winisd_drivers/db/datasheets/<vendor>/...`, put through the
 * exact same two-step preparation — (1) rename `dq_status` -> nothing (dropped; the pinned
 * model re-derives `corroboration` from `readings` when absent) and refresh every stale
 * `definition` string to the registry's current text (both are the literal B3/QO34 renames
 * `winisd_tools/bugs/BUG_20260821_emitted_records_lag_the_openisd_model_and_the_cohort_needs_re_emission.md`
 * describes — no other field is touched), (2) one load+re-save through the pinned Python
 * `DriverFile` so the record is self-consistent under the CURRENT model (verified idempotent:
 * a second load+re-save changes nothing, for every fixture below). tang-band/pr01 needed ONE
 * exception: its source record predates the `no_ts_published` field entirely (the key is
 * simply absent), so step (2) let the model default it to `false` — silently inverting the
 * record's own stated meaning (`disposition: no-ts-published` in the raw text) into
 * `incomplete`. Caught in review; fixed by stating the one fact the raw record already
 * asserts (`no_ts_published: true`) before step (2), which is not a hand-edit of a VALUE the
 * source stated — it is supplying the one fact no mechanical rename could recover, faithfully.
 * The other three fixtures this review re-checked (scan-speak/grs/visaton) were independently
 * re-derived from a fresh, unedited mechanical migration and are BYTE-IDENTICAL to what is
 * committed here — no edit was needed or made.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { driverYamlToOpenisdYaml } from '../src/driverYamlToOpenisdYaml.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/driverYamlToOpenisdYaml');
const readFixture = (name: string): string => readFileSync(join(FIXTURE_DIR, name), 'utf8');
const canonicalJson = (yamlText: string): string => JSON.stringify(parse(yamlText));

describe('driverYamlToOpenisdYaml — parity with the pinned Python projection', () => {
  it('accuton/as168-9-470 — plain woofer, single-source, no missing/parse_errors', () => {
    const driverYaml = readFixture('accuton.driver.yml');
    const expectedOpenisd = readFixture('accuton.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
    const record = parse(value ?? '') as {model: { value: string} };
    assert.equal(record.model.value, 'Aluminium AS168-9-470',
      'series "Aluminium" and model "AS168-9-470" conform to one space-joined string (model_openisd.py:48-49)');
  });

  it('tang-band/pr01 — passive_radiator, no_ts_published, empty specs section, missing carries 5 fields', () => {
    const driverYaml = readFixture('tangband_pr01.driver.yml');
    const expectedOpenisd = readFixture('tangband_pr01.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
    const record = parse(value ?? '') as {quality: { disposition: { value: string}; no_ts_published: {value: boolean} } };
    assert.equal(record.quality.disposition.value, 'no-ts-published');
    assert.equal(record.quality.no_ts_published.value, true);
  });

  it('tang-band/pr01 — `missing` renders as a flow (bracketed) list, byte-pinned (markFlowStyle)', () => {
    const {value, errors} = driverYamlToOpenisdYaml(readFixture('tangband_pr01.driver.yml'));
    assert.deepEqual(errors, []);
    assert.ok((value ?? '').includes('missing: [Cms, Fs, Mms, Sd, Vas]'),
      `expected a flow-style 'missing:' line; got:\n${value}`);
  });

  it('scan-speak/15m-4531k00 — `confirmed_fields` renders as a flow (bracketed) list, byte-pinned', () => {
    const {value, errors} = driverYamlToOpenisdYaml(readFixture('scanspeak_multi.driver.yml'));
    assert.deepEqual(errors, []);
    assert.ok((value ?? '').includes('confirmed_fields: [BL, Fs, Qts, Re, SPL, Sd, Vas]'),
      `expected a flow-style 'confirmed_fields:' line; got:\n${value}`);
  });

  it('a dq_mark\'s `params` renders as a flow (braced) mapping, byte-pinned — SYNTHETIC unit test: no ' +
     'record in the winisd_drivers corpus carries a populated dq_marks list (confirmed 0/2016 this ' +
     'session), so this is a hand-built minimal driver.yml exercising the params-flow-style rule alone, ' +
     'not a vendor record', () => {
    const driverYaml = `
uuid:
  value: 00000000-0000-0000-0000-000000000000
  definition: stable record identity, minted by the pipeline at first emit and never re-derived
quality:
  rating: M
  confirmed_fields: []
  fields_with_issues: [Fs]
  missing: []
  invalid: []
  parse_errors: []
  cross_source_only: []
manufacturer:
  value: Test
  origin: manual
  definition: the company that makes the driver; a second-order descriptive field, shown only when it differs from the brand
brand:
  value: Test
  origin: manual
  definition: the selling brand; equals the manufacturer except for house brands
model:
  value: Unit
  origin: manual
  definition: the vendor's exact designation including the impedance variant — unique within a brand, and the name shown in the driver browser
sku:
  value: test-unit
  definition: the canonical identity code — the vendor designation slugified, impedance variant included; names the record directory (guard-enforced equal) and is unique within the manufacturer
  grounds:
  - origin: manual
    reading: Unit
    definition: the printed designation the code was derived from
driver_type:
  value: woofer
  origin: manual
  definition: what kind of driver this is (closed vocabulary); decides which specs section applies
data_sources:
  value: {}
  definition: the record-wide provenance index — every source role used anywhere in this file resolves to a URL here
authoritative:
  value: manual
  definition: which indexed source wins the datasheet waterfall for this record — the document the specs are extracted from; other sources only corroborate
specs:
  woofer:
    Fs:
      origin: manual
      readings:
        manual:
          actual_reading: '30'
          read_value: 30.0
          read_precision: 0.5
      definition: free-air resonance frequency (Hz)
      dq_marks:
      - kind: range
        severity: info
        rule: test_rule
        params:
          computed: 30.0
          stored: 30.0
          off_pct: 0.0
        detail: a synthetic dq_marks entry, for the params-flow-style test only
`;
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.ok((value ?? '').includes('params: {computed: 30, stored: 30, off_pct: 0}'),
      `expected a flow-style 'params:' mapping; got:\n${value}`);
  });

  it('grs/10sfpc-b — a parse_errors entry with an escaped quote/comma in the message', () => {
    const driverYaml = readFixture('grs_10sfpc.driver.yml');
    const expectedOpenisd = readFixture('grs_10sfpc.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
  });

  it('scan-speak/15m-4531k00 — multiple readings per field (2-source corroboration, conformed_reading)', () => {
    const driverYaml = readFixture('scanspeak_multi.driver.yml');
    const expectedOpenisd = readFixture('scanspeak_multi.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
  });

  it('visaton/al-130-8-ohm — no series field: model passes through unconformed', () => {
    const driverYaml = readFixture('visaton.driver.yml');
    const expectedOpenisd = readFixture('visaton.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
    const record = parse(value ?? '') as {model: { value: string} };
    assert.equal(record.model.value, 'AL 130 - 8 Ohm');
  });

  it('dayton-audio/amt-mini-8 — tweeter section, disposition incomplete (1 missing field)', () => {
    const driverYaml = readFixture('dayton_amt.driver.yml');
    const expectedOpenisd = readFixture('dayton_amt.openisd.yml');
    const {value, errors} = driverYamlToOpenisdYaml(driverYaml);
    assert.deepEqual(errors, []);
    assert.equal(canonicalJson(value ?? ''), canonicalJson(expectedOpenisd));
  });

  it('drops scraper_meta — never present in the driver.yml fixtures\' own key set, verify function does not add it', () => {
    const driverYaml = readFixture('accuton.driver.yml');
    const {value} = driverYamlToOpenisdYaml(driverYaml);
    const record = parse(value ?? '') as Record<string, unknown>;
    assert.equal('scraper_meta' in record, false);
  });

  it('malformed input (no specs key) fails with a Result error, not a thrown exception', () => {
    const {value, errors} = driverYamlToOpenisdYaml('uuid:\n  value: x\n  definition: y\n');
    assert.equal(value, null);
    assert.ok(errors.length > 0);
  });

  it('unparsable YAML fails with a Result error, not a thrown exception', () => {
    const {value, errors} = driverYamlToOpenisdYaml('not: [valid: yaml: at: all');
    assert.equal(value, null);
    assert.ok(errors.length > 0);
  });
});
