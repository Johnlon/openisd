/**
 * `TuneField.forBox` — the Tune sheet's rows for each box type: the box's own fields first, then
 * input power, the driver what-if (Fs, Qts, Vas) and the number of drivers.
 */
import {describe, expect, it} from 'vitest';
import type {BoxType} from '../../engine/index.js';
import {BOX_TYPE_OPTIONS, NumberField, TuneField} from '../../fields/index.js';

const COMMON = [TuneField.INPUT_POWER, TuneField.DRIVER_FS, TuneField.DRIVER_QTS, TuneField.DRIVER_VAS, TuneField.DRIVER_COUNT];

const EXPECTED: Readonly<Record<BoxType, readonly TuneField[]>> = {
  'sealed': [TuneField.BOX_VOLUME, ...COMMON],
  'vented': [TuneField.BOX_VOLUME, TuneField.TUNING, TuneField.PORT_DIAMETER, ...COMMON],
  'box-passive-radiator': [TuneField.BOX_VOLUME, TuneField.PR_ADDED_MASS, TuneField.PR_COUNT, ...COMMON],
  'bandpass4': [TuneField.REAR_VOLUME, TuneField.FRONT_VOLUME, TuneField.FRONT_TUNING, TuneField.PORT_DIAMETER, ...COMMON],
  'bandpass6': [TuneField.REAR_VOLUME, TuneField.FRONT_VOLUME, TuneField.REAR_TUNING, ...COMMON],
  'abc': [TuneField.REAR_VOLUME, TuneField.FRONT_VOLUME, TuneField.REAR_TUNING, ...COMMON],
};

describe('TuneField', () => {
  it.each(BOX_TYPE_OPTIONS.map(o => o.value))('lists the rows for a %s box', (type) => {
    expect(TuneField.forBox(type)).toEqual(EXPECTED[type]);
  });

  it('gives every box type a list, so none is missing', () => {
    expect(new Set(BOX_TYPE_OPTIONS.map(o => o.value))).toEqual(new Set(Object.keys(EXPECTED)));
  });

  it('edits existing registry fields only', () => {
    for (const t of TuneField.ALL) expect(NumberField.ALL).toContain(t.field);
  });

  it('labels each row of a box differently', () => {
    for (const o of BOX_TYPE_OPTIONS) {
      const labels = TuneField.forBox(o.value).map(t => t.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
