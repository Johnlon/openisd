/**
 * `WhatIfField.forBox` — the What-if? sheet's rows for each box type: the box's own fields first, then
 * input power, the driver what-if (Fs, Qts, Vas) and the number of drivers.
 */
import {describe, expect, it} from 'vitest';
import type {BoxType} from '../../engine/index.js';
import {BOX_TYPE_OPTIONS, NumberField, WhatIfField} from '../../fields/index.js';

const COMMON = [WhatIfField.INPUT_POWER, WhatIfField.DRIVER_FS, WhatIfField.DRIVER_QTS, WhatIfField.DRIVER_VAS, WhatIfField.DRIVER_COUNT];

const EXPECTED: Readonly<Record<BoxType, readonly WhatIfField[]>> = {
  'sealed': [WhatIfField.BOX_VOLUME, ...COMMON],
  'vented': [WhatIfField.BOX_VOLUME, WhatIfField.TUNING, WhatIfField.PORT_DIAMETER, ...COMMON],
  'box-passive-radiator': [WhatIfField.BOX_VOLUME, WhatIfField.PR_ADDED_MASS, WhatIfField.PR_COUNT, ...COMMON],
  'bandpass4': [WhatIfField.REAR_VOLUME, WhatIfField.FRONT_VOLUME, WhatIfField.FRONT_TUNING, WhatIfField.PORT_DIAMETER, ...COMMON],
  'bandpass6': [WhatIfField.REAR_VOLUME, WhatIfField.FRONT_VOLUME, WhatIfField.REAR_TUNING, ...COMMON],
  'abc': [WhatIfField.REAR_VOLUME, WhatIfField.FRONT_VOLUME, WhatIfField.REAR_TUNING, ...COMMON],
};

describe('WhatIfField', () => {
  it.each(BOX_TYPE_OPTIONS.map(o => o.value))('lists the rows for a %s box', (type) => {
    expect(WhatIfField.forBox(type)).toEqual(EXPECTED[type]);
  });

  it('gives every box type a list, so none is missing', () => {
    expect(new Set(BOX_TYPE_OPTIONS.map(o => o.value))).toEqual(new Set(Object.keys(EXPECTED)));
  });

  it('edits existing registry fields only', () => {
    for (const t of WhatIfField.ALL) expect(NumberField.ALL).toContain(t.field);
  });

  it('labels each row of a box differently', () => {
    for (const o of BOX_TYPE_OPTIONS) {
      const labels = WhatIfField.forBox(o.value).map(t => t.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});
