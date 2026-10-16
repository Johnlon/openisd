/**
 * `SheetField.forBox` — the sheet's rows for each box type: the box's own fields first, then
 * input power, the driver specs (Fs, Qts, Vas) and the number of drivers.
 */
import {describe, expect, it} from 'vitest';
import type {BoxType} from '../../engine/types.js';
import {NumberField} from '../../fields/field.js';
import {BOX_TYPE_OPTIONS} from '../../fields/options.js';
import {SheetField} from '../../fields/sheetField.js';
const COMMON = [SheetField.INPUT_POWER, SheetField.DRIVER_FS, SheetField.DRIVER_QTS, SheetField.DRIVER_VAS, SheetField.DRIVER_COUNT];

const EXPECTED: Readonly<Record<BoxType, readonly SheetField[]>> = {
  'sealed': [SheetField.BOX_VOLUME, ...COMMON],
  'vented': [SheetField.BOX_VOLUME, SheetField.TUNING, SheetField.PORT_AREA, ...COMMON],
  'box-passive-radiator': [SheetField.BOX_VOLUME, SheetField.PR_ADDED_MASS, SheetField.PR_COUNT, ...COMMON],
  'bandpass4': [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.FRONT_TUNING, SheetField.PORT_AREA, ...COMMON],
  'bandpass6': [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.REAR_TUNING,
    SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA, ...COMMON],
  'abc': [SheetField.REAR_VOLUME, SheetField.FRONT_VOLUME, SheetField.REAR_TUNING,
    SheetField.REAR_PORT_AREA, SheetField.FRONT_PORT_AREA, SheetField.INTRA_PORT_AREA, ...COMMON],
};

describe('SheetField', () => {
  it.each(BOX_TYPE_OPTIONS.map(o => o.value))('lists the rows for a %s box', (type) => {
    expect(SheetField.forBox(type)).toEqual(EXPECTED[type]);
  });

  it('gives every box type a list, so none is missing', () => {
    expect(new Set(BOX_TYPE_OPTIONS.map(o => o.value))).toEqual(new Set(Object.keys(EXPECTED)));
  });

  it('edits existing registry fields only', () => {
    for (const t of SheetField.ALL) expect(NumberField.ALL).toContain(t.field);
  });

  it('labels each row of a box differently', () => {
    for (const o of BOX_TYPE_OPTIONS) {
      const labels = SheetField.forBox(o.value).map(t => t.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('names the port a port-area row opens, and no other row opens one', () => {
    expect(SheetField.ALL.filter(f => f.portTitle !== null).map(f => f.portTitle)).toEqual(['Port', 'Rear port', 'Front port', 'Intra port']);
    expect(SheetField.ALL.filter(f => f.portTitle !== null).every(f => f.label.endsWith('port area') || f.label === 'Port area')).toBe(true);
  });
});
