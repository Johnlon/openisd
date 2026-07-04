/**
 * @openisd/winisd — real-world .wdr import/export round-trip via the Driver ADT.
 *
 * Uses a committed real driver fixture (Tang Band W5-1138SMF) to verify that
 * Driver.fromWdr reads the correct values and fromWdr → toWdr → fromWdr round-trips the
 * T/S parameters. deriveDriver (via toDriver) gives the internal-consistency check.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));

// 1e-4 relative: .wdr round-trip allows tiny rounding from toPrecision(6) formatting.
const WDR_ROUNDTRIP_RELATIVE_TOLERANCE = 1e-4;

describe('.wdr driver file import and export (Driver ADT)', () => {

  // The Tang Band W5-1138SMF .wdr is a committed test fixture — a real driver file
  // from the loudspeakerdatabase repository. Its known parameters verify the read.
  const TANG_BAND_WDR_PATH = join(here, '..', '..', '..', 'drivers', 'loudspeakerdatabase', 'Tang Band W5-1138SMF.wdr');
  const EXPECTED_MODEL_NAME = 'Tang Band W5-1138SMF';
  const EXPECTED_FS_HZ      = 45;      // Hz — as written in the .wdr file
  const EXPECTED_SD_M2      = 0.0094;  // m² — as written in the .wdr file

  const text = readFileSync(TANG_BAND_WDR_PATH, 'utf8');

  it('reads the model name, Fs, and Sd from a real-world .wdr file', () => {
    const d = Driver.fromWdr(text);
    assert.equal((d.raw() as Record<string, unknown>).name, EXPECTED_MODEL_NAME,
      `name should be "${EXPECTED_MODEL_NAME}"`);
    assert.equal(d.cell('Fs').value, EXPECTED_FS_HZ, `Fs should be ${EXPECTED_FS_HZ} Hz`);
    assert.equal(d.cell('Sd').value, EXPECTED_SD_M2, `Sd should be ${EXPECTED_SD_M2} m²`);
  });

  it('exports to .wdr text and round-trips all T/S parameters to within 0.01%', () => {
    // toWdr uses toPrecision(6) which introduces tiny rounding — relative tolerance
    // of 1e-4 (= 0.01%) captures any real mismatch while allowing formatting drift.
    const d  = Driver.fromWdr(text);
    const rt = Driver.fromWdr(d.toWdr());
    const params = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe', 'Z'];
    for (const k of params) {
      const a = d.cell(k).value, b = rt.cell(k).value;
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      const rel = Math.abs(a - b) / Math.abs(a);
      assert.ok(rel < WDR_ROUNDTRIP_RELATIVE_TOLERANCE,
        `${k}: ${a} → export → import → ${b} (relative error ${rel.toExponential(2)})`);
    }
  });

  it('the re-imported .wdr is internally self-consistent: toDriver gives the same Fs, Qts, Qes', () => {
    // If the export/import round-trip is clean, the derived driver should reproduce the
    // same key parameters (within floating-point tolerance).
    const dv = Driver.fromWdr(Driver.fromWdr(text).toWdr()).toDriver();
    assert.ok(dv, 'the re-imported driver must derive');
    assert.ok(Math.abs(dv.Fs  - EXPECTED_FS_HZ) < 1e-6, `Fs should be ${EXPECTED_FS_HZ} Hz, got ${dv.Fs}`);
    assert.ok(Math.abs(dv.Qts - 0.49) < 1e-3, `Qts should be ~0.49, got ${dv.Qts.toFixed(4)}`);
    assert.ok(Math.abs(dv.Qes - 0.57) < 1e-3, `Qes should be ~0.57, got ${dv.Qes.toFixed(4)}`);
  });

});
