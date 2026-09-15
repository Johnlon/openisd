/**
 * TASK B of `shiny-noodling-kahan.md` "Round-trip gate in the openisd bundler":
 * `scripts/roundTripGate.mjs`'s `checkOpenisdRoundTrip`/`checkWdrRoundTrip` must pass on a
 * known-good real corpus record and fail loudly on a deliberately corrupted round trip, BEFORE
 * either is wired into `bundle-drivers.mjs` or `package.json`'s predev/prebuild.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml, stringify as yamlStringify } from 'yaml';
import { OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import type { DriverError } from '@openisd/design/engine';
import { driverToWdrBytes } from '../../src/logic/fileImportExport.js';
import { PARSTATE_LEN, POS_TO_WDRKEY } from '@openisd/design/winisd';

/**
 * A driver record as the `.wdr` text the app's own export button would write — the same
 * `driverToWdrBytes` the Export `.wdr` path calls, so the gate is checked against what the
 * pipeline actually produces rather than against a conversion assembled here.
 */
function wdrTextFor(record: unknown): { value: string | null; errors: DriverError[] } {
  const driver = OpenISDDriver.fromOwdrText(yamlStringify(record), new Engine());
  if (Array.isArray(driver)) throw new Error('fixture record is invalid: ' + driver.join(', '));
  const { value, errors } = driverToWdrBytes(driver);
  return { value: value === null ? null : new TextDecoder().decode(value), errors };
}
import { checkOpenisdRoundTrip, checkWdrRoundTrip } from '../../../../scripts/roundTripGate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(here, '..', '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727');
const REAL_OPENISD_YML = join(CORPUS_DIR, 'openisd.yml');

describe('checkOpenisdRoundTrip', () => {
  it('a real corpus record round-trips clean', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const record = parseYaml(readFileSync(REAL_OPENISD_YML, 'utf8'), { logLevel: 'error' });
    const result = checkOpenisdRoundTrip(record, 'accuton/bd90-6-727/openisd.yml');
    assert.equal(result.ok, true, 'message' in result ? result.message : '');
    // The opened device travels back so the bundler writes the index row from the object the
    // gate proved — one open per record.
    assert.ok('device' in result && result.device instanceof OpenISDDriver);
  });

  it('a value JSON cannot represent losslessly (YAML .nan) fails the gate, naming the divergence', () => {
    // This leg compares the record against itself through a JSON text cycle and does not
    // validate it, so the ONE real way its round trip can diverge is a value that
    // survives YAML parsing but does NOT survive a JSON.stringify/JSON.parse cycle — exactly
    // what `.owdr`'s JSON-text export IS. YAML's `.nan` is real, valid YAML that parses to a
    // JS NaN; `JSON.stringify(NaN)` silently becomes `null` — a genuine, real divergence class
    // the openisd.yml leg exists to catch, not a synthetic shape the app would reject outright.
    const record = parseYaml('specs: {}\nbadField: .nan\n', { logLevel: 'error' });
    const result = checkOpenisdRoundTrip(record, 'fake/nan-field/openisd.yml');
    assert.equal(result.ok, false, `expected a divergence, got: ${JSON.stringify(result)}`);
    assert.equal((result.message ?? '').includes('badField'), true, result.message);
  });
});

describe('checkWdrRoundTrip', () => {
  it('a .wdr produced by the app\'s own writer (toWdrText) round-trips clean at the QT60 bar', () => {
    // This test proves the gate against a .wdr the current pipeline would actually
    // produce, using the exact function the app's Export `.wdr` button calls
    // (`fileImportExport.ts::driverToWdrBytes`).
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const record = parseYaml(readFileSync(REAL_OPENISD_YML, 'utf8'), { logLevel: 'error' });
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
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const record = parseYaml(readFileSync(REAL_OPENISD_YML, 'utf8'), { logLevel: 'error' });
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
