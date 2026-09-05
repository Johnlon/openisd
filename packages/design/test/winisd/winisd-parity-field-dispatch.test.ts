/**
 * Component test — no WinISD, no goldens. Checks that this test suite's own field-name
 * dispatch (the switch statements mapping a `.wdr` `[Driver]` key like `Rme` to its
 * `DriverSpec`/solved-engine-bag field) actually has a case for every name the suite reads,
 * so a name added to the shared field list without a matching case fails loudly here instead
 * of silently reading as absent inside `winisd-parity.test.ts`'s golden-driven comparisons.
 *
 * `driverFieldCell()`/`solvedFieldValue()` are this file's OWN independent dispatch, written
 * out long-form per field — not imported from `winisd-parity.test.ts` or from any production
 * lookup (human ruling 2026-09-05: "tests must be an independent arbitar... it must have its
 * own opinion"). Only the field-NAME LIST is shared, via `fixtures/wdr-ini-driver-fields.json`
 * — a plain data file with no domain-meaningful assertion of its own, which is the one thing
 * "tests construct their own data" permits sharing.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine } from '@openisd/design/engine';
import { conformingRecordToDriver, type OpenISDDriver, type Cell } from '@openisd/design';
import { winISDDriverToOpenISDDeviceJson } from '../../domain/openisdRecordSchema.js';
import { WinISDDriver } from '../../winisd/winisdDriver.js';

const here = dirname(fileURLToPath(import.meta.url));

const WDR_INI_DRIVER_FIELDS: readonly string[] =
  JSON.parse(readFileSync(join(here, 'fixtures', 'wdr-ini-driver-fields.json'), 'utf8'));

/** Dispatch one of `WDR_INI_DRIVER_FIELDS`'s `.wdr`-spelled names to its own `DriverSpec`
 *  field's `Cell` — `DriverSpec`'s fields never appear as a public parameter on `OpenISDDriver`
 *  (human ruling 2026-08-24, ENCAPSULATION_AND_LAYERING.md); this file's field list is runtime
 *  data, so the dispatch lives here, written out long-form per field. */
function driverFieldCell(d: OpenISDDriver, field: string): Cell<number> | undefined {
  const spec = d.spec[d.section];
  switch (field) {
    case 'Fs': return spec.Fs_hz.get();
    case 'Re': return spec.Re_ohm.get();
    case 'Qts': return spec.Qts.get();
    case 'Qes': return spec.Qes.get();
    case 'Qms': return spec.Qms.get();
    case 'Cms': return spec.Cms_m_per_N.get();
    case 'Mms': return spec.Mms_kg.get();
    case 'Rms': return spec.Rms_kg_per_s.get();
    case 'BL': return spec.BL_Tm.get();
    case 'Sd': return spec.Sd_m2.get();
    case 'Vas': return spec.Vas_m3.get();
    case 'Dd': return spec.Dd_m.get();
    case 'Vd': return spec.Vd_m3.get();
    case 'no': return spec.no.get();
    case 'SPL': return spec.SPL_dB.get();
    case 'USPL': return spec.USPL_dB.get();
    case 'SPLmax': return spec.SPLmax_dB.get();
    case 'SPLmaxLF': return spec.SPLmaxLF_dB.get();
    case 'gamma': return spec.gamma_m_per_s2_A.get();
    case 'Rme': return spec.Rme_kg_per_s.get();
    case 'Mpow': return spec.Mpow_N_per_sqrtW.get();
    case 'Mcost': return spec.Mcost_kg_per_s.get();
    case 'Gloss': return spec.Gloss.get();
    case 'c': return spec.c_m_per_s.get();
    case 'roo': return spec.roo_kg_per_m3.get();
    default: return undefined;
  }
}

/** Dispatch one of the same `.wdr`-spelled names to its own field on the solved engine bag
 *  `OpenISDDriver.solveConsistencyGroup()` returns. Same dispatch shape and the same
 *  independent-arbiter reasoning as `driverFieldCell` above. */
function solvedFieldValue(solved: ReturnType<OpenISDDriver['solveConsistencyGroup']>, field: string): number | undefined {
  switch (field) {
    case 'Fs': return solved.Fs_hz;
    case 'Re': return solved.Re_ohm;
    case 'Qts': return solved.Qts;
    case 'Qes': return solved.Qes;
    case 'Qms': return solved.Qms;
    case 'Cms': return solved.Cms_m_per_N;
    case 'Mms': return solved.Mms_kg;
    case 'Rms': return solved.Rms_kg_per_s;
    case 'BL': return solved.BL_Tm;
    case 'Sd': return solved.Sd_m2;
    case 'Vas': return solved.Vas_m3;
    case 'Dd': return solved.Dd_m;
    case 'Vd': return solved.Vd_m3;
    case 'no': return solved.no;
    case 'SPL': return solved.SPL_dB;
    case 'USPL': return solved.USPL_dB;
    case 'SPLmax': return solved.SPLmax_dB;
    case 'SPLmaxLF': return solved.SPLmaxLF_dB;
    case 'gamma': return solved.gamma_m_per_s2_A;
    case 'Rme': return solved.Rme_kg_per_s;
    case 'Mpow': return solved.Mpow_N_per_sqrtW;
    case 'Mcost': return solved.Mcost_kg_per_s;
    case 'Gloss': return solved.Gloss;
    case 'c': return solved.c_m_per_s;
    case 'roo': return solved.roo_kg_per_m3;
    default: return undefined;
  }
}

describe('field dispatch coverage — no WinISD, no goldens', () => {
  it('driverFieldCell()/solvedFieldValue() have a case for every field in WDR_INI_DRIVER_FIELDS', () => {
    // A fixture with every WDR_INI_DRIVER_FIELDS name ENTERED — a name whose case is missing from
    // either switch returns undefined here regardless of the fixture, since a missing case
    // never reaches the field at all. Distinct synthetic values (not plausible physics) make it
    // unambiguous that a `NaN`/`undefined` result is the dispatch's own gap, not the fixture's.
    const wdrLines = ['[Driver]'];
    let i = 0;
    for (const key of WDR_INI_DRIVER_FIELDS) { wdrLines.push(`${key}=${100 + i}`); i += 1; }
    const asRead = WinISDDriver.fromWdrIni(wdrLines.join('\r\n') + '\r\n');
    const { record } = winISDDriverToOpenISDDeviceJson(asRead);
    const drv = conformingRecordToDriver(record, new Engine());
    if (Array.isArray(drv)) throw new Error(`coverage fixture is not a valid driver: ${drv.join(', ')}`);
    const solved = drv.solveConsistencyGroup();

    const noCell = WDR_INI_DRIVER_FIELDS.filter(f => driverFieldCell(drv, f) === undefined);
    assert.deepEqual(noCell, [],
      `${noCell.join(', ')} ${noCell.length === 1 ? 'is' : 'are'} in WDR_INI_DRIVER_FIELDS but ` +
      'driverFieldCell() has no case for it — add one, or the field silently reads as absent.');
    const noSolved = WDR_INI_DRIVER_FIELDS.filter(f => solvedFieldValue(solved, f) === undefined);
    assert.deepEqual(noSolved, [],
      `${noSolved.join(', ')} ${noSolved.length === 1 ? 'is' : 'are'} in WDR_INI_DRIVER_FIELDS but ` +
      'solvedFieldValue() has no case for it — add one, or the field silently reads as absent.');
  });
});
