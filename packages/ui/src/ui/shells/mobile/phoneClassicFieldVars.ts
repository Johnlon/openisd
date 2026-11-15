import {PhoneRowColumns, PhoneRowSizes} from '@openisd/design/fields';

/** The classic mobile number-field contract shared by the shell and classic overlays. */
export const phoneClassicFieldVars = Object.fromEntries([
  ...PhoneRowSizes.CLASSIC.cssVars(),
  ...PhoneRowColumns.STANDARD.cssVars(),
]);

/** The same without the label column: for a page root that measures its own (`createPhoneLabelColumn` is the only writer of it there). */
export const phoneClassicPageVars = Object.fromEntries([
  ...PhoneRowSizes.CLASSIC.cssVars(),
  ...PhoneRowColumns.STANDARD.cssVarsWithoutLabelColumn(),
]);
