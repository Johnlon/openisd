/**
 * A loaded air value, driver count or series resistance is no longer repaired (QO972), but a TYPED one is
 * unchanged: the box refuses it with a note and the old value stays. The refusal is `entryRefusal`
 * over the field's own floor and band, the same bounds `NumInput` builds.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '@openisd/design/fields';
import {entryRefusal, type EntryBounds} from '../../src/logic/entryRefusal.js';

function boundsOf(field: NumberField, allowOutOfRange: boolean): EntryBounds {
  const bounds: EntryBounds = {
    label: field.label, unit: '', floor: field.floor, min: field.limits.min, max: field.limits.max,
    minimumReason: field.minimumReason, show: si => String(si),
  };
  return allowOutOfRange ? {...bounds, min: -Infinity, max: undefined} : bounds;
}

describe('a typed impossible value is still refused with a note (QO972: only loaded values changed)', () => {
  const cases: ReadonlyArray<readonly [NumberField, number, boolean]> = [
    [NumberField.DRIVER_NDRIVERS, 0, false],
    [NumberField.SIGNAL_RS_OHM, -2, false],
    [NumberField.ADV_TEMP_K, 0, true],
    [NumberField.ADV_PRESSURE_KPA, 0, true],
    [NumberField.ADV_SOUNDVELOCITY_M_PER_S, 0, true],
    [NumberField.ADV_AIRDENSITY_KG_PER_M3, 0, true],
    [NumberField.ADV_HUMIDITY_PCT, 150, false],
  ];
  for (const [field, typed, allowOutOfRange] of cases) {
    it(`${field.label} ${typed} is refused with a note`, () => {
      expect(entryRefusal(boundsOf(field, allowOutOfRange), {kind: 'number', si: typed})).not.toBe('');
    });
  }
});
