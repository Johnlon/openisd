/**
 * @openisd/winisd — what a `.wdr` STATES must survive import, and what it does not state must
 * not be invented.
 *
 * Seam: `driverOf(text)` → `cell(field)`. The two facts asserted here are the two ways
 * that seam can lie about provenance, and each was a live defect found by the WinISD parity
 * suite on 2026-08-13:
 *
 *  - a key the file does NOT carry must not come back marked `E`. `fromWdrIni` backfills the keys
 *    a genuine WinISD save always writes so the EXPORT emits them; feeding those fabricated
 *    defaults into the entered bag asserts a human typed them, and the solver then refuses to
 *    compute the field. Record:
 *    `bugs/BUG_20260813_fromwdr-fabricates-entered-defaults-for-absent-wdr-keys-and-pins-gloss-to-zero.md`
 *  - a key the file DOES carry must not be overwritten by our own calculation. Record:
 *    `bugs/BUG_20260813_wdr-spl-is-discarded-on-import-and-openisd-substitutes-its-own-computed-sensitivity.md`
 *
 * 🔒 ORACLE. Every expected value comes from WinISD 0.7.0.0, not from this codebase:
 * `drivers/sample/winisd/s-spl.wdr` and `s-gloss.wdr` are single-parameter probes WinISD itself
 * wrote (one field typed, one new `E` in ParState), and `Gloss` is checked against the value
 * WinISD computed for this exact driver in
 * `test/fixtures/winisd-parity/goldens/sealed-small.wpr`.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/winisd';
import { OpenISDDriver } from '@openisd/model';

/** The app's view of a `.wdr`: read as-read by the serialiser, projected into the record,
 *  then asked through the driver's own accessors — the exact path the app itself takes. */
function driverOf(wdr: string): OpenISDDriver {
  return OpenISDDriver.fromWinISDDriver(WinISDDriver.fromWdrIni(wdr));
}

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');

/**
 * The `sealed-small` parity scenario as `.wdr` text — 22 keys and no `ParState`, which is the
 * shape a scraper-authored file has. `Gloss` and `Xlim` are absent; `SPL` is present.
 */
const SEALED_SMALL = [
  '[Driver]',
  'Brand=QO8', 'Model=sealed-small',
  'Znom=8', 'Pe=100', 'SPL=90', 'Le=0.0005', 'numVC=1', 'VCCon=2',
  'Hc=0', 'Hg=0', 'Xmax=0.006',
  'Fs=37.2', 'Mms=0.0155', 'Cms=0.0011809260025671645', 'Re=6.4', 'Qms=3.8',
  'BL=7.5', 'Sd=0.0132', 'Qes=0.41220376440829154', 'Qts=0.3718657482780974',
  'Rms=0.9533906968736183', 'Vas=0.029188729770327368',
].join('\r\n') + '\r\n';

/** ParState slot → the character WinISD wrote, from a file WinISD itself saved. */
function parStateOf(file: string): string {
  const line = readFileSync(join(SAMPLES, file), 'utf8')
    .split(/\r?\n/)
    .find((l: string) => l.startsWith('ParState='));
  assert.ok(line, `${file} carries no ParState`);
  return line.slice('ParState='.length).trim();
}

describe('a .wdr key the file does not carry is not a stated value', () => {
  it('WinISD marks Gloss ENTERED only when it is typed — slot 37 of s-gloss.wdr', () => {
    // Grounds the claim that slot 37 is Gloss and that it is an enterable field, so a `C`
    // there is WinISD calculating and an `E` is WinISD echoing. Read from WinISD's own file.
    assert.equal(parStateOf('s-gloss.wdr')[37], 'E');
    assert.equal(parStateOf('john-all-defaults.wdr')[37], 'N');
  });

  it('a driver whose .wdr has no Gloss= line reports Gloss as CALCULATED, not entered', () => {
    // The record CAN hold a Gloss (`_SpecSection.Gloss`), and this one does not state a value.
    // So the serialiser writes what the engine derived and marks slot 37 `C` — an `E` would
    // assert a human typed a value nobody typed.
    const { value: wdr } = driverOf(SEALED_SMALL).toWinISDDriver();
    assert.ok(wdr, 'the driver must be complete enough to export');
    const cell = wdr.cell('Gloss');
    assert.equal(cell.state, 'C',
      'the file states no Gloss, so openisd must calculate it — an E here asserts a human ' +
      'typed a value nobody typed, and pins the field at the fabricated default');
    // WinISD's own answer for this driver: goldens/sealed-small.wpr, ParState slot 37 = C.
    const v = parseFloat(cell.value);
    assert.ok(isFinite(v) && Math.abs(v - 0.0299173972896111) <= 1e-9 * 0.0299173972896111,
      `Gloss ${cell.value} is not WinISD's 0.0299173972896111`);
  });
});

describe('a .wdr key the file does carry survives import unchanged', () => {
  it('WinISD marks SPL ENTERED and never calculates it — slot 3 of s-spl.wdr', () => {
    // s-spl.wdr has SPL=123 typed and every other parameter 0: slot 3 is E, and every
    // derivable slot is N. WinISD recorded a stated sensitivity, it did not compute one.
    assert.equal(parStateOf('s-spl.wdr')[3], 'E');
    assert.equal(parStateOf('john-all-defaults.wdr')[3], 'N');
  });

  it('a .wdr stating SPL=90 reports 90, marked ENTERED', () => {
    const cell = driverOf(SEALED_SMALL).cell('SPL');
    assert.equal(cell.state, 'E',
      'SPL=90 is in the file; reporting it as calculated discards the stated figure');
    assert.equal(cell.value, 90);
  });

  it('the stated SPL reaches the exported ParState at slot 3 and the exported SPL= line', () => {
    // Out through the app's own path: the record the driver holds, projected back to a .wdr
    // by the one class that knows the format.
    const { value: wdr } = driverOf(SEALED_SMALL).toWinISDDriver();
    assert.ok(wdr, 'the driver must be complete enough to export');
    const text = wdr.toWdr();
    const parState = text.split(/\r?\n/).find((l: string) => l.startsWith('ParState='))!.slice(9);
    assert.equal(parState[3], 'E');
    assert.ok(text.split(/\r?\n/).includes('SPL=90'), 'the export lost the stated SPL');
  });
});
