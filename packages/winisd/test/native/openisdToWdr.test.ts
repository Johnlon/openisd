/**
 * `openisd.yml` → `winisd.wdr` projection — the entry point `winisd_tools` calls in-process.
 * Spec: `docs/spec/SPEC_ENGINE.md` §4.7.
 *
 * Seam under test: `openisdYamlToWdr(yamlText) -> Result<string>` — string in, string out.
 * That IS the boundary an embedded-V8 caller sees.
 *
 * 🔒 ORACLE RULE (SPEC_ENGINE §4.7): the ONLY oracle is `drivers/sample/winisd/`, prepared by
 * johnl out of WinISD itself. An oracle `.wdr` is one WinISD ITSELF wrote; a third-party
 * database's export of driver data into `.wdr` shape is NOT an oracle however plausible it
 * looks, because its key set, precision and ParState are one program's guess at the format
 * and will happily agree with a bug in our writer. `winisd_drivers/…/winisd.wdr` is
 * Python-produced and non-conformant (16 fields short). Neither may supply an expected value.
 *
 * `john-all-defaults.wdr` is driver-editor → New → Save with nothing typed, so it defines the
 * field set, the order and every default. That is a FORMAT oracle, which is what it can
 * honestly prove. End-to-end VALUE parity needs a driver carrying both an `openisd.yml` and a
 * johnl-prepared save of the same driver; none exists yet, so no test here claims it.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { openisdYamlToWdr } from '../../src/native/openisdToWdr.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ORACLE = join(ROOT, 'drivers', 'sample', 'winisd', 'john-all-defaults.wdr');
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'openisd');

/** Ordered `.wdr` keys of a file — the format fingerprint. */
function keysOf(wdr: string): string[] {
  return wdr.split(/\r?\n/)
    .map(l => /^([A-Za-z][A-Za-z0-9]*)=/.exec(l)?.[1])
    .filter((k): k is string => k != null);
}

/** Parse `.wdr` text to key→raw-string. */
function fieldsOf(wdr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of wdr.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && line[0] !== '[') out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const oracleText = readFileSync(ORACLE, 'utf8');

/** Minimal record: enough to identify a driver, no T/S values at all. */
const EMPTY_RECORD = `
uuid: {value: u1, definition: d}
quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
brand: {value: Acme, origin: manual, definition: d, dq: []}
model: {value: Widget, origin: manual, definition: d, dq: []}
sku: {value: acme-widget, definition: d, grounds: []}
driver_type: {value: woofer, origin: manual, definition: d, dq: []}
disposition: {value: ok, definition: d, detail: ''}
data_sources: {value: {}, definition: d}
authoritative: {value: manual, definition: d}
specs: {woofer: {}}
`;

describe('openisd.yml → winisd.wdr — format conformance (oracle: drivers/sample/winisd/)', () => {
  it('emits exactly the oracle field set, in the oracle order', () => {
    const { value, errors } = openisdYamlToWdr(EMPTY_RECORD);
    assert.deepEqual(errors.filter(e => e.level === 'error'), []);
    assert.notEqual(value, null);
    assert.deepEqual(keysOf(value!), keysOf(oracleText));
  });

  it('writes SPL as a key — it is in the fixed set, never omitted', () => {
    const { value } = openisdYamlToWdr(EMPTY_RECORD);
    assert.equal(keysOf(value!).includes('SPL'), true);
  });

  it('uses the oracle defaults for every unsupplied numeric field', () => {
    const got = fieldsOf(openisdYamlToWdr(EMPTY_RECORD).value!);
    const want = fieldsOf(oracleText);
    // Everything the oracle defaults, except the header identity fields (which carry the
    // record's own values) and ParState (asserted separately).
    const HEADER = new Set(['Brand', 'Model', 'Manufacturer', 'ProvidedBy', 'Comment',
      'DateAdded', 'DateModified', 'ParState']);
    for (const k of keysOf(oracleText)) {
      if (HEADER.has(k)) continue;
      assert.equal(got[k], want[k], `default for ${k}`);
    }
  });

  it('emits a 49-character ParState', () => {
    const got = fieldsOf(openisdYamlToWdr(EMPTY_RECORD).value!);
    assert.equal(got.ParState.length, 49);
  });

  it('marks numVC E and c/roo C on an empty record, exactly as WinISD does', () => {
    // Oracle: NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC
    const got = fieldsOf(openisdYamlToWdr(EMPTY_RECORD).value!);
    assert.equal(got.ParState, fieldsOf(oracleText).ParState);
  });
});

describe('openisd.yml → winisd.wdr — calculation (SPEC_ENGINE §4.7 obligation b)', () => {
  const real = readFileSync(join(FIXTURES, 'w5-1138smf.openisd.yml'), 'utf8');

  it('calculates every derivable field rather than leaving it at its default', () => {
    const { value, errors } = openisdYamlToWdr(real);
    assert.deepEqual(errors.filter(e => e.level === 'error'), []);
    const f = fieldsOf(value!);
    // Entered, straight from the record.
    assert.equal(Number(f.Fs), 45);
    assert.equal(Number(f.Re), 3.4);
    // Derived — none of these is in the record; all must be computed, not 0.
    for (const k of ['Vd', 'Dd', 'Dia', 'no', 'EBP', 'Rms']) {
      assert.notEqual(Number(f[k]), 0, `${k} was left at its default — not calculated`);
      assert.equal(Number.isFinite(Number(f[k])), true, `${k} is not finite`);
    }
    // Vd = Sd·Xmax, independently: 0.0094 × 0.00925.
    assert.ok(Math.abs(Number(f.Vd) - 0.0094 * 0.00925) < 1e-12);
    // EBP = Fs/Qes, independently: 45 / 0.57.
    assert.ok(Math.abs(Number(f.EBP) - 45 / 0.57) < 1e-9);
  });

  it('converts the record mm/l dimensions to WinISD SI', () => {
    // w5-1138smf carries Hg_mm and voice_coil_dia_mm; WinISD stores metres.
    const f = fieldsOf(openisdYamlToWdr(real).value!);
    assert.equal(Number(f.Hg), 0.005);
    assert.equal(Number(f.Vcd), 0.032);
  });
});

describe('openisd.yml → winisd.wdr — Result contract (never throws)', () => {
  it('reports malformed YAML as an error, does not throw', () => {
    const { value, errors } = openisdYamlToWdr('specs: [this is: not, valid: yaml\n  ::');
    assert.equal(value, null);
    assert.equal(errors.some(e => e.level === 'error'), true);
  });

  it('reports YAML that is not an OpenISD record as an error, does not throw', () => {
    const { value, errors } = openisdYamlToWdr('hello: world\n');
    assert.equal(value, null);
    assert.equal(errors.some(e => e.level === 'error'), true);
  });
});
