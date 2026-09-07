/**
 * `.wdr` -> OpenISD record: the voice-coil connection row and coil count.
 *
 * `VCCon` is read on PRESENCE, not on its ParState mark. WinISD writes no instruction to slot 46,
 * so 520 of the 524 corpus files carry `N` there while still stating a wiring on the `VCCon=` line
 * (`drivers/sample/PARSTATE-FINDINGS.md`). Dropping the row on its mark loses every Series in the
 * corpus.
 *
 * `1` and `2` are the whole encoding (`WINISD_SCHEMA.md` §3.2) — the only two positions WinISD's
 * own dropdown can write. Anything else is not a value a human could have entered from that UI,
 * so it is OMITTED rather than coerced into an entered fact — no `SpecEntry` at all, a warning
 * naming the out-of-range value, and the driver's own `VCCon` getter then reports the calculated
 * default (parallel) the same way an absent key does (John, 2026-09-05: "when reading back a
 * zero or absent then it should [be] recorded as C in openisd and the default calculated 1 comes
 * thru").
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { WinISDDriver } from '../../winisd/winisdDriver.js';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdSchema.js';

/** A `.wdr` whose only stated field is `VCCon`, with the ParState mark under test on slot 46. */
function wdrStating(vccon: string, mark: 'E' | 'C' | 'N'): WinISDDriver {
  const parState = 'N'.repeat(46) + mark + 'NN';
  const rows = ['[Driver]', 'Brand=Acme', 'Model=Widget', `VCCon=${vccon}`, `ParState=${parState}`];
  return WinISDDriver.fromWdrIni(rows.join('\r\n') + '\r\n');
}

const vcconOf = (d: WinISDDriver) => winISDDriverToOpenISDDeviceJson(d).record.specs.woofer?.VCCon;
const vcconWarningsOf = (d: WinISDDriver) => winISDDriverToOpenISDDeviceJson(d).warnings;

describe('.wdr VCCon import', () => {
  it('VCCon=2 marked N still imports as series — the mark is not the value', () => {
    const entry = vcconOf(wdrStating('2', 'N'));
    assert.notEqual(entry, undefined);
    assert.equal(entry!.readings.manual!.read_value, 2);
    assert.equal(entry!.dq_calculated, undefined);
  });

  it('VCCon=1 marked N imports as parallel', () => {
    const entry = vcconOf(wdrStating('1', 'N'));
    assert.equal(entry!.readings.manual!.read_value, 1);
    assert.equal(entry!.dq_calculated, undefined);
  });

  it('VCCon=2 marked E imports as series', () => {
    assert.equal(vcconOf(wdrStating('2', 'E'))!.readings.manual!.read_value, 2);
  });

  it('VCCon=3 is out of range for the dropdown — omitted, warning emitted, reads as the calculated default', () => {
    const wdr = wdrStating('3', 'E');
    const entry = vcconOf(wdr);
    const warnings = vcconWarningsOf(wdr);
    assert.equal(entry, undefined,
      'VCCon=3 is not a value WinISD\'s UI can write — no SpecEntry, not a coerced entered fact');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]!.level, 'warn');
    assert.equal(warnings[0]!.field, 'VCCon');
    assert.match(warnings[0]!.message, /3.*not.*1.*parallel.*2.*series/i);
  });

  it('VCCon=0 is out of range too — zero is not a value the dropdown can write, omitted the same way', () => {
    const wdr = wdrStating('0', 'N');
    const entry = vcconOf(wdr);
    const warnings = vcconWarningsOf(wdr);
    assert.equal(entry, undefined,
      'VCCon=0 is out of range — no SpecEntry, the driver\'s own getter reports the calculated default');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]!.field, 'VCCon');
  });
});

/**
 * `numVC` — the coil count. Legal 1..4; a driver has at least one coil and no more than four.
 * Outside that the row is read as 1 with the number the file carried kept as `actual_reading`,
 * and a warning emitted — same treatment as VCCon.
 */
describe('.wdr numVC import', () => {
  /** A `.wdr` whose only stated field is `numVC`, ParState slot 23 marked E as WinISD writes it. */
  function wdrStatingNumVC(numVC: string): WinISDDriver {
    const parState = 'N'.repeat(23) + 'E' + 'N'.repeat(25);
    const rows = ['[Driver]', 'Brand=Acme', 'Model=Widget', `numVC=${numVC}`, `ParState=${parState}`];
    return WinISDDriver.fromWdrIni(rows.join('\r\n') + '\r\n');
  }
  const numVCOf = (d: WinISDDriver) => winISDDriverToOpenISDDeviceJson(d).record.specs.woofer?.numVC;
  const numVCWarningsOf = (d: WinISDDriver) => winISDDriverToOpenISDDeviceJson(d).warnings;

  it('numVC=2 imports untouched', () => {
    const entry = numVCOf(wdrStatingNumVC('2'));
    assert.equal(entry!.readings.manual!.read_value, 2);
    assert.equal(entry!.dq_calculated, undefined);
  });

  it('numVC=4 imports untouched — four coils is a real driver', () => {
    const entry = numVCOf(wdrStatingNumVC('4'));
    assert.equal(entry!.readings.manual!.read_value, 4);
    assert.equal(entry!.dq_calculated, undefined);
  });

  it('numVC=123 is coerced to 1 — warning emitted, no dq mark on the record', () => {
    const wdr = wdrStatingNumVC('123');
    const entry = numVCOf(wdr);
    const warnings = numVCWarningsOf(wdr);
    assert.equal(entry!.readings.manual!.read_value, 1);
    assert.equal(entry!.readings.manual!.actual_reading, '123');
    assert.equal(entry!.dq_calculated, undefined);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]!.level, 'warn');
    assert.equal(warnings[0]!.field, 'numVC');
    assert.match(warnings[0]!.message, /123.*not.*coil.*1.*4/i);
  });

  it('numVC=0 is coerced too — no driver has zero coils', () => {
    const wdr = wdrStatingNumVC('0');
    const entry = numVCOf(wdr);
    const warnings = numVCWarningsOf(wdr);
    assert.equal(entry!.readings.manual!.read_value, 1);
    assert.equal(entry!.readings.manual!.actual_reading, '0');
    assert.equal(entry!.dq_calculated, undefined);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]!.field, 'numVC');
  });
});
