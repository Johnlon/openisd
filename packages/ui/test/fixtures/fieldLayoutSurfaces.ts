/**
 * Every component under packages/ui/src that draws a number box or count dropdown (it imports the common
 * field), and where the field layout gate (ui/field-layout-rules.browser.spec.ts) opens it.
 * John, 10 Nov 2026: "I need the test to fail if all screens are not checked; if new screens are added or
 * popups then they must be auto included". architecture/field-layout-surfaces.test.ts fails on a component
 * missing here and on a screen id the spec does not walk. A screen the spec cannot open yet is `known`, with its bug file.
 */
export type Surface =
  | {readonly kind: 'walked'; readonly screens: readonly string[]}
  | {readonly kind: 'known'; readonly bug: string};

const GATE_BUG = 'BUG_20261110_layout-gate-misses-screens';
const walked = (...screens: string[]): Surface => ({kind: 'walked', screens});
const known: Surface = {kind: 'known', bug: GATE_BUG};

export const SURFACES: Readonly<Record<string, Surface>> = {
  'ui/components/DriverEditorModal.vue': walked('phone Driver editor General', 'phone Driver editor Parameters', 'phone Driver editor Advanced', 'phone Driver editor Dimensions'),
  'ui/components/FieldCatalogue.vue': known,
  'ui/components/NewProjectPassiveRadiatorStep.vue': walked('desktop New project wizard radiator step', 'phone New project wizard radiator step'),
  'ui/components/OptionsModal.vue': known,
  'ui/components/VentPortFields.vue': known,
  'ui/components/WhatIfBoxField.vue': walked('desktop What-if panel'),
  'ui/shells/mobile/MobileAdvancedTab.vue': walked('phone Advanced page'),
  'ui/shells/mobile/MobileBoxTab.vue': walked('phone vented every tab'),
  'ui/shells/mobile/MobileDriverTab.vue': walked('phone vented every tab'),
  'ui/shells/mobile/MobileEnclosureTab.vue': walked('phone vented every tab'),
  'ui/shells/mobile/MobileNewProject.vue': walked('phone New project wizard step 2'),
  'ui/shells/mobile/MobileSheet.vue': known,
  'ui/shells/mobile/MobileSignalTab.vue': walked('phone vented every tab'),
  'ui/shells/mobile/filters/AllpassFields.vue': known,
  'ui/shells/mobile/filters/LinkwitzFields.vue': known,
  'ui/shells/mobile/filters/ParametricEqFields.vue': known,
  'ui/shells/mobile/filters/PassFields.vue': known,
  'ui/shells/mobile/filters/PeakHighpassFields.vue': known,
  'ui/shells/mobile/filters/RaisedCosineFields.vue': known,
  'ui/shells/mobile/filters/ShelfFields.vue': known,
  'ui/shells/mobile/filters/StaticGainFields.vue': known,
  'ui/shells/original/OriginalNewProject.vue': walked('desktop New project wizard step 2'),
  'ui/shells/original/OriginalShell.vue': walked('desktop vented every tab'),
  'ui/shells/original/OriginalWhatIf.vue': walked('desktop What-if panel'),
  'ui/shells/original/filters/AllpassEditor.vue': known,
  'ui/shells/original/filters/LinkwitzTransformEditor.vue': known,
  'ui/shells/original/filters/ParametricEqEditor.vue': known,
  'ui/shells/original/filters/PassFilterEditor.vue': known,
  'ui/shells/original/filters/PeakHighpassEditor.vue': known,
  'ui/shells/original/filters/RaisedCosineEditor.vue': known,
  'ui/shells/original/filters/ShelfEditor.vue': known,
  'ui/shells/original/filters/StaticGainEditor.vue': known,
};
