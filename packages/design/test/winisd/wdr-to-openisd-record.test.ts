import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {Calculated, Entered, Readable} from '../../domain/cell.js';
import type {CellState} from '../../winisd/cellState.js';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {WinISDDriver} from '@openisd/design/winisd';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';
import {openIsdDriverToWinIsdDriver} from '../../domain/winIsdDriverConverter.js';

/** The field reads `value` and carries the `.wdr` provenance `state`. */
function assertReads<T>(field: Readable<T | null> & Entered & Calculated, value: T | null, state: CellState): void {
  assert.equal(field.value, value);
  assert.equal(field.entered, state === 'entered');
  assert.equal(field.calculated, state === 'calculated');
}

const here = dirname(fileURLToPath(import.meta.url));

const WDR_TEXT = readFileSync(
  join(here, '..', '..', '..', '..', 'drivers', 'myprobes', 'inconsistencies', 'inconsistency-test-qts-C.wdr'),
  'utf8',
);

function driverOf(wdr: string): OpenISDDriver {
  const { record } = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(wdr));
  const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('winISDDriverToOpenISDDeviceJson/conformingRecordToDriver — provenance mapping (E -> entered, C -> excluded, N -> absent)', () => {
  it('a cell marked E becomes an entered field, SI units preserved', () => {
    const driver = driverOf(WDR_TEXT);
    const fs = driver.specs.Fs_hz;
    assert.equal(fs.entered, true);
    assert.equal(fs.value, 38);
  });

  it('a cell marked C (WinISD-computed) is NOT reported as entered', () => {
    const driver = driverOf(WDR_TEXT);
    const qts = driver.specs.Qts;
    assert.equal(qts.entered, false,
      'Qts is C (WinISD computed 0.500 itself) — the record must not assert it as a fact');
  });

  it('the entered cells read back with their stated value', () => {
    const driver = driverOf(WDR_TEXT);
    const spec = driver.specs;
    assertReads(spec.Fs_hz, 38, 'entered');
    assertReads(spec.Re_ohm, 6.4, 'entered');
    assertReads(spec.Qes, 0.38, 'entered');
    assertReads(spec.Qms, 6.2, 'entered');
  });

  it('the excluded C field is independently RE-DERIVED on export, matching WinISD\'s own formula', () => {
    const wdr = openIsdDriverToWinIsdDriver(driverOf(WDR_TEXT), []);
    assert.ok(wdr, 'the driver must be complete enough to export');
    const cell = wdr.cell('Qts');
    assert.equal(cell.state, 'calculated');
    const v = parseFloat(cell.value);
    assert.ok(isFinite(v) && Math.abs(v - 0.35805471124620064) < 1e-9,
      `Qts ${cell.value} does not match Qes*Qms/(Qes+Qms)`);
  });
});
