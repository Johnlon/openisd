export {
  type SelectorOption,
  END_CORRECTION_OPTIONS,
  VENT_SHAPE_OPTIONS,
  VC_CONNECTION_OPTIONS,
  ARRAY_WIRING_OPTIONS,
  SEALED_ALIGNMENT_OPTIONS,
  VENTED_ALIGNMENT_OPTIONS,
  DEFAULT_VENTED_ALIGNMENT,
  BOX_TYPE_OPTIONS,
  FILTER_TYPE_OPTIONS,
  PASS_FAMILY_OPTIONS,
} from './options.js';

export { DEFAULT_NEW_PROJECT_VENTED_QL, DEFAULT_SOURCE_RESISTANCE_OHM } from './defaults.js';

export {
  type UnitGroup,
  type UnitDef,
  type UnitToken,
  type Unit,
  type Quantity,
  type TypedEntry,
  UNIT_GROUPS,
  isTokenIn,
  unitFor,
  toDisplay,
  toSI,
  toDisplayDelta,
  decimalsIn,
} from './dimensions.js';

export { knownDecimals } from './precision.js';

export {
  type FieldLimits,
  FILTER_ORDER_LIMITS,
  LINKWITZ_RILEY_ORDER_LIMITS,
  WINISD_MAX_FILTER_ORDER,
  FILTER_FC_LIMITS,
  FILTER_Q_LIMITS,
  FILTER_GAIN_LIMITS,
  FILTER_T_LIMITS,
  FILTER_BW_LIMITS,
} from './filterLimits.js';

/** The field registry — every field OpenISD has, one class per kind. */
export {
  type FieldKind,
  type ValueFloor,
  Field,
  NumberField,
  EnumField,
  TextField,
  ToggleField,
  DateField,
  ALL_FIELDS,
} from './field.js';

/** Where OpenISD's default differs from WinISD because it fixed a WinISD bug — the deviation cues. */
export {
  type WinisdDeviationSpec,
  type WinisdFilterDeviationSpec,
  WinisdDeviation,
  WinisdFilterDeviation,
} from './winisdDeviation.js';

/** The WinISD Compatibility panel's group headings: Enable WinISD bugs, Enable WinISD-style. */
export { CompatSwitchGroup } from './compatSwitchGroup.js';

/** The in-app help page "OpenISD and WinISD differences": its sections and entries. */
export { WinisdOption } from './winisdOption.js';
export { WinisdFixedBug } from './winisdFixedBug.js';
export { WinisdDifference } from './winisdDifference.js';
export { WinisdDifferenceSection, type WinisdDifferenceTone } from './winisdDifferenceSection.js';

/** The sealed-box loss model — a field's closed value set. */
export { LOSSLESS_Q } from './losslessQ.js';

export { formatCount, formatDate, formatDateTime, formatFixed, formatFixedOrDash } from './format.js';
export { ReadoutFormat } from './readoutFormat.js';
export { parseUnitRotation } from './unitRotation.js';
export { spinValue, roundSpun, holdStage, HOLD_START_MS, spinStepAttr, shownSpinRule, decimalsSpinRule, type SpinRule, type SpinDirection, type SpinBounds, type SpinSpeed, type HoldStage } from './spinnerStep.js';

/** The What-if? sheet's rows per box type. */
export { WhatIfField, type WhatIfSlot } from './whatIfField.js';
