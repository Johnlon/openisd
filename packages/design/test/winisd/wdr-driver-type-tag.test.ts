/**
 * `[DRIVERTYPE tweeter]` in a `.wdr`'s `Comment=` — WinISD's `.wdr` format has no field for
 * driver type (`bugs/archive/BUG_20260907_driver_type_has_no_wdr_slot_so_every_loaded_driver_becomes_a_woofer.md`),
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
import {driverSpecsOf} from '../../domain/openisdSchema.js';
import {winISDDriverToOpenISDDeviceJson} from '../../domain/winIsdDriverImport.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '../../engine/Engine.js';
describe('WinISDDriver [DRIVERTYPE] tag — read side (winISDDriverToOpenISDDeviceJson)', () => {
  it('a .wdr reads back with woofer section', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allNotAvailableCells(), [], undefined, ['woofer'],
    ).toWdrIni();
    const wdr = WinISDDriver.fromWdrIni(written);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.deepEqual(record.driver_type.value, ['woofer']);
    assert.ok(driverSpecsOf(record)?.woofer, 'record.specs.woofer must be populated for a driver record');
  });

  it('a single role round-trips through the tag', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allNotAvailableCells(), [], undefined, ['midrange'],
    ).toWdrIni();
    assert.match(written, /\[DRIVERTYPE midrange\]/);
    const { record } = winISDDriverToOpenISDDeviceJson(WinISDDriver.fromWdrIni(written));
    assert.deepEqual(record.driver_type.value, ['midrange']);
  });

  it('[midrange, tweeter] round-trips as one comma-joined tag', () => {
    const written = WinISDDriver.build(
      { comment: 'a note' }, allNotAvailableCells(), [], undefined, ['midrange', 'tweeter'],
    ).toWdrIni();
    assert.match(written, /\[DRIVERTYPE midrange,tweeter\]/);
    const wdr = WinISDDriver.fromWdrIni(written);
    assert.deepEqual(wdr.driverTypes(), ['midrange', 'tweeter']);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.deepEqual(record.driver_type.value, ['midrange', 'tweeter']);
  });

  it('an old single-value [DRIVERTYPE tweeter] file still loads', () => {
    const old = WinISDDriver.build({ comment: 'a note\n[DRIVERTYPE tweeter]' }, allNotAvailableCells(), []).toWdrIni();
    const wdr = WinISDDriver.fromWdrIni(old);
    assert.deepEqual(wdr.driverTypes(), ['tweeter']);
    assert.deepEqual(winISDDriverToOpenISDDeviceJson(wdr).record.driver_type.value, ['tweeter']);
  });

  it('a .wdr with no [DRIVERTYPE] tag falls back to woofer', () => {
    const wdr = WinISDDriver.build({ comment: 'an ordinary note' }, allNotAvailableCells(), []);
    const { record } = winISDDriverToOpenISDDeviceJson(wdr);
    assert.deepEqual(record.driver_type.value, ['woofer']);
    assert.ok(driverSpecsOf(record)?.woofer, 'record.specs.woofer must be populated by default');
  });
});

describe('refusal of tweeter record', () => {
  it('a tweeter record is refused by driver seam', () => {
    const engine = createEngine();
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
      driver_type: { value: ['tweeter'] },
      data_sources: { value: {} },
      specs: { tweeter: {} },
    };

    const driverOrProblems = OpenISDDriver.fromConformingRecord(tweeterRecord, engine);
    assert.ok(Array.isArray(driverOrProblems), 'tweeter record must be refused');
  });
});
