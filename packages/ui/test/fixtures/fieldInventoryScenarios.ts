import {EnumField, FIELD_APPEARANCES, FieldAccess, FieldCue, FieldEditor, FieldUnits, NumberField, PhoneLabels, type FieldAppearance} from '@openisd/design/fields';
import type {ExpectedFieldOccurrence, ExpectedFieldOption, ExpectedFieldPart} from './fieldInventory.js';

const valueSelector = 'input,select,textarea,meter,.mob-readonly,[role="checkbox"],.catalogue-colour-readout';
const fieldSelector = (field: NumberField) => `.ui-field[data-field="${field.value}"]`;
const enabledParts = (parts: readonly Omit<ExpectedFieldPart, 'disabled'>[]): readonly ExpectedFieldPart[] => parts.map(part => ({...part, disabled: false}));
interface NumericContext {
  readonly access: FieldAccess;
  readonly stepper: boolean;
  readonly modelCues: number;
  readonly dqCues: number;
  readonly label?: string;
}
const EDITABLE: NumericContext = {access: FieldAccess.Writable, stepper: true, modelCues: 0, dqCues: 0};
const READONLY: NumericContext = {access: FieldAccess.Readonly, stepper: false, modelCues: 0, dqCues: 0};
function numericOccurrence(field: NumberField, context: NumericContext): ExpectedFieldOccurrence {
  const readonly = context.access === FieldAccess.Readonly;
  const token = field.unitTokenFor({});
  const unit = field.unitLabel(token);
  const switchable = field.display.kind === 'switchable' && field.nextToken(token) !== token;
  return {
    key: field.value, owner: fieldSelector(field), valueSelector,
    editorSelector: readonly ? '.ui-field-value > input[type="text"][readonly]:not([data-numinput])' : '.num-input-wrap > input[type="text"][data-numinput]',
    ownerAttributes: {'data-access': context.access}, nativeReadOnly: readonly, nativeChecked: null,
    valueAttributes: {contenteditable: null, tabindex: null}, disabled: false, options: null,
    parts: enabledParts([
      {name: 'label', selector: 'label.ui-field-label', count: 1, visible: true, text: context.label ?? field.label},
      {name: 'unit', selector: '.ui-field-unit', count: 1, visible: unit !== '', text: unit, attributes: switchable ? {role: 'button', tabindex: '0'} : {role: null, tabindex: null}},
      {name: 'spinners', selector: '.num-stepper > button.num-stepper-btn', count: context.stepper ? 2 : 0, visible: true, attributes: {type: 'button', tabindex: null}},
      {name: 'increase button', selector: '.num-stepper > button.num-stepper-btn[title="Increase"]', count: context.stepper ? 1 : 0, visible: true, text: '▲'},
      {name: 'decrease button', selector: '.num-stepper > button.num-stepper-btn[title="Decrease"]', count: context.stepper ? 1 : 0, visible: true, text: '▼'},
      {name: 'model cue', selector: 'button.winisd-deviation-cue', count: context.modelCues, visible: true, text: '≠W', attributes: {type: 'button', 'aria-haspopup': 'dialog', tabindex: null}},
      {name: 'DQ cue', selector: 'button.ui-field-dq-btn', count: context.dqCues, visible: true, attributes: {type: 'button', tabindex: null}},
    ]),
  };
}
function expectedOptions(options: readonly {value: string | number; label: string}[]): readonly ExpectedFieldOption[] {
  return options.map(option => ({value: String(option.value), label: option.label, disabled: false}));
}
function choice(key: string, owner: string, label: string, options: readonly {value: string | number; label: string}[]): ExpectedFieldOccurrence {
  return {key, owner, valueSelector: 'select', editorSelector: 'select', ownerAttributes: {}, valueAttributes: {tabindex: null},
    nativeReadOnly: null, nativeChecked: null, disabled: false, options: expectedOptions(options),
    parts: enabledParts([{name: 'label', selector: 'label', count: 1, visible: true, text: label}])};
}
function closedBoxInventory(phone: boolean): readonly ExpectedFieldOccurrence[] {
  return [
    choice(EnumField.BOX_TYPE.value, '.mob-crow:has(> #mob-box-type),.field:has(> #og-box-type)', phone ? 'Box type' : 'Box Type', EnumField.BOX_TYPE.options),
    numericOccurrence(NumberField.BOX_VB_L, {...EDITABLE, label: phone ? PhoneLabels.VB : NumberField.BOX_VB_L.label}),
    numericOccurrence(NumberField.BOX_FSC_HZ, {...EDITABLE, modelCues: 1}),
    numericOccurrence(NumberField.BOX_QTC_VALUE, {...EDITABLE, modelCues: 1}),
  ];
}
/** Contextual bindings and complete groups are declared independently of rendered attributes. */
export const CLOSED_BOX_INVENTORY = closedBoxInventory(true);
export const DESKTOP_CLOSED_BOX_INVENTORY = closedBoxInventory(false);
export const PHONE_DRIVER_INVENTORY: readonly ExpectedFieldOccurrence[] = [
  choice(NumberField.DRIVER_NDRIVERS.value, '.mob-crow:has(> #mob-n-drivers)', PhoneLabels.DRIVERS, NumberField.DRIVER_NDRIVERS.countOptions()),
  choice(EnumField.DRIVER_ARRAYWIRING.value, '.mob-crow:has(> #mob-wiring)', PhoneLabels.CONNECTION, EnumField.DRIVER_ARRAYWIRING.options),
  ...[NumberField.FS_HZ, NumberField.QTS, NumberField.VAS_M3, NumberField.RE_OHM, NumberField.XMAX_M].map(field => numericOccurrence(field, READONLY)),
];
export const PHONE_SIGNAL_INVENTORY: readonly ExpectedFieldOccurrence[] = [
  numericOccurrence(NumberField.SIGNAL_PIN_W, {...EDITABLE, label: PhoneLabels.POWER}),
  numericOccurrence(NumberField.SIGNAL_DRIVEV_V, {...EDITABLE, label: PhoneLabels.VOLTS}),
  numericOccurrence(NumberField.SIGNAL_RS_OHM, {...EDITABLE, label: PhoneLabels.RS}),
];
export const PHONE_ALLPASS_INVENTORY: readonly ExpectedFieldOccurrence[] = [
  {key: 'Allpass enabled', owner: '.mob-fcard-tick', valueSelector: 'input', editorSelector: 'input[type="checkbox"]',
    ownerAttributes: {}, valueAttributes: {'aria-label': 'AP on', tabindex: null}, nativeReadOnly: false, nativeChecked: true, disabled: false, options: null, parts: []},
  numericOccurrence(NumberField.FILTER_ORDER, {...EDITABLE, modelCues: 1, label: PhoneLabels.ORDER}),
  numericOccurrence(NumberField.FILTER_Q, {...EDITABLE, label: PhoneLabels.Q}),
  numericOccurrence(NumberField.FILTER_T_S, {...EDITABLE, label: PhoneLabels.T}),
];


interface CatalogueEditor {
  readonly selector: string;
  readonly nativeReadOnly: boolean | null;
  readonly options: readonly ExpectedFieldOption[] | null;
  readonly attributes?: Readonly<Record<string, string | null>>;
}
const textInput = (readonly: boolean): CatalogueEditor => ({selector: 'input:not([type]),input[type="text"]', nativeReadOnly: readonly, options: null});
const typedInput = (type: string, readonly: boolean): CatalogueEditor => ({selector: `input[type="${type}"]`, nativeReadOnly: readonly, options: null});
const readonlyCheckbox: CatalogueEditor = {selector: 'span[role="checkbox"]', nativeReadOnly: null, options: null, attributes: {'aria-readonly': 'true', 'aria-checked': 'false'}};
/** Total semantic map: adding an editor family cannot silently disappear from the inventory. */
const CATALOGUE_EDITORS: Readonly<Record<FieldEditor, Readonly<Record<FieldAccess, CatalogueEditor>>>> = {
  [FieldEditor.Number]: {
    [FieldAccess.Writable]: {selector: '.num-input-wrap > input[type="text"][data-numinput]', nativeReadOnly: false, options: null},
    [FieldAccess.Readonly]: {selector: '.ui-field-value > input[type="text"][readonly]:not([data-numinput])', nativeReadOnly: true, options: null},
  },
  [FieldEditor.Count]: {
    [FieldAccess.Writable]: {selector: 'select', nativeReadOnly: null, options: expectedOptions(NumberField.PR_NUM.countOptions())},
    [FieldAccess.Readonly]: {selector: '.ui-field-value > input[type="text"][readonly]:not([data-numinput])', nativeReadOnly: true, options: null},
  },
  [FieldEditor.Choice]: {
    [FieldAccess.Writable]: {selector: 'select', nativeReadOnly: null, options: expectedOptions(EnumField.VENT_SHAPE.options)},
    [FieldAccess.Readonly]: textInput(true),
  },
  [FieldEditor.Text]: {[FieldAccess.Writable]: textInput(false), [FieldAccess.Readonly]: textInput(true)},
  [FieldEditor.Multiline]: {
    [FieldAccess.Writable]: {selector: 'textarea', nativeReadOnly: false, options: null},
    [FieldAccess.Readonly]: {selector: 'textarea', nativeReadOnly: true, options: null},
  },
  [FieldEditor.Date]: {[FieldAccess.Writable]: typedInput('date', false), [FieldAccess.Readonly]: typedInput('date', true)},
  [FieldEditor.Boolean]: {[FieldAccess.Writable]: {...typedInput('checkbox', false), selector: 'input[type="checkbox"]:not(.catalogue-bug)'}, [FieldAccess.Readonly]: {...readonlyCheckbox, selector: 'span[role="checkbox"]:not(.catalogue-bug)'}},
  [FieldEditor.BugToggle]: {[FieldAccess.Writable]: {selector: 'input[type="checkbox"].catalogue-bug', nativeReadOnly: false, options: null}, [FieldAccess.Readonly]: {...readonlyCheckbox, selector: 'span.catalogue-bug[role="checkbox"]'}},
  [FieldEditor.Colour]: {
    [FieldAccess.Writable]: typedInput('color', false),
    [FieldAccess.Readonly]: {selector: 'span.catalogue-colour-readout', nativeReadOnly: null, options: null},
  },
  [FieldEditor.Range]: {
    [FieldAccess.Writable]: typedInput('range', false),
    [FieldAccess.Readonly]: {selector: 'meter', nativeReadOnly: null, options: null},
  },
};
const CATALOGUE_UNIT_LABELS: Readonly<Record<FieldUnits, string>> = {
  [FieldUnits.None]: '', [FieldUnits.Fixed]: 'kg/m³', [FieldUnits.Switchable]: 'Hz',
};
function catalogueOccurrence(form: FieldAppearance): ExpectedFieldOccurrence {
  const editor = CATALOGUE_EDITORS[form.editor][form.access];
  const numeric = form.editor === FieldEditor.Number || form.editor === FieldEditor.Count;
  const unitSlot = numeric || form.editor === FieldEditor.Range;
  const dq = form.cue === FieldCue.Dq || form.cue === FieldCue.Both;
  const model = form.cue === FieldCue.Model || form.cue === FieldCue.Both;
  return {
    key: form.id, owner: `[data-specimen="${form.id}"] .ui-field`, valueSelector, editorSelector: editor.selector,
    ownerAttributes: numeric ? {'data-access': form.access} : {}, valueAttributes: {tabindex: null, ...editor.attributes},
    nativeReadOnly: editor.nativeReadOnly, nativeChecked: form.access === FieldAccess.Writable && (form.editor === FieldEditor.Boolean || form.editor === FieldEditor.BugToggle) ? false : null, disabled: false, options: editor.options,
    parts: enabledParts([
      {name: 'label', selector: 'label.ui-field-label', count: 1, visible: true, text: 'Value'},
      {name: 'unit', selector: '.ui-field-unit', count: unitSlot ? 1 : 0, visible: form.units !== FieldUnits.None,
        text: CATALOGUE_UNIT_LABELS[form.units],
        attributes: form.units === FieldUnits.Switchable ? {role: 'button', tabindex: '0'} : {role: null, tabindex: null}},
      {name: 'spinners', selector: '.num-stepper > button.num-stepper-btn', count: form.stepper ? 2 : 0, visible: true, attributes: {type: 'button', tabindex: null}},
      {name: 'increase button', selector: '.num-stepper > button.num-stepper-btn[title="Increase"]', count: form.stepper ? 1 : 0, visible: true, text: '▲'},
      {name: 'decrease button', selector: '.num-stepper > button.num-stepper-btn[title="Decrease"]', count: form.stepper ? 1 : 0, visible: true, text: '▼'},
      {name: 'model cue', selector: 'button.winisd-deviation-cue', count: model ? 1 : 0, visible: true, text: '≠W', attributes: {type: 'button', 'aria-haspopup': 'dialog', tabindex: null}},
      {name: 'DQ cue', selector: 'button.ui-field-dq-btn', count: dq ? 1 : 0, visible: true, text: '⚠', attributes: {type: 'button', tabindex: null}},
    ]),
  };
}
/** Accounts for every family and declared base form; this does not approve proposed paint. */
export const CATALOGUE_INVENTORY: readonly ExpectedFieldOccurrence[] = FIELD_APPEARANCES.map(catalogueOccurrence);

/** Frozen current base-form cardinality:36 numbers+8 counts+8 choices+12 text/date+4 booleans+2 bug+2 colour+24 range. Not design approval. */
export const CATALOGUE_REFERENCE_BASE_FORM_COUNT = 96;
