import {describe, expect, it} from 'vitest';
import {FIELD_APPEARANCES, FieldEditor, FieldAccess, FieldUnits, FieldCue, appearanceFor} from '../../fields/fieldAppearance.js';
import {ALL_FIELDS, NumberField} from '../../fields/field.js';

describe('field appearance catalogue', () => {
  it('includes every numeric access/unit/cue combination, and steppers only on writable numbers', () => {
    const numbers = FIELD_APPEARANCES.filter(form => form.editor === FieldEditor.Number);
    expect(numbers).toHaveLength(36);
    expect(numbers.filter(form => form.access === FieldAccess.Readonly)).toHaveLength(12);
    expect(numbers.filter(form => form.access === FieldAccess.Readonly && form.stepper)).toEqual([]);
    expect(new Set(FIELD_APPEARANCES.map(form => form.id)).size).toBe(FIELD_APPEARANCES.length);
    expect(FIELD_APPEARANCES.find(form => form.id === 'number-readonly-switchable-both')).toMatchObject({units: FieldUnits.Switchable, cue: FieldCue.Both, stepper: false});
  });

  it('retains every declared base family instead of shrinking the catalogue with its renderer', () => {
    const expected: Readonly<Record<FieldEditor, number>> = {
      [FieldEditor.Number]: 36, [FieldEditor.Count]: 8, [FieldEditor.Choice]: 8,
      [FieldEditor.Text]: 4, [FieldEditor.Multiline]: 4, [FieldEditor.Date]: 4,
      [FieldEditor.Boolean]: 4, [FieldEditor.BugToggle]: 2, [FieldEditor.Colour]: 2, [FieldEditor.Range]: 24,
    };
    expect(FIELD_APPEARANCES).toHaveLength(96);
    for (const editor of Object.values(FieldEditor)) expect(FIELD_APPEARANCES.filter(form => form.editor === editor)).toHaveLength(expected[editor]);
  });

  it('maps every registered intrinsic field type and keeps count controls distinct from integer measurements', () => {
    for (const field of ALL_FIELDS) expect(appearanceFor(field)).toBeDefined();
    expect(appearanceFor(NumberField.DRIVER_NDRIVERS)).toEqual({editor: FieldEditor.Count, units: FieldUnits.None});
    expect(appearanceFor(NumberField.FILTER_ORDER).editor).toBe(FieldEditor.Number);
    expect(FIELD_APPEARANCES.filter(form => form.editor === FieldEditor.Count).every(form => form.units === FieldUnits.None && !form.stepper)).toBe(true);
  });
});
