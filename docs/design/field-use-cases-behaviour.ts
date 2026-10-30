// The approval gallery uses the same pure behaviour as NumInput; no duplicate counter maths.
export {spinStep, digitAtCaret, caretRepeatDelayMs, CARET_HOLD_START_MS} from '../../packages/design/fields/caretSpin.js';
export {pressedDigit, DRAG_SPIN_THRESHOLD_PX} from '../../packages/design/fields/dragSpin.js';
export {typedEdit, pastedEdit, NUMBER_TEXT} from '../../packages/design/fields/numberText.js';
export {entryRefusal} from '../../packages/ui/src/logic/entryRefusal.js';

import {NumberField} from '../../packages/design/fields/field.js';
export const GALLERY_FIELDS = Object.freeze({gain:NumberField.FILTER_GAIN_DB,mass:NumberField.PR_MADD_G,power:NumberField.SIGNAL_PIN_W,qms:NumberField.QMS});

export {StepperPin, STEPPER_PIN_HOLD_MS} from '../../packages/ui/src/logic/stepperPin.js';
export {screenTopPx, visibleViewportHeightPx, visibleViewportTopPx} from '../../packages/ui/src/logic/visibleViewport.js';
