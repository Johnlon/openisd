/**
 * TASK B of `shiny-noodling-kahan.md` "Round-trip gate in the openisd bundler":
 * `scripts/roundTripGate.mjs`'s `checkOpenisdRoundTrip`/`checkWdrRoundTrip` must pass on a
 * known-good real corpus record and fail loudly on a deliberately corrupted round trip, BEFORE
 * either is wired into `bundle-drivers.mjs` or `package.json`'s predev/prebuild.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse as parseYaml} from 'yaml';
import {OpenISDDriver} from '@openisd/design';
import type {DriverError} from '@openisd/design/engine';
import {Engine} from '@openisd/design/engine';
import {driverToWdrBytes} from '../../src/logic/fileImportExport.js';
import {PARSTATE_LEN} from '@openisd/design/winisd';
import {checkOpenisdRoundTrip, checkWdrRoundTrip, firstDivergence} from '../../../../scripts/roundTripGate.mjs';

// ParState slot -> .wdr key, in WinISD's own slot order (winisdDriver.ts #parState writes
// exactly this sequence; slot 10 is Xlim, a mark-only field with no .wdr key).
const POS_TO_WDRKEY = [
  'Znom', 'Fs', 'Pe', 'SPL', 'Re', 'Le', 'fLe', 'KLe', 'BL', 'Xmax', null,
  'Cms', 'Qms', 'Qes', 'Qts', 'Rms', 'Mms', 'Sd', 'Vd', 'Vas', 'Dia', 'Dd',
  'no', 'numVC', 'Hc', 'Hg', 'SPLmax', 'SPLmaxLF', 'USPL', 'alfaVC', 'Rt', 'Ct',
  'gamma', 'EBP', 'Rme', 'Mpow', 'Mcost', 'Gloss', 'Thick', 'Depth', 'MagDepth',
  'Magnet', 'Basket', 'Outer', 'Vcd', 'DVol', 'VCCon', 'c', 'roo',
];

/**
 * A driver record as the `.wdr` text the app's own export button would write — the same
 * `driverToWdrBytes` the Export `.wdr` path calls, so the gate is checked against what the
 * pipeline actually produces rather than against a conversion assembled here.
 */
function wdrTextFor(record: unknown): { value: string | null; errors: DriverError[] } {
  const driver = OpenISDDriver.fromOwdrText(JSON.stringify(record), new Engine());
  if (Array.isArray(driver)) throw new Error('fixture record is invalid: ' + driver.join(', '));
  const { value, errors } = driverToWdrBytes(driver);
  return { value: value === null ? null : new TextDecoder().decode(value), errors };
}

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(here, '..', '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727');
const REAL_OPENISD_JSON = join(CORPUS_DIR, 'openisd.json');

function realRecord(): unknown {
  assert.equal(existsSync(REAL_OPENISD_JSON), true, `fixture missing: ${REAL_OPENISD_JSON}`);
  return JSON.parse(readFileSync(REAL_OPENISD_JSON, 'utf8'));
}

describe('checkOpenisdRoundTrip', () => {
  it('a real corpus record round-trips clean', () => {
    const record = realRecord();
    const result = checkOpenisdRoundTrip(record, 'accuton/bd90-6-727/openisd.json');
    assert.equal(result.ok, true, 'message' in result ? result.message : '');
    // The opened device travels back so the bundler writes the index row from the object the
    // gate proved — one open per record.
    assert.ok('device' in result && result.device instanceof OpenISDDriver);
  });

  it('a record the app itself exported (entries already carrying state/value, marks, C entries) round-trips clean — a fixed point', () => {
    // Since 2026-09-20 (option A) the scraper bridge writes the app's own export, so every
    // openisd.json on disk is exactly what `toOpenIsdDeviceJson()` gives. The gate has no
    // compatibility path for an older entry shape: a record that predates the model is
    // rebuilt, not tolerated.
    const record = realRecord();
    const loaded = OpenISDDriver.fromConformingRecord(record, new Engine());
    if (Array.isArray(loaded)) throw new Error('fixture record is invalid: ' + loaded.join(', '));
    const appWritten = JSON.parse(JSON.stringify(loaded.toOpenIsdDeviceJson()));
    const result = checkOpenisdRoundTrip(appWritten, 'accuton/bd90-6-727/openisd.json (app-written)');
    assert.equal(result.ok, true, 'message' in result ? result.message : '');
  });

  it('a real corpus record whose stated `no` (state:C) differs from the app\'s own recompute ' +
     'by float noise round-trips clean (QO167: a stored calculated value is a convenience, ' +
     'never trusted as current — winisd_tools computed it independently, so ~1 ULP drift ' +
     'against the app\'s own re-derivation is expected, not a loss)', () => {
    // dayton-audio/da215-8 is one of the corpus records where the on-disk `no.value` (written
    // by winisd_tools) disagrees with the app's own referenceEfficiency() recompute at the
    // 1-ULP level (0.003922639268191504 vs ...505) — this is what predev's full-corpus
    // bundle-drivers.mjs scan currently throws on, with no equivalent unit-test coverage.
    const here = dirname(fileURLToPath(import.meta.url));
    const path = join(here, '..', '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'dayton-audio', 'da215-8', 'openisd.json');
    assert.equal(existsSync(path), true, `fixture missing: ${path}`);
    const record = JSON.parse(readFileSync(path, 'utf8'));
    const result = checkOpenisdRoundTrip(record, 'dayton-audio/da215-8/openisd.json');
    assert.equal(result.ok, true, 'message' in result ? result.message : '');
  });

  it('a value JSON cannot represent (NaN smuggled in as YAML) fails the gate, naming the divergence', () => {
    // This leg compares the record against itself through a JSON text cycle and does not
    // validate it, so the ONE real way its round trip can diverge is a value that
    // survives parsing but does NOT survive a JSON.stringify/JSON.parse cycle — exactly
    // what `.owdr`'s JSON-text export IS. An openisd.json file cannot CARRY `.nan` (JSON has no
    // NaN), so the record below smuggles one in via YAML to prove the gate still catches the
    // divergence class rather than a sanitised input that could never appear on disk.
    const record = parseYaml('specs: {}\nbadField: .nan\n', { logLevel: 'error' });
    const result = checkOpenisdRoundTrip(record, 'fake/nan-field/openisd.json');
    assert.equal(result.ok, false, `expected a divergence, got: ${JSON.stringify(result)}`);
    assert.equal((result.message ?? '').includes('badField'), true, result.message);
  });
});

describe('firstDivergence — calculated-entry float-noise tolerance', () => {
  it('two state:C entries whose value differs only at the ~1 ULP level are not a divergence', () => {
    const a = { specs: { woofer: { no: { state: 'C', value: 0.003922639268191504 } } } };
    const b = { specs: { woofer: { no: { state: 'C', value: 0.003922639268191505 } } } };
    assert.equal(firstDivergence(a, b), null);
  });

  it('two state:C entries whose value differs by a real (non-noise) margin still diverge', () => {
    // A wrong formula or wrong units shows up as a relative difference many orders of
    // magnitude past float noise — this must still fail the gate.
    const a = { specs: { woofer: { no: { state: 'C', value: 0.003922639268191504 } } } };
    const b = { specs: { woofer: { no: { state: 'C', value: 0.003922639268191504 * 1.001 } } } };
    assert.notEqual(firstDivergence(a, b), null);
  });

  it('an entered (state:E) value differing at all is still a divergence — the tolerance is only for state:C', () => {
    const a = { specs: { woofer: { Re: { state: 'E', value: 3.2 } } } };
    const b = { specs: { woofer: { Re: { state: 'E', value: 3.2 + 1e-12 } } } };
    assert.notEqual(firstDivergence(a, b), null);
  });
});

describe('firstDivergence — dq_calculated is bridge-computed, never compared (D22)', () => {
  it('a stored dq_calculated that differs from the recompute is not a divergence', () => {
    const a = { specs: { woofer: { Qts: { state: 'E', value: 0.49, dq_calculated: [] } } } };
    const b = {
      specs: { woofer: { Qts: { state: 'E', value: 0.49, dq_calculated: [
        { kind: 'calc', severity: 'error', rule: 'inconsistent-inputs', params: {}, detail: 'x' },
      ] } } },
    };
    assert.equal(firstDivergence(a, b), null);
  });

  it('dq_calculated present on only one side is not a divergence', () => {
    const a = { specs: { woofer: { Qts: { state: 'E', value: 0.49 } } } };
    const b = {
      specs: { woofer: { Qts: { state: 'E', value: 0.49, dq_calculated: [
        { kind: 'calc', severity: 'error', rule: 'inconsistent-inputs', params: {}, detail: 'x' },
      ] } } },
    };
    assert.equal(firstDivergence(a, b), null);
  });

  it('a stored dq_scraper that differs from the recompute still diverges', () => {
    const a = { specs: { woofer: { Qts: { state: 'E', value: 0.49, dq_scraper: [] } } } };
    const b = {
      specs: { woofer: { Qts: { state: 'E', value: 0.49, dq_scraper: [
        { kind: 'parse', severity: 'warn', rule: 'x', params: {}, detail: 'y' },
      ] } } },
    };
    assert.notEqual(firstDivergence(a, b), null);
  });
});

describe('checkWdrRoundTrip', () => {
  it('a .wdr produced by the app\'s own writer (toWdrText) round-trips clean at the QT60 bar', () => {
    // This test proves the gate against a .wdr the current pipeline would actually
    // produce, using the exact function the app's Export `.wdr` button calls
    // (`fileImportExport.ts::driverToWdrBytes`).
    const record = realRecord();
    const { value: wdrText, errors } = wdrTextFor(record);
    assert.equal(errors.some(e => e.level === 'error'), false, JSON.stringify(errors));
    assert.equal(typeof wdrText, 'string');

    const result = checkWdrRoundTrip(wdrText, 'accuton/bd90-6-727/winisd.wdr (bridge-generated)');
    assert.deepEqual(result, { ok: true });
  });

  it('junk text with no key=value lines at all fails the gate (before is empty, the app\'s ' +
     'writer always emits the full 48-key table, so lengths diverge)', () => {
    const result = checkWdrRoundTrip('not a wdr file, nothing to parse', 'fake/unreadable.wdr');
    assert.equal(result.ok, false);
  });

  it('a stated C (computed) value that disagrees with what re-derivation yields fails the gate', () => {
    // checkWdrRoundTrip's own internal cycle recomputes every C-marked field from the entered
    // (E) inputs and compares the result against what the file STATES for that field. A C
    // value that does not match what its own inputs actually derive to is exactly the
    // divergence class this gate exists to catch — it is functionally indistinguishable from a
    // real projection bug (winisd_tools writing a wrong number), which is the point. Uses the
    // bridge-generated wdr (not the stale on-disk one) as the base, so the ONLY divergence is
    // the one this test deliberately introduces.
    const record = realRecord();
    const { value: wdrText } = wdrTextFor(record);
    assert.equal(typeof wdrText, 'string');
    if (wdrText == null) throw new Error('unreachable: asserted above');

    const lines = wdrText.split(/\r?\n/);
    const parStateLine = lines.find(l => l.startsWith('ParState='));
    assert.ok(parStateLine, 'fixture must state a ParState line');
    const state = parStateLine.slice('ParState='.length);
    assert.equal(state.length, PARSTATE_LEN);

    // Find a key WinISD marked 'C' (computed, not human-entered) with a non-zero stated value
    // — corrupting an 'E' value would be preserved verbatim (entered values are never
    // recomputed), which proves nothing about round-trip fidelity.
    let corruptKey;
    for (let pos = 0; pos < PARSTATE_LEN; pos++) {
      if (state[pos] !== 'C') continue;
      const key = POS_TO_WDRKEY[pos];
      if (key && lines.some(l => l.startsWith(`${key}=`) && Number(l.slice(key.length + 1)) !== 0)) {
        corruptKey = key;
        break;
      }
    }
    assert.ok(corruptKey, 'expected at least one non-zero C-marked key in the bridge-generated fixture');

    const corruptedLines = lines.map(l =>
      l.startsWith(`${corruptKey}=`) ? `${corruptKey}=999999.999` : l);
    const corruptedText = corruptedLines.join('\r\n');

    const result = checkWdrRoundTrip(corruptedText, 'accuton/bd90-6-727/winisd.wdr (corrupted)');
    assert.equal(result.ok, false,
      `expected a mismatch on the corrupted C-marked key "${corruptKey}", got: ${JSON.stringify(result)}`);
    assert.equal((result.message ?? '').includes(corruptKey), true, result.message);
  });
});
