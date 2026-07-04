/**
 * @openisd/winisd — real-world .wdr import/export round-trip.
 *
 * Uses a committed real driver fixture (Tang Band W5-1138SMF) to verify that
 * parseWdr reads correct values and toWdr → parseWdr round-trips T/S parameters.
 * deriveDriver (pure physics) is imported from @openisd/engine for the
 * internal-consistency check.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deriveDriver } from '@openisd/engine';
import type { DriverRaw } from '@openisd/engine';
import { parseWdr, toWdr } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));

// 1e-4 relative: .wdr round-trip allows tiny rounding from toPrecision(6) formatting.
const WDR_ROUNDTRIP_RELATIVE_TOLERANCE = 1e-4;

describe('.wdr driver file import and export', () => {

  // The Tang Band W5-1138SMF .wdr is a committed test fixture — a real driver file
  // from the loudspeakerdatabase repository. Its known parameters are used to
  // verify the parser reads the correct values.
  const TANG_BAND_WDR_PATH = join(here, '..', '..', '..', 'drivers', 'loudspeakerdatabase', 'Tang Band W5-1138SMF.wdr');
  const EXPECTED_MODEL_NAME = 'Tang Band W5-1138SMF';
  const EXPECTED_FS_HZ      = 45;   // Hz  — as written in the .wdr file
  const EXPECTED_SD_M2      = 0.0094; // m² — as written in the .wdr file

  let imported: DriverRaw | null = null;

  it('reads the model name, Fs, and Sd from a real-world .wdr file', () => {
    const { value: _imp1, errors: _imp1Errors } = parseWdr(readFileSync(TANG_BAND_WDR_PATH, 'utf8'));
    if (!_imp1) throw new Error('parseWdr failed on Tang Band WDR: ' + _imp1Errors.map(e => e.message).join('; '));
    imported = _imp1;
    assert.equal(imported.name, EXPECTED_MODEL_NAME,
      `name should be "${EXPECTED_MODEL_NAME}"`);
    assert.equal(imported.Fs, EXPECTED_FS_HZ,
      `Fs should be ${EXPECTED_FS_HZ} Hz`);
    assert.equal(imported.Sd, EXPECTED_SD_M2,
      `Sd should be ${EXPECTED_SD_M2} m²`);
  });

  it('exports to .wdr text and round-trips all T/S parameters to within 0.01%', () => {
    // toWdr uses toPrecision(6) which introduces tiny rounding — relative tolerance
    // of 1e-4 (= 0.01%) captures any real mismatch while allowing formatting drift.
    if (!imported) { const { value: _fb } = parseWdr(readFileSync(TANG_BAND_WDR_PATH, 'utf8')); imported = _fb; }
    assert.ok(imported);
    const { value: roundTripped } = parseWdr(toWdr(imported));
    assert.ok(roundTripped);
    // These params are all numeric T/S fields; view as numeric records for the loop.
    const imp = imported as Record<string, number>;
    const rt  = roundTripped as Record<string, number>;
    const params = ['Fs', 'Qts', 'Qes', 'Qms', 'Vas', 'Sd', 'Re', 'Le', 'Xmax', 'Pe', 'Z'];
    for (const k of params) {
      if (imp[k] == null) continue;
      const rel = Math.abs(imp[k] - rt[k]) / Math.abs(imp[k]);
      assert.ok(rel < WDR_ROUNDTRIP_RELATIVE_TOLERANCE,
        `${k}: ${imp[k]} → export → import → ${rt[k]} (relative error ${rel.toExponential(2)})`);
    }
  });

  it('the re-imported .wdr is internally self-consistent: deriveDriver gives the same Fs, Qts, Qes', () => {
    // If the export/import round-trip is clean, deriveDriver on the re-imported data
    // should reproduce the same key parameters (within floating-point tolerance).
    if (!imported) { const { value: _fb } = parseWdr(readFileSync(TANG_BAND_WDR_PATH, 'utf8')); imported = _fb; }
    assert.ok(imported);
    const reparsed = parseWdr(toWdr(imported)).value;
    assert.ok(reparsed);
    const { value: d } = deriveDriver(reparsed);
    assert.ok(d);
    assert.ok(Math.abs(d.Fs  - EXPECTED_FS_HZ) < 1e-6,
      `Fs should be ${EXPECTED_FS_HZ} Hz, got ${d.Fs}`);
    assert.ok(Math.abs(d.Qts - 0.49) < 1e-3,
      `Qts should be ~0.49, got ${d.Qts.toFixed(4)}`);
    assert.ok(Math.abs(d.Qes - 0.57) < 1e-3,
      `Qes should be ~0.57, got ${d.Qes.toFixed(4)}`);
  });

});
