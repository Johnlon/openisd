export {
  type SelectorOption,
  END_CORRECTION_OPTIONS,
  VENT_SHAPE_OPTIONS, COMPACT_VENT_SHAPE_OPTIONS,
  VC_CONNECTION_OPTIONS,
  ARRAY_WIRING_OPTIONS,
  SEALED_ALIGNMENT_OPTIONS,
  VENTED_ALIGNMENT_OPTIONS,
  DEFAULT_VENTED_ALIGNMENT,
  BOX_TYPE_OPTIONS,
  FILTER_TYPE_OPTIONS,
  PASS_FAMILY_OPTIONS,
} from './options.js';

export { DEFAULT_NEW_PROJECT_QA, DEFAULT_NEW_PROJECT_VENTED_QL, DEFAULT_SOURCE_RESISTANCE_OHM } from './defaults.js';

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

export { type NumberBox, type NumberEdit, NUMBER_TEXT, numberInPaste, pastedEdit, typedEdit } from './numberText.js';

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
  NumberEditor,
  integerSpin,
  type FieldSpin,
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

export { basicUtc } from './basicTime.js';
export { lostDataSentence } from './lostData.js';
export { deleteForeverMessage, emptyBinMessage, moveToBinMessage } from './projectBinText.js';
export {exportedNotice, type ExportedFile, type ExportedNotice} from './exportedNotice.js';
export {
  conflictSuffix,
  emptyBinLabel,
  PROJECT_LIST_TEXT,
  PROJECT_ROW_ORDER_LIST,
  PROJECT_ROW_ORDERS,
  PROJECT_SEARCH_FROM_ROWS,
  projectRow,
  projectRowsFooter,
  saveButtonState,
  savedMessage,
  type SaveButtonState,
  projectSyncMark,
  splitConflictName,
  viewProjectRows,
  scopeProjectRows,
  PROJECT_LIST_SCOPES,
  DEFAULT_PROJECT_LIST_SCOPE,
  type ProjectListScope,
  type ProjectOpenState,
  type ProjectRow,
  type ProjectRowAction,
  type ProjectRowMenuItem,
  type ProjectRowOrder,
  type ProjectRowSource,
  type ProjectRowTag,
  type ProjectSaved,
  type ProjectSyncMark,
} from './projectRows.js';
export { restoredProjectName, storageUsedLine } from './backupText.js';
export {
  LOCAL_STORE_LIMIT_BYTES,
  browserNameOf,
  persistenceLine,
  persistenceWarning,
  savedNotice,
  startupNotice,
  siteStorageLine,
  STORAGE_FULL_FROM,
  storageFullWarning,
  acknowledgementInPlaceOfBannerMark,
  storagePopup,
  storagePopupAfterSave,
  storageUseLine,
  type BrowserName,
  type StorageLevel,
  type StoragePopup,
  type StoragePopupInput,
  type StoredUse,
  type PersistOutcome,
  type StorageEstimate,
} from './browserStorage.js';
export { dateStampFrom, formatByteSize, formatCount, formatCountOf, formatDate, formatDateStamp, formatDateTime, formatDay, formatFixed, formatFixedOrDash, parseBasicUtc } from './format.js';
export { ReadoutFormat } from './readoutFormat.js';
export { parseUnitRotation } from './unitRotation.js';
export { caretSpin, digitAtCaret, spinStep, tenthsCaret, steppingCaret, caretRepeatDelayMs, CARET_HOLD_START_MS, type CaretSpin, type SteppedPlace, type StepAt } from './caretSpin.js';
export { DragSpin, dragSpinRate, pressedDigit, DRAG_SPIN_THRESHOLD_PX, type TextBox } from './dragSpin.js';
export { parsePublicVersion, formatPublicVersion, titleOfPublicVersion, publicVersionOfTitle, comparePublicVersion, runningHeading, type PublicVersion } from './publicVersion.js';
export { spinValue, roundSpun, holdStage, HOLD_START_MS, spinStepAttr, shownSpinRule, decimalsSpinRule, type SpinRule, type SpinDirection, type SpinBounds, type SpinSpeed, type HoldStage } from './spinnerStep.js';
export { type AppVersion, type BuildKind, type BuildTrail, type PageAddress, formatAppVersion, trailOfLocation, stampOfVersion } from './appVersion.js';

/** The bottom sheet's rows per box type and sheet modes (Tune and What-if). */
export { SheetField, type SheetSlot } from './sheetField.js';
export { SheetSizes } from './sheetSizes.js';
export { ChartPageSizes, type ChartPageSizesValues } from './chartPageSizes.js';
export { ChartPageHelp } from './chartPageText.js';
export { PhoneRowColumns, PhoneRowSizes } from './phoneRowSizes.js';
export { PhoneHeaderSizes } from './phoneHeaderSizes.js';
export { type PhoneHelpRow, type PhoneFilterChip, PHONE_FILTER_CHIPS, PhoneHelpSection, KeyStripText, PhoneLabels, PhoneBoxText, PhoneHelp, PhoneDriverListText, PhonePrBrowserText, PhoneEditorText } from './phoneText.js';
export { type EbpBadge, type WizardInfoCard, PhoneWizardText, PhoneWizardHelp } from './phoneWizardText.js';
export { DesktopSizes, PickWidth } from './desktopSizes.js';
export { SheetMode, type SheetEdits } from './sheetMode.js';
export { NO_PROJECT_OPEN } from './noProject.js';
export { APP_UPDATE_TEXT, UNSAVED_RELOAD_CONFIRM } from './appUpdateText.js';

export { TuneText } from './tuneText.js';
export { PhoneDialogHelp, ImportChoiceText, AboutText } from './phoneDialogText.js';

export {FIELD_APPEARANCE_SAMPLES, FIELD_APPEARANCES, FieldEditor, FieldAccess, FieldUnits, FieldCue, appearanceFor, type FieldAppearance} from './fieldAppearance.js';
