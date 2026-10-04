// Picks the unit tokens the user has rotated to (presentationState.ui.unitTokens) and hands them
// to the design readout formats, so a number and its unit label both follow the rotation.
import type {NumberField, ReadoutFormat} from '@openisd/design/fields';
import {presentationState} from '../logic/presentationState.js';

export function useUnitReadouts() {
  const tokens = (): Record<string, string> => presentationState.ui.unitTokens ?? {};
  return {
    /** A ReadoutFormat value in the rotated unit, with its label; `absent` when `v` is missing. */
    readoutWithUnit: (format: ReadoutFormat, v: number | null | undefined, absent: string): string =>
      format.textWithUnit(v, absent, tokens()),
    /** The label of a ReadoutFormat in the rotated unit. */
    readoutUnitLabel: (format: ReadoutFormat): string => format.unitLabel(tokens()),
    /** A registered field's value (SI) in its rotated unit, with its label; `absent` when `v` is missing. */
    fieldWithUnit: (field: NumberField, v: number | null | undefined, absent: string): string => {
      if (v === null || v === undefined) return absent;
      const token = field.unitTokenFor(tokens());
      return `${field.format(v, null, token)} ${field.unitLabel(token)}`;
    },
    /** The label of a registered field in its rotated unit. */
    fieldUnitLabel: (field: NumberField): string => field.unitLabel(field.unitTokenFor(tokens())),
  };
}
