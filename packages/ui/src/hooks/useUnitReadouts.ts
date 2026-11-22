// Picks the unit tokens the user has rotated to (presentationState.ui.unitTokens) and hands them
// to the design readout formats, so a number and its unit label both follow the rotation.
import type {NumberField, Quantity, ReadoutFormat} from '@openisd/design/fields';
import {useApp} from '../logic/app.js';

/** A registered field's reading in the selected unit, with its unit label. */
export function formatFieldWithUnit(field: NumberField, reading: Quantity | null, tokens: Readonly<Record<string, string>>, maxSignificant: number): string {
  if (reading === null) return '';
  const token = field.unitTokenFor(tokens);
  return `${field.format(reading, null, token, maxSignificant)} ${field.unitLabel(token)}`;
}

export function useUnitReadouts() {
  const presentationState = useApp().presentation;
  const tokens = (): Record<string, string> => presentationState.ui.unitTokens ?? {};
  return {
    /** A ReadoutFormat value in the rotated unit, with its label; `absent` when `v` is missing. */
    readoutWithUnit: (format: ReadoutFormat, v: number | null | undefined, absent: string): string =>
      format.textWithUnit(v, absent, tokens()),
    /** The label of a ReadoutFormat in the rotated unit. */
    readoutUnitLabel: (format: ReadoutFormat): string => format.unitLabel(tokens()),
    /** The label of a registered field in its rotated unit. */
    fieldUnitLabel: (field: NumberField): string => field.unitLabel(field.unitTokenFor(tokens())),
  };
}
