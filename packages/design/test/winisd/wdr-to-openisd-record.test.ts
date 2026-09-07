/**
 * `winISDDriverToOpenISDDeviceJson` + `conformingRecordToDriver` — the reader half of Step 8
 * (ARCHITECTURE.md §3 "Import"): ".wdr text populates a WinISDDriver; those as-read values are
 * diffed against what OpenISDDriver independently derives, surfacing a mismatch ... as a
 * data-quality signal rather than silently overwriting." `fromWdrIni()` itself is unchanged — it
 * still returns raw, undived cells. `winISDDriverToOpenISDDeviceJson()` projects those as-read
 * cells into an `OpenISDDeviceJson` record; `conformingRecordToDriver()` turns that record into
 * the `OpenISDDriver` the app queries.
 *
 * Seam: `WinISDDriver.fromWdrIni(text)` → `winISDDriverToOpenISDDeviceJson(wdr)` →
 * `conformingRecordToDriver(record, engine)`.
 *
 * 🔒 ORACLE: `drivers/sample/winisd/inconsistency-test-qts-C.wdr` is a genuine WinISD save
 * (WINISD_SCHEMA.md consistency-check experiment 2026-06-28) that states `Qts=0.500` but marks
 * ParState slot 14 `C` (WinISD computed it, not the human) — its own comment records the
 * correct value as "~0.358", i.e. Qes·Qms/(Qes+Qms) = 0.38·6.2/(0.38+6.2) = 0.3580547...
 */
import { describe, it } from 'vitest';
import { diffWdrValues } from './wdrDiff.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/design/winisd';
import { OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdSchema.js';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';

const here = dirname(fileURLToPath(import.meta.url));
const WDR_TEXT = readFileSync(
  join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd', 'inconsistency-test-qts-C.wdr'),
  'utf8',
);

function driverOf(wdr: string): OpenISDDriver {
  const { record } = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(wdr));
  const driver = OpenISDDriver.fromConformingRecord(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('winISDDriverToOpenISDDeviceJson/conformingRecordToDriver — provenance mapping (E -> entered, C -> excluded, N -> absent)', () => {
  it('a cell marked E becomes an entered field, SI units preserved', () => {
    const driver = driverOf(WDR_TEXT);
    const fs = driver.spec[driver.section].Fs_hz.get();
    assert.equal(fs.state, 'entered');
    assert.equal(fs.value, 38);
  });

  it('a cell marked C (WinISD-computed) is NOT reported as entered', () => {
    const driver = driverOf(WDR_TEXT);
    const qts = driver.spec[driver.section].Qts.get();
    assert.notEqual(qts.state, 'entered',
      'Qts is C (WinISD computed 0.500 itself) — the record must not assert it as a fact');
  });

  it('the entered cells read back with their stated value', () => {
    const driver = driverOf(WDR_TEXT);
    const spec = driver.spec[driver.section];
    assert.deepEqual(spec.Fs_hz.get(), { value: 38, state: 'entered' });
    assert.deepEqual(spec.Re_ohm.get(), { value: 6.4, state: 'entered' });
    assert.deepEqual(spec.Qes.get(), { value: 0.38, state: 'entered' });
    assert.deepEqual(spec.Qms.get(), { value: 6.2, state: 'entered' });
  });

  it('the excluded C field is independently RE-DERIVED on export, matching WinISD\'s own formula', () => {
    const wdr = openIsdDriverToWinIsdDriver(driverOf(WDR_TEXT), new Engine(), []);
    assert.ok(wdr, 'the driver must be complete enough to export');
    const cell = wdr.cell('Qts');
    assert.equal(cell.state, 'calculated');
    const v = parseFloat(cell.value);
    assert.ok(isFinite(v) && Math.abs(v - 0.35805471124620064) < 1e-9,
      `Qts ${cell.value} does not match Qes*Qms/(Qes+Qms)`);
  });
});

describe('diffWdrValues — a WinISD-stored C value that disagrees with the fresh derivation is flagged', () => {
  it('surfaces the stale Qts=0.500 (C) against the freshly-derived ~0.358 as a warn-level mismatch', () => {
    const sourceWdr = WinISDDriver.fromWdrIni(WDR_TEXT);
    const driver = driverOf(WDR_TEXT);

    const derivedWdr = openIsdDriverToWinIsdDriver(driver, new Engine(), []);
    assert.ok(derivedWdr, 'projection failed');

    const mismatches = diffWdrValues(sourceWdr, derivedWdr);
    const qtsMismatch = mismatches.find(m => m.field === 'Qts');
    assert.ok(qtsMismatch, 'expected a Qts mismatch between the stored C value and the fresh derivation');
    assert.equal(qtsMismatch!.level, 'warn');
    assert.match(qtsMismatch!.message, /0\.5/);
  });
});
