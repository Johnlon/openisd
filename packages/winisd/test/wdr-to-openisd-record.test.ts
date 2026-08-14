/**
 * `WinISDDriver.toOpenISDRecord()` — the reader half of Step 8 (ARCHITECTURE.md §3 "Import"):
 * ".wdr text populates a WinISDDriver; those as-read values are diffed against what
 * OpenISDDriver independently derives, surfacing a mismatch ... as a data-quality signal
 * rather than silently overwriting." `fromWdr()` itself is unchanged — it still returns raw,
 * undived cells (WinISDDriver.fromWdr(text): WinISDDriver). This is a NEW method that projects
 * those as-read cells into an `OpenISDRecord`, so `OpenISDDriver.fromRecord()` has an entry
 * point at all.
 *
 * Seam: `WinISDDriver.fromWdr(text).toOpenISDRecord()` → `OpenISDDriver.fromRecord(record)`.
 *
 * 🔒 ORACLE: `drivers/sample/winisd/inconsistency-test-qts-C.wdr` is a genuine WinISD save
 * (WDR_SCHEMA.md consistency-check experiment 2026-06-28) that states `Qts=0.500` but marks
 * ParState slot 14 `C` (WinISD computed it, not the human) — its own comment records the
 * correct value as "~0.358", i.e. Qes·Qms/(Qes+Qms) = 0.38·6.2/(0.38+6.2) = 0.3580547...
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '../src/winisdDriver.js';
import { OpenISDDriver } from '@openisd/model';

const here = dirname(fileURLToPath(import.meta.url));
const WDR_TEXT = readFileSync(
  join(here, '..', '..', '..', 'drivers', 'sample', 'winisd', 'inconsistency-test-qts-C.wdr'),
  'utf8',
);

describe('WinISDDriver.toOpenISDRecord — provenance mapping (E -> SpecEntry, C -> excluded, N -> absent)', () => {
  it('a cell marked E becomes a stated SpecEntry with a manual reading, SI units preserved', () => {
    const record = WinISDDriver.fromWdr(WDR_TEXT).toOpenISDRecord();
    const fs = record.specs.woofer?.Fs;
    assert.ok(fs, 'Fs is E in the source file and must be carried');
    assert.equal(fs.origin, 'manual');
    assert.equal(fs.readings.manual?.read_value, 38);
  });

  it('a cell marked C (WinISD-computed) is NOT written into the record as a stated SpecEntry', () => {
    const record = WinISDDriver.fromWdr(WDR_TEXT).toOpenISDRecord();
    assert.equal(record.specs.woofer?.Qts, undefined,
      'Qts is C (WinISD computed 0.500 itself) — the record must not assert it as a fact');
  });

  it('a cell marked N is absent from the record', () => {
    const record = WinISDDriver.fromWdr(WDR_TEXT).toOpenISDRecord();
    assert.equal(record.specs.woofer?.fLe, undefined, 'fLe is N in the source file');
  });

  it('round-trips through OpenISDDriver.fromRecord(): E fields read back with their stated value', () => {
    const record = WinISDDriver.fromWdr(WDR_TEXT).toOpenISDRecord();
    const driver = OpenISDDriver.fromRecord(record);

    assert.deepEqual(driver.cell('Fs'), { value: 38, state: 'E', origin: 'manual' });
    assert.deepEqual(driver.cell('Re'), { value: 6.4, state: 'E', origin: 'manual' });
    assert.deepEqual(driver.cell('Qes'), { value: 0.38, state: 'E', origin: 'manual' });
    assert.deepEqual(driver.cell('Qms'), { value: 6.2, state: 'E', origin: 'manual' });
  });

  it('the excluded C field is independently RE-DERIVED by OpenISDDriver, matching WinISD\'s own formula', () => {
    const record = WinISDDriver.fromWdr(WDR_TEXT).toOpenISDRecord();
    const driver = OpenISDDriver.fromRecord(record);
    const qts = driver.cell('Qts');
    assert.equal(qts.state, 'C');
    assert.ok(qts.value != null && Math.abs(qts.value - 0.35805471124620064) < 1e-9,
      `Qts ${String(qts.value)} does not match Qes*Qms/(Qes+Qms)`);
  });
});

describe('WinISDDriver.diffAgainst — a WinISD-stored C value that disagrees with the fresh derivation is flagged', () => {
  it('surfaces the stale Qts=0.500 (C) against the freshly-derived ~0.358 as a warn-level mismatch', () => {
    const sourceWdr = WinISDDriver.fromWdr(WDR_TEXT);
    const record = sourceWdr.toOpenISDRecord();
    const driver = OpenISDDriver.fromRecord(record);

    const { value: derivedWdr, errors } = WinISDDriver.fromOpenISDRecord(driver.toRecord());
    assert.ok(derivedWdr, `projection failed: ${JSON.stringify(errors)}`);

    const mismatches = sourceWdr.diffAgainst(derivedWdr!);
    const qtsMismatch = mismatches.find(m => m.field === 'Qts');
    assert.ok(qtsMismatch, 'expected a Qts mismatch between the stored C value and the fresh derivation');
    assert.equal(qtsMismatch!.level, 'warn');
    assert.match(qtsMismatch!.message, /0\.5/);
  });
});
