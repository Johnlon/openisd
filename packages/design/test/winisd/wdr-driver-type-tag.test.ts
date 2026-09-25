/**
 * `[DRIVERTYPE tweeter]` in a `.wdr`'s `Comment=` — WinISD's `.wdr` format has no field for
 * driver type (`bugs/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`),
 * so a non-woofer OID record round-tripped through `.wdr` loses its type on read. Same mechanism
 * as `[DQ]` and `[ENV]`: `Comment=` is the one field real WinISD round-trips opaquely.
 *
 * A file with no tag falls back to today's behaviour (`driver_type: 'woofer'`, `specs.woofer`),
 * since real WinISD will never write this tag itself.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {WinISDDriver} from '../../winisd/winisdDriver.js';
import {allNotAvailableCells} from './wdrFixture.js';
import {driverSpecsOf, winISDDriverToOpenISDDeviceJson} from '../../domain/openisdSchema.js';
import {OpenISDDriver} from '../../domain/index.js';
import {Engine} from '../../engine/index.js';

describe('WinISDDriver [DRIVERTYPE] tag — read side (winISDDriverToOpenISDDeviceJson)', () => {
  it('a .wdr reads back with woofer section', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allNotAvailableCells(), [], undefined, 'woofer',
    ).toWdrIni();
    const wdr = WinISDDriver.fromWdrIni(written);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.equal(record.driver_type.value, 'woofer');
    assert.ok(driverSpecsOf(record)?.woofer, 'record.specs.woofer must be populated for a driver record');
  });

  it('a .wdr with no [DRIVERTYPE] tag falls back to woofer', () => {
    const wdr = WinISDDriver.build({ comment: 'an ordinary note' }, allNotAvailableCells(), []);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.equal(record.driver_type.value, 'woofer');
    assert.ok(driverSpecsOf(record)?.woofer, 'record.specs.woofer must be populated by default');
  });
});

describe('refusal of tweeter record', () => {
  it('a tweeter record is refused by driver seam', () => {
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
    assert.ok(Array.isArray(driverOrProblems), 'tweeter record must be refused');
  });
});
