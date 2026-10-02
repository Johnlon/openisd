import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

// The decimals WinISD's driver editor shows, per field, in the unit OpenISD shows it in by
// default. OpenISD shows at least as many (John, 2026-10-02).
const WINISD_DECIMALS: readonly (readonly [NumberField, number])[] = [
  [NumberField.QTS, 3], [NumberField.QES, 3], [NumberField.QMS, 3],
  [NumberField.FS_HZ, 2], [NumberField.VAS_M3, 2], [NumberField.MMS_KG, 2],
  [NumberField.CMS_M_PER_N, 3], [NumberField.RMS_KG_PER_S, 5], [NumberField.RE_OHM, 3],
  [NumberField.BL_TM, 5], [NumberField.DD_M, 1], [NumberField.LE_H, 2], [NumberField.SD_M2, 1],
  [NumberField.FLE_HZ, 2], [NumberField.KLE_H_SQRTHZ, 3], [NumberField.XMAX_M, 1],
  [NumberField.HC_M, 1], [NumberField.HG_M, 1], [NumberField.VD_M3, 0], [NumberField.NO, 4],
  [NumberField.ZNOM_OHM, 4], [NumberField.USPL_DB, 2], [NumberField.SPL_DB, 2],
];

describe('NumberField.precision — never fewer decimals than WinISD shows', () => {
  for (const [field, winisd] of WINISD_DECIMALS) {
    it(`${field.value} shows at least ${winisd} dp`, () => {
      expect(field.precision).toBeGreaterThanOrEqual(winisd);
    });
  }
});
