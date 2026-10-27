import {DateField, EnumField, type Field, NumberEditor, NumberField, TextField, ToggleField} from './field.js';

export enum FieldEditor { Number = 'number', Count = 'count', Choice = 'choice', Text = 'text', Multiline = 'multiline', Date = 'date', Boolean = 'boolean', BugToggle = 'bug-toggle', Colour = 'colour', Range = 'range' }
export enum FieldAccess { Writable = 'writable', Readonly = 'readonly' }
export enum FieldUnits { None = 'none', Fixed = 'fixed', Switchable = 'switchable' }
export enum FieldCue { None = 'none', Dq = 'dq', Model = 'model', Both = 'both' }

export interface FieldAppearance {
  readonly id: string;
  readonly editor: FieldEditor;
  readonly access: FieldAccess;
  readonly units: FieldUnits;
  readonly cue: FieldCue;
  readonly stepper: boolean;
}

/** Appearance follows semantic identity, never a CSS class or the control a view happened to draw. */
export function appearanceFor(field: Field): {readonly editor: FieldEditor; readonly units: FieldUnits} {
  if (field instanceof NumberField) return {
    editor: field.editor === NumberEditor.CountSelect ? FieldEditor.Count : FieldEditor.Number,
    units: field.display.kind === 'switchable' ? FieldUnits.Switchable : field.display.symbol === '' ? FieldUnits.None : FieldUnits.Fixed,
  };
  if (field instanceof EnumField) return {editor: FieldEditor.Choice, units: FieldUnits.None};
  if (field instanceof TextField) return {editor: field === TextField.DRIVER_COMMENT ? FieldEditor.Multiline : FieldEditor.Text, units: FieldUnits.None};
  if (field instanceof DateField) return {editor: FieldEditor.Date, units: FieldUnits.None};
  if (field instanceof ToggleField) return {editor: field.seenIn === null ? FieldEditor.Boolean : FieldEditor.BugToggle, units: FieldUnits.None};
  throw new Error(`Uncatalogued field kind: ${field.value}`);
}

const CUES = Object.freeze([FieldCue.None, FieldCue.Dq, FieldCue.Model, FieldCue.Both]);
const FAMILIES = Object.freeze(Object.values(FieldEditor));
const ACCESS = Object.freeze(Object.values(FieldAccess));
const UNITS = Object.freeze(Object.values(FieldUnits));

function forms(): readonly FieldAppearance[] {
  const out: FieldAppearance[] = [];
  for (const editor of FAMILIES) for (const access of ACCESS) {
    const quantities = editor === FieldEditor.Number || editor === FieldEditor.Range;
    const unitKinds = quantities ? UNITS : [FieldUnits.None];
    const cueKinds = editor === FieldEditor.BugToggle || editor === FieldEditor.Colour ? [FieldCue.None]
      : editor === FieldEditor.Boolean ? [FieldCue.None, FieldCue.Model]
      : editor === FieldEditor.Text || editor === FieldEditor.Multiline || editor === FieldEditor.Date ? [FieldCue.None, FieldCue.Dq] : CUES;
    const steppers = editor === FieldEditor.Number && access === FieldAccess.Writable ? [true, false] : [false];
    for (const units of unitKinds) for (const cue of cueKinds) for (const stepper of steppers) {
      out.push(Object.freeze({id: `${editor}-${access}-${units}-${cue}${editor === FieldEditor.Number && access === FieldAccess.Writable && !stepper ? '-no-stepper' : ''}`, editor, access, units, cue, stepper}));
    }
  }
  return Object.freeze(out);
}

/** Constrained product: no unit-bearing text/counts, no readout steppers, no imaginary boolean DQ. */
export const FIELD_APPEARANCES = forms();

/** Demonstration values for the appearance catalogue, not application environment defaults. */
export const FIELD_APPEARANCE_SAMPLES: Readonly<Record<FieldUnits, number>> = Object.freeze({
  [FieldUnits.None]: 5,
  [FieldUnits.Fixed]: 1.2041,
  [FieldUnits.Switchable]: 31.8309886,
});
