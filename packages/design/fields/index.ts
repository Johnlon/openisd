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

/** The sealed-box loss model — a field's closed value set. */
export { LOSSLESS_Q } from './losslessQ.js';

export { formatFixed, formatFixedOrDash } from './format.js';
export { ReadoutFormat } from './readoutFormat.js';
export { parseUnitRotation } from './unitRotation.js';
export { spinnerStep } from './spinnerStep.js';
