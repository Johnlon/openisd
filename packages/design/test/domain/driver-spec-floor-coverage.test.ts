/**
 * Every driver spec field's floor is stated exactly once — on its own `NumberField` where the
 * registry has one, in `FLOOR_WITHOUT_FIELD` for the handful it does not. A new spec field that
 * lands in neither would silently take 'none' and stop being checked at all, so this names it.
 *
 * bugs/archive/BUG_20260928_three_tables_disagree_on_field_validity.md.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';
import {DRIVER_SPEC_FIELD_NAMES} from '../../domain/driver/driverSpecFieldName.js';
import {driverSpecFloor} from '../../domain/driver/openIsdDriverSpec.js';

/** The spec fields the registry has no `NumberField` for — nobody has stated a band for them,
 *  so there is nothing to hang the floor on and the domain states it beside the registry. */
const EXPECTED_WITHOUT_FIELD = [
  'VCCon', 'Dia_m', 'freq_low_hz', 'freq_high_hz', 'weight_kg', 'OuterX_m', 'OuterY_m',
];

describe('every driver spec field has a floor, stated once', () => {
  it('states it on the field wherever the registry has one', () => {
    const withoutField = DRIVER_SPEC_FIELD_NAMES.filter(name => !NumberField.named(name));
    expect([...withoutField].sort()).toEqual([...EXPECTED_WITHOUT_FIELD].sort());
  });

  it('answers a real floor for every name', () => {
    for (const name of DRIVER_SPEC_FIELD_NAMES) {
      expect(['positive', 'non-negative', 'none']).toContain(driverSpecFloor(name));
    }
  });

  it("leaves nothing silently floorless — only the dB LEVELS answer 'none'", () => {
    const none = DRIVER_SPEC_FIELD_NAMES.filter(n => driverSpecFloor(n) === 'none');
    expect([...none].sort()).toEqual(['SPLmaxLF_dB', 'SPLmax_dB', 'SPL_dB', 'USPL_dB', 'VCCon'].sort());
  });
});
