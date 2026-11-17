import {describe, expect, it} from 'vitest';
import {NumberField, PhoneHelp, PhoneLabels, unitFor} from '../../fields/index.js';

/** #515 / T790: weight and the rectangular frame size are shown on the Dimensions view. */
describe('driver size fields (weight, OuterX, OuterY)', () => {
  const FIELDS = [
    [NumberField.WEIGHT_KG, 'weight_kg', 'kg', PhoneLabels.WEIGHT, 'Weight'],
    [NumberField.OUTERX_M, 'OuterX_m', 'mm', PhoneLabels.OUTER_X, 'OuterX'],
    [NumberField.OUTERY_M, 'OuterY_m', 'mm', PhoneLabels.OUTER_Y, 'OuterY'],
  ] as const;

  for (const [field, key, unit, phoneLabel, phoneText] of FIELDS) {
    it(`${key} is a field with its unit, a description and a phone label`, () => {
      expect(field.value).toBe(key);
      expect(field.display.kind).toBe('switchable');
      if (field.display.kind === 'switchable') expect(unitFor(field.display.group, field.display.base).label).toBe(unit);
      expect(field.description).toMatch(/WinISD has no such field/);
      expect(phoneLabel).toBe(phoneText);
    });
  }

  it('the phone Dimensions help explains both', () => {
    const text = PhoneHelp.EDITOR_DIMENSIONS.rows.map(r => `${r.label} ${r.text}`).join(' ');
    expect(text).toMatch(/OuterX/);
    expect(text).toMatch(/Weight/);
  });
});
