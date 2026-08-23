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
import { parse as parseYaml } from 'yaml';
import { OpenISDDriver } from '@openisd/model';
import { PARSTATE_LEN, POS_TO_WDRKEY } from '@openisd/winisd';
import { checkOpenisdRoundTrip, checkWdrRoundTrip } from '../../../../scripts/roundTripGate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(here, '..', '..', '..', '..', '..', 'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727');
const REAL_OPENISD_YML = join(CORPUS_DIR, 'openisd.yml');
const REAL_WDR = join(CORPUS_DIR, 'winisd.wdr');

describe('checkOpenisdRoundTrip', () => {
  it('a real corpus record round-trips clean', () => {
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const record = parseYaml(readFileSync(REAL_OPENISD_YML, 'utf8'), { logLevel: 'error' });
    const result = checkOpenisdRoundTrip(record, 'accuton/bd90-6-727/openisd.yml');
    assert.deepEqual(result, { ok: true });
  });

  it('a value JSON cannot represent losslessly (YAML .nan) fails the gate, naming the divergence', () => {
    // `OpenISDDriver.fromJsonRecord` does not validate its input (it just stores the
    // reference), so the ONE real way this leg's round trip can diverge is a value that
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
    // Deliberately NOT the corpus's on-disk winisd.wdr: that file predates this bridge (it was
    // written by the Python `rebuild_wdr.py` INI serialiser F4 deleted) and carries a smaller
    // key set than `toWdr()`'s fixed INI_ROWS table, so it fails this bar by construction — see
    // the dedicated test below, which documents that as a real corpus finding, not a gate bug.
    // This test proves the gate is CORRECT against a .wdr the current pipeline would actually
    // produce, using the exact same real function (`OpenISDDriver.fromJsonRecord(...).toWdrText()`)
    // `checkOpenisdRoundTrip`/the bridge use.
    assert.equal(existsSync(REAL_OPENISD_YML), true, `fixture missing: ${REAL_OPENISD_YML}`);
    const record = parseYaml(readFileSync(REAL_OPENISD_YML, 'utf8'), { logLevel: 'error' });
    const { value: wdrText, errors } = OpenISDDriver.fromJsonRecord(record).toWdrText();
    assert.equal(errors.some(e => e.level === 'error'), false, JSON.stringify(errors));
    assert.equal(typeof wdrText, 'string');

    const result = checkWdrRoundTrip(wdrText, 'accuton/bd90-6-727/winisd.wdr (bridge-generated)');
    assert.deepEqual(result, { ok: true });
  });

  it('REAL CORPUS FINDING: the on-disk winisd.wdr (pre-bridge, F4-era Python writer) fails the ' +
     'QT60 bar against the app\'s own writer — a smaller key set, not a projection bug', () => {
    assert.equal(existsSync(REAL_WDR), true, `fixture missing: ${REAL_WDR}`);
    const wdrText = readFileSync(REAL_WDR, 'utf8');
    const result = checkWdrRoundTrip(wdrText, 'accuton/bd90-6-727/winisd.wdr');
    assert.equal(result.ok, false);
    assert.equal((result.message ?? '').includes('key-order mismatch'), true, result.message);
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
    const { value: wdrText } = OpenISDDriver.fromJsonRecord(record).toWdrText();
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
