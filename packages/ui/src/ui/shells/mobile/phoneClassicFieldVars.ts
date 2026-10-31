import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/** The classic mobile number-field contract shared by the shell and classic overlays. */
export const phoneClassicFieldVars = Object.fromEntries([
  ...PhoneRowSizes.CLASSIC.cssVars(),
  ...PhoneRowColumns.STANDARD.cssVars(),
]);
