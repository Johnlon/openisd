/**
 * `openisd.yml` → `winisd.wdr` projection — the entry point `winisd_tools` calls in-process
 * (embedded V8) to generate the `.wdr` it stores in `winisd_drivers`.
 *
 * Seam under test: `openisdYamlToWdr(yamlText) -> Result<string>`, the production export
 * from `@openisd/model` (`packages/model/src/openisdYamlToWdr.ts`) that the V8 bridge calls.
 * `WinISDDriver` (docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md Step 8, ARCHITECTURE.md §3
 * "WinISDDriver is solely a serialisation device") stays internal to that composition.
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

import { parse } from 'yaml';
import { openisdYamlToWdr } from '@openisd/model';
import type { DriverError } from '@openisd/design/engine';
import { WINISD_NEWLINE_SENTINEL } from '../../winisd/winisdBytes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const ORACLE = join(ROOT, 'drivers', 'sample', 'winisd', 'john-all-defaults.wdr');
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'openisd');

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

/** `Comment=`'s full text, including any `[DQ]` lines appended to it (ARCHITECTURE.md §3),
 *  with the format's newline sentinel decoded so assertions can be written with real `\n`.
 *  `Comment=` is ONE physical line — a newline inside it is the single byte `0xA4`, which
 *  `winisdBytesToText` presents as `WINISD_NEWLINE_SENTINEL`. */
function commentBlockOf(wdr: string): string {
  const line = wdr.split(/\r?\n/).find(l => l.startsWith('Comment='));
  return (line ?? '').slice('Comment='.length).replaceAll(WINISD_NEWLINE_SENTINEL, '\n');
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

const wdrOf = openisdYamlToWdr;

describe('openisd.yml → winisd.wdr — format conformance (oracle: drivers/sample/winisd/)', () => {
  it('emits exactly the oracle field set, in the oracle order', () => {
    const { value, errors } = wdrOf(EMPTY_RECORD);
    assert.deepEqual(errors.filter((e: DriverError) => e.level === 'error'), []);
    assert.notEqual(value, null);
    assert.deepEqual(keysOf(value!), keysOf(oracleText));
  });

  it('writes SPL as a key — it is in the fixed set, never omitted', () => {
    const { value } = wdrOf(EMPTY_RECORD);
    assert.equal(keysOf(value!).includes('SPL'), true);
  });

  it('uses the oracle defaults for every unsupplied numeric field', () => {
    const got = fieldsOf(wdrOf(EMPTY_RECORD).value!);
    const want = fieldsOf(oracleText);
    // Everything the oracle defaults, except the header identity fields (which carry the
    // record's own values) and ParState (asserted separately).
    const HEADER = new Set(['Brand', 'Model', 'Manufacturer', 'ProvidedBy', 'Comment',
      'DateAdded', 'DateModified', 'ParState']);
    // c/roo: openisd computes both live from the CIPM-2007 moist-air model at the reference
    // environment (packages/engine/src/air.ts) rather than holding WinISD's stored literal —
    // there is no frozen constant anywhere (AGENTS.md 'Calculation logic — permission gate'
    // sign-off 2026-08-19). Bounded agreement instead of byte equality; same mechanism as
    // divergences.json's "*"/c and "*"/roo entries in winisd-parity.test.ts.
    const LIVE_COMPUTED_REL_TOL: Record<string, number> = { c: 5e-6, roo: 9e-6 };
    for (const k of keysOf(oracleText)) {
      if (HEADER.has(k)) continue;
      if (k in LIVE_COMPUTED_REL_TOL) {
        const g = Number(got[k]), w = Number(want[k]);
        assert.ok(Math.abs(g - w) <= LIVE_COMPUTED_REL_TOL[k] * Math.abs(w),
          `default for ${k}: got ${g}, oracle ${w} (tol ${LIVE_COMPUTED_REL_TOL[k]})`);
        continue;
      }
      assert.equal(got[k], want[k], `default for ${k}`);
    }
  });

  it('emits a 49-character ParState', () => {
    const got = fieldsOf(wdrOf(EMPTY_RECORD).value!);
    assert.equal(got.ParState.length, 49);
  });

  it('marks numVC E and c/roo C on an empty record, exactly as WinISD does', () => {
    // Oracle: NNNNNNNNNNNNNNNNNNNNNNNENNNNNNNNNNNNNNNNNNNNNNNCC
    const got = fieldsOf(wdrOf(EMPTY_RECORD).value!);
    assert.equal(got.ParState, fieldsOf(oracleText).ParState);
  });

  it('a frozen pre-B10 openisd.yml snapshot (e150he-44) converts to the pinned .wdr values', () => {
    // `e150he-44.openisd.yml` is a frozen pre-B10 snapshot of the record shape, not a live
    // bundled driver — `voice_coil_dia_mm` below is a pre-B10 key; if B10 changes that shape
    // this fixture must be regenerated, which the assertion on it is here to force rather than
    // let drift silently.
    const rawYaml = readFileSync(join(FIXTURES, 'e150he-44.openisd.yml'), 'utf8');
    const preB10Record = parse(rawYaml) as { specs: { woofer: { voice_coil_dia_mm: { readings: { manufacturer_product_page: { read_value: number } } } } } };
    assert.equal(preB10Record.specs.woofer.voice_coil_dia_mm.readings.manufacturer_product_page.read_value, 38);

    const { value, errors } = wdrOf(rawYaml);
    assert.deepEqual(errors.filter((e: DriverError) => e.level === 'error'), []);
    assert.notEqual(value, null);
    const f = fieldsOf(value!);
    assert.deepEqual(keysOf(value!), keysOf(oracleText));
    // Entered, straight from the record.
    assert.equal(f.Fs, '40');
    // Derived — Dia = 2·√(Sd/π), Sd = 0.009503 m².
    assert.equal(f.Dia, String(2 * Math.sqrt(0.009503 / Math.PI)));
    // The full 49-slot ParState, pinned — the field-by-field E/C/N mix a real datasheet record
    // produces, distinct from the all-defaults EMPTY_RECORD case above.
    assert.equal(f.ParState, 'EEEEEENNEENEEEECEECECCCENNCCCNNNCCCCNCNNNNNNNNECC');
  });
});

describe('openisd.yml → winisd.wdr — calculation (SPEC_ENGINE §4.7 obligation b)', () => {
  const real = readFileSync(join(FIXTURES, 'w5-1138smf.openisd.yml'), 'utf8');

  it('calculates every derivable field rather than leaving it at its default', () => {
    const { value, errors } = wdrOf(real);
    assert.deepEqual(errors.filter((e: DriverError) => e.level === 'error'), []);
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

  it('carries Hg and Vcd through to WinISD unchanged — both are SI on both sides', () => {
    const f = fieldsOf(wdrOf(real).value!);
    assert.equal(Number(f.Hg), 0.005);
    assert.equal(Number(f.Vcd), 0.032);
  });
});

describe('openisd.yml → winisd.wdr — Result contract (never throws)', () => {
  it('reports malformed YAML as an error, does not throw', () => {
    const { value, errors } = openisdYamlToWdr('specs: [this is: not, valid: yaml\n  ::');
    assert.equal(value, null);
    assert.equal(errors.some((e: DriverError) => e.level === 'error'), true);
  });

  it('reports YAML that is not an OpenISD record as an error, does not throw', () => {
    const { value, errors } = openisdYamlToWdr('hello: world\n');
    assert.equal(value, null);
    assert.equal(errors.some((e: DriverError) => e.level === 'error'), true);
  });

  it('reports a record whose specs interior is not the SpecEntry shape as an error, does not throw (BUG_20260822)', () => {
    const { value, errors } = openisdYamlToWdr('specs: {woofer: {fs: 12}}\n');
    assert.equal(value, null);
    assert.equal(errors.some((e: DriverError) => e.level === 'error'), true);
  });
});

/**
 * Xlim crosses into a `.wdr` as its ParState MARK and nothing else.
 *
 * `.wdr` has no key for Xlim and no extension mechanism to add one. Probe evidence:
 * `s-fs.wdr` (Fs typed into WinISD, saved) writes `Fs=123` AND sets slot 1 to `E`;
 * `s-xlim.wdr` (Xlim typed in, saved) writes NO key — every numeric line is still `0` — and
 * sets only slot 10. So WinISD keeps the mark and discards the number.
 */
describe('openisd.yml → winisd.wdr — Xlim is a ParState mark, never a key', () => {
  /** Slot 10 of the ParState this record projects to. */
  const slot10 = (wdr: string): string =>
    wdr.split(/\r?\n/).find(l => l.startsWith('ParState='))!.slice('ParState='.length)[10];

  it('no record ever produces an Xlim= line — WinISD writes none, so neither do we', () => {
    for (const [what, src] of [['no Xlim', EMPTY_RECORD], ['an entered Xlim', WITH_XLIM]] as const) {
      const { value } = wdrOf(src);
      assert.notEqual(value, null, `${what}: must project`);
      assert.equal(keysOf(value!).includes('Xlim'), false,
        `${what}: an Xlim= line is a key WinISD cannot read — it is dropped on WinISD's next ` +
        `save while slot 10 goes on claiming a value was entered`);
    }
  });

  it('a record with no Xlim leaves slot 10 at N', () => {
    assert.equal(slot10(wdrOf(EMPTY_RECORD).value!), 'N');
  });

  it('a record with an entered Xlim marks slot 10 E', () => {
    assert.equal(slot10(wdrOf(WITH_XLIM).value!), 'E');
  });
});

const WITH_XLIM = `
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
specs:
  woofer:
    Xlim:
      origin: manual
      readings: {manual: {read_value: 12.5}}
      dq: []
`;

describe('openisd.yml → winisd.wdr — DQ marks travel into Comment= (ARCHITECTURE.md §3)', () => {
  it('a record with no DQ marks leaves Comment= byte-identical to a plain writer', () => {
    const { value } = wdrOf(EMPTY_RECORD);
    assert.equal(commentBlockOf(value!), '');
  });

  it('a record with N marks produces N [DQ] lines, in record order, each field=value: offence', () => {
    const withDq = `
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
description: {value: 'a driver', origin: manual, definition: d, dq: []}
specs:
  woofer:
    Qts:
      origin: manual
      readings: {manual: {read_value: 1.5}}
      dq:
        - {kind: range, severity: error, rule: range-above-max, params: {field: Qts, value: 1.5, limit: 0.8, unit: ''}, detail: 'Qts=1.5 above max 0.8'}
    Vas:
      origin: manual
      readings: {manual: {read_value: 140}}
      dq:
        - {kind: range, severity: error, rule: range-above-max, params: {field: Vas, value: 140, limit: 60, unit: L}, detail: 'Vas=140 above max 60 L'}
`;
    const { value } = wdrOf(withDq);
    const comment = commentBlockOf(value!);
    assert.equal(comment,
      "a driver\n[DQ] Qts=1.5: Qts=1.5 above max 0.8\n[DQ] Vas=140: Vas=140 above max 60 L");
  });
});
