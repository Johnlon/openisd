/**
 * `[DRIVERTYPE tweeter]` in a `.wdr`'s `Comment=` — WinISD's `.wdr` format has no field for
 * driver type (`bugs/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`),
 * so a non-woofer OID record round-tripped through `.wdr` loses its type on read. Same mechanism
 * as `[DQ]` and `[ENV]`: `Comment=` is the one field real WinISD round-trips opaquely.
 *
 * A file with no tag falls back to today's behaviour (`driver_type: 'woofer'`, `specs.woofer`),
 * since real WinISD will never write this tag itself.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, INI_ROWS } from '../../winisd/winisdDriver.js';
import type { WdrCell } from '../../winisd/winisdDriver.js';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdSchema.js';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';
import { OpenISDDriver } from '../../domain/index.js';
import { Engine } from '../../engine/index.js';
import type { DriverError } from '@openisd/design/engine';

function allZeroCells(): Map<string, WdrCell> {
  const cells = new Map<string, WdrCell>();
  for (const key of INI_ROWS) cells.set(key, { value: '0', state: 'not-available' });
  return cells;
}

describe('WinISDDriver [DRIVERTYPE] tag — read side (winISDDriverToOpenISDDeviceJson)', () => {
  it('a .wdr whose Comment= carries [DRIVERTYPE tweeter] reads back as a tweeter', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allZeroCells(), [], undefined, 'tweeter',
    ).toWdrIni();
    const wdr = WinISDDriver.fromWdrIni(written);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.equal(record.driver_type.value, 'tweeter');
    assert.ok(record.specs.tweeter, 'record.specs.tweeter must be populated for a tweeter record');
    assert.equal(record.specs.woofer, undefined);
  });

  it('a .wdr with no [DRIVERTYPE] tag falls back to woofer', () => {
    const wdr = WinISDDriver.build({ comment: 'an ordinary note' }, allZeroCells(), []);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.equal(record.driver_type.value, 'woofer');
    assert.ok(record.specs.woofer, 'record.specs.woofer must be populated by default');
    assert.equal(record.specs.tweeter, undefined);
  });
});

describe('full round trip: OID tweeter record -> .wdr -> OID record', () => {
  it('a tweeter record written to .wdr and read back is still a tweeter', () => {
    const engine = new Engine();
    const tweeterRecord = {
      uuid: { value: 'test-uuid-driver-type-tag' },
      quality: {
        confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Acme' },
      brand: { value: 'Acme' },
      model: { value: 'T-1' },
      sku: { value: 'T-1', grounds: [{ origin: 'manual' as const, reading: 'T-1' }] },
      driver_type: { value: 'tweeter' },
      data_sources: { value: {} },
      authoritative: { value: 'openisd' },
      specs: { tweeter: {} },
    };

    const driverOrProblems = OpenISDDriver.fromConformingRecord(tweeterRecord, engine);
    if (Array.isArray(driverOrProblems)) {
      throw new Error(`Test fixture invalid: ${driverOrProblems.join('; ')}`);
    }
    const driver = driverOrProblems;

    const errors: DriverError[] = [];
    const wdr = openIsdDriverToWinIsdDriver(driver, engine, errors);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    assert.equal(record.driver_type.value, 'tweeter');
    assert.ok(record.specs.tweeter, 'record.specs.tweeter must survive the round trip');
    assert.equal(record.specs.woofer, undefined);
  });
});

describe('WinISDDriver [DRIVERTYPE] tag — no duplication on a second write', () => {
  it('a tag already present in Comment= is not duplicated by a further fromWdrIni -> toWdrIni', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allZeroCells(), [], undefined, 'tweeter',
    ).toWdrIni();
    const readBack = WinISDDriver.fromWdrIni(written).toWdrIni();
    assert.equal(readBack, written);
  });
});
