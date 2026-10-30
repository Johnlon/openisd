
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {CARET_HOLD_START_MS, DragSpin, DRAG_SPIN_THRESHOLD_PX, caretRepeatDelayMs, digitAtCaret, pressedDigit, formatFixed, NUMBER_TEXT, pastedEdit, typedEdit, spinStep, NumberField, type FieldSpin, type NumberEdit, type SpinDirection, type SteppedPlace, type StepAt} from '@openisd/design/fields';
import type {ProvenanceLetter} from '@openisd/design';
import {inputFrom} from '../logic/domEvents.js';
import {dqReason} from '../logic/cellDataQuality.js';
import {entryRefusal, type EntryBounds} from '../logic/entryRefusal.js';
import type {StepperPin} from '../logic/stepperPin.js';
import type {DragClock} from '../logic/dragClock.js';
import {screenTopPx} from '../logic/visibleViewport.js';
import type {FieldEditMode} from '../logic/fieldEditMode.js';
import type {PresentationState} from '../logic/presentationState.js';

export interface NumInputProps {
  modelValue: number | null | undefined;
  /** Decimals in the base unit. Defaults to the bound `field`'s own registry precision. */
  precision?: number;
  /** The value's own half-width in SI — what it was typed to, or inherited from what it was
   *  calculated from. Shows more decimals than `precision` where it states them. */
  halfWidth?: number | null;
  min?: number;
  max?: number;
  field?: NumberField;
  mandatory?: boolean;
  /** An emptied box is a refused entry (the model can never be blank), not an entry of nothing. */
  blankRefused?: boolean;
  /** Allow values outside the registry's sanity range so the caller can show a DQ warning. */
  allowOutOfRange?: boolean;
  dq?: readonly string[];
  dqState?: ProvenanceLetter;
  stepper?: boolean;
  /** Replaces the field's own spin rule (an even-only Order box moves 2 a press). */
  spin?: FieldSpin;
  /** The host draws the ⚠ itself (`UIField`), so this box draws no mark of its own. */
  hideMark?: boolean;

}
export interface NumInputEmit {
  (event: 'update:modelValue', value: number | null, precision?: number): void;
  (event: 'blur'): void;
  (event: 'blur-notify', value: number | null): void;
  (event: 'refusal', text: string): void;
}
export interface NumInputDependencies {
  readonly presentationState: PresentationState;
  readonly stepperPin: StepperPin | null;
  readonly fieldEditMode: FieldEditMode | null;
  readonly dragClock: DragClock;
  readonly attrs: Readonly<Record<string, unknown>>;
}

/** One injectable owner of numeric input, digit spinning, validation and focus behaviour. */
export function useNumInput(props: Readonly<NumInputProps>, emit: NumInputEmit, dependencies: NumInputDependencies) {
  const {presentationState, stepperPin, fieldEditMode, dragClock, attrs} = dependencies;
  const activeToken = computed(() => props.field?.unitTokenFor(presentationState.ui.unitTokens ?? {}));

  function fmt(v: number | null | undefined): string {
    if (v == null || !isFinite(v)) return '';
    if (props.field) {
      return props.field.format(v, props.halfWidth, activeToken.value);
    }
    const minDp = props.precision ?? 2;
    return formatFixed(v, minDp);
  }

  const focused = ref(false);
  let pointerEntering = false;
  const groupFocused = ref(false);
  const badEntry = ref(false);
  const entryValue = ref<number | null | undefined>(props.modelValue);
  const display = ref(fmt(props.modelValue));

  watch([() => props.modelValue, () => props.halfWidth], ([v]) => {
    if (!groupFocused.value && refusal.value === '') display.value = fmt(v);
  });
  watch(activeToken, (newToken, oldToken) => {
    if (!groupFocused.value || refusal.value === '') {
      // Accepted input is already stored at full SI precision. Never convert the
      // rounded display back into a value when cycling units.
      display.value = fmt(props.modelValue);
    } else if (props.field && display.value && oldToken) {
      // Rescale active draft string when token changes while focused (C24)
      const oldRes = props.field.parseEntry(display.value, oldToken);
      if (oldRes.kind === 'quantity') {
        display.value = props.field.format(oldRes.valueSI, oldRes.halfWidthSI, newToken);
      }
    }
    // A new display unit invalidates the old character offset and decimal place.
    stopRepeat();
    lastStep = null;
    lastCaret = {kind: 'none'};
    underlineIndex.value = null;
    const input = inputEl.value;
    if (input !== null) {
      input.value = display.value;
      input.setSelectionRange(display.value.length, display.value.length);
    }
  });

  function onFocus(event: FocusEvent) {
    const fromPointer = pointerEntering;
    pointerEntering = false;
    const entering = !groupFocused.value;
    focused.value = true;
    groupFocused.value = true;
    if (!entering) {
      if (fromPointer) return;
      // Returning from the unit or spinner keeps the chosen place. Cancel restoration
      // if a subsequent native selection or pointer action has taken ownership.
      if (ownGroup(event.relatedTarget)) {
        nativeTextSelection = false;
        const index = underlineIndex.value ?? digitAtCaret(display.value, display.value.length);
        queueMicrotask(() => {
          if (!nativeTextSelection && document.activeElement === inputEl.value && index !== null) chooseDigit(index);
        });
      }
      return;
    }
    underlineIndex.value = null;
    if (refusal.value !== '') return;   // a refused entry stays as typed until fixed or Esc
    badEntry.value = false;
    entryValue.value = props.modelValue;
    // Switch to unformatted string so toPrecision doesn't fight the user's keystrokes
    display.value = fmt(props.modelValue);
  }

  /** Desktop: horizontal text selection, vertical spinning. Touch: horizontal spinning, vertical scrolling. */
  function onBoxPointer(e: PointerEvent) {
    underlineIndex.value = null;
    pointerSpinOccurred = false;
    pointerTextSelecting = false;
    nativeTextSelection = e.shiftKey;
    touchCaret = e.pointerType === 'touch';
    lastStep = null;   // a tap or click in the box puts the caret, even where the last step left it
    const el = inputEl.value;
    if (el === null || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointerEntering = document.activeElement !== el;
    if (inspectionLocked.value) {
      startLongPress(e);
      return;
    }
    if (isReadonly.value) return;
    const pressed = pressedDigitOf(el, e.clientX);
    dragAbort?.abort();
    const abort = new AbortController();
    dragAbort = abort;
    // Native selected-text dragging starts before our spin threshold and cancels pointer events.
    // Keep the numeric gesture in this input; ordinary clicks and keyboard copy/paste remain native.
    el.addEventListener('dragstart', event => event.preventDefault(), {signal: abort.signal});
    const mouse = e.pointerType === 'mouse';
    const press = {x: e.clientX, y: e.clientY, id: e.pointerId, at: pressed, displacement: 0, since: dragClock.now()};
    const spin = new DragSpin();
    let dragging = false;
    let first = true;
    let timer: number | undefined;
    let last = press.since;
    const tick = () => {
      const now = dragClock.now();
      const steps = spin.advance(press.displacement, now - last);
      last = now;
      const dir: SpinDirection = steps < 0 ? -1 : 1;
      for (let i = 0; i < Math.abs(steps); i++) {
        stepFrom(first && press.at.kind === 'digit' ? press.at : lastStep?.at ?? caretForStep(), dir);
        first = false;
      }
    };
    const end = () => {
      if (dragging && lastCaret.kind === 'digit') chooseDigit(lastCaret.at);
      abort.abort();
      if (timer !== undefined) dragClock.clear(timer);
      if (dragAbort === abort) dragAbort = null;
      dragging = false;
      dragSpinning = false;
    };
    document.addEventListener('pointermove', (m: PointerEvent) => {
      if (m.pointerId !== press.id) return;
      const dx = m.clientX - press.x, dy = m.clientY - press.y;
      press.displacement = mouse ? -dy : dx;
      if (mouse && !dragging) {
        if (pointerTextSelecting) return;
        if (Math.abs(dx) >= DRAG_SPIN_THRESHOLD_PX && Math.abs(dx) >= Math.abs(dy)) {
          pointerTextSelecting = true;
          nativeTextSelection = true;
          return;
        }
      }
      if (!dragging && Math.abs(press.displacement) >= DRAG_SPIN_THRESHOLD_PX) {
        dragging = true;
        dragSpinning = true;
        pointerSpinOccurred = true;
        last = dragClock.now();
        el.setPointerCapture(press.id);
        timer = dragClock.every(tick, DRAG_TICK_MS);
        tick();
      }
    }, {signal: abort.signal});
    document.addEventListener('selectstart', (s: Event) => { if (dragging) s.preventDefault(); }, {signal: abort.signal});
    document.addEventListener('pointerup', (u: PointerEvent) => { if (u.pointerId === press.id) end(); }, {signal: abort.signal});
    document.addEventListener('pointercancel', (u: PointerEvent) => { if (u.pointerId === press.id) end(); }, {signal: abort.signal});
  }
  let dragSpinning = false;
  let touchCaret = false;
  let pointerSpinOccurred = false;
  let pointerTextSelecting = false;
  let nativeTextSelection = false;

  function chooseDigit(index: number): void {
    nativeTextSelection = false;
    const el = inputEl.value;
    if (el === null || !/\d/.test(display.value[index] ?? '')) return;
    lastCaret = {kind: 'digit', at: index};
    lastStep = null;
    underlineIndex.value = index;
    if (touchCaret) el.setSelectionRange(index + 1, index + 1);
    else el.setSelectionRange(index, index + 1);
  }

  function onBoxPointerUp(event: PointerEvent): void {
    pointerEntering = false;
    if (isReadonly.value || pointerSpinOccurred) return;
    const el = inputEl.value;
    if (el === null) return;
    // Preserve native range selection (for example Shift-click) for editing.
    if (pointerTextSelecting || event.shiftKey || (el.selectionEnd ?? 0) - (el.selectionStart ?? 0) > 1) {
      nativeTextSelection = true;
      rememberCaret();
      return;
    }
    const at = pressedDigitOf(el, event.clientX);
    if (at.kind === 'digit') chooseDigit(at.at);
  }

  function onBoxDoubleClick(): void {
    nativeTextSelection = true;
    rememberCaret();
  }

  function moveDigit(direction: number): void {
    const digits = [...display.value].flatMap((char, index) => /\d/.test(char) ? [index] : []);
    const el = inputEl.value;
    const selected = caretForStep();
    const current = underlineIndex.value ?? (selected.kind === 'digit' ? selected.at : digits.filter(index => index < (el?.selectionStart ?? display.value.length)).at(-1)) ?? digits[0];
    const next = digits[Math.max(0, Math.min(digits.length - 1, digits.indexOf(current ?? -1) + direction))];
    if (next !== undefined) chooseDigit(next);
  }

  let dragAbort: AbortController | null = null;
  const DRAG_TICK_MS = 40;

  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressAbort: AbortController | null = null;
  const LONG_PRESS_MS = CARET_HOLD_START_MS;


  const nativeReadonly = computed(() => attrs.readonly !== undefined && attrs.readonly !== false);
  const inspectionLocked = computed(() => fieldEditMode?.enabled.value === true && !longPressEditing.value);
  const longPressEditing = ref(false);
  const isReadonly = computed(() => nativeReadonly.value || inspectionLocked.value);
  const showStepper = computed(() => props.stepper && (!nativeReadonly.value || fieldEditMode?.enabled.value === true));

  function stopLongPress(): void {
    if (longPressTimer !== undefined) { clearTimeout(longPressTimer); longPressTimer = undefined; }
    longPressAbort?.abort();
    longPressAbort = null;
  }

  function startLongPress(e: PointerEvent): boolean {
    if (!inspectionLocked.value || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return false;
    const el = inputEl.value;
    if (el === null) return false;
    e.preventDefault();
    fieldEditMode?.disabledAttempt();
    stopLongPress();
    const abort = new AbortController();
    longPressAbort = abort;
    const finish = () => {
      abort.abort();
      if (longPressAbort === abort) longPressAbort = null;
      longPressTimer = undefined;
    };
    const cancel = () => finish();
    document.addEventListener('pointerup', cancel, {signal: abort.signal, once: true});
    document.addEventListener('pointercancel', cancel, {signal: abort.signal, once: true});
    longPressTimer = setTimeout(() => {
      if (longPressAbort !== abort) return;
      longPressEditing.value = true;
      finish();
      el.focus({preventScroll: true});
    }, LONG_PRESS_MS);
    return true;
  }

  onBeforeUnmount(() => { dragAbort?.abort(); stopLongPress(); });

  /** The digit under a press at `clientX`, measured in the box's own font. */
  function pressedDigitOf(el: HTMLInputElement, clientX: number): StepAt {
    const style = getComputedStyle(el);
    const ctx = measureCanvas.getContext('2d');
    if (ctx === null) return {kind: 'none'};
    ctx.font = style.font;
    const rect = el.getBoundingClientRect();
    const left = rect.left + el.clientLeft + parseFloat(style.paddingLeft);
    const content = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const align = style.textAlign === 'right' || style.textAlign === 'end' ? 'right' : style.textAlign === 'center' ? 'center' : 'left';
    return pressedDigit(el.value, clientX - left + el.scrollLeft, {contentWidth: content, align}, s => ctx.measureText(s).width);
  }
  const measureCanvas = document.createElement('canvas');

  /** A number as typed: "," is a decimal mark too. */
  function numberOf(text: string): number {
    return parseFloat(text.replace(',', '.'));
  }

  /** The box's text and selection, for the design rule. */
  function boxOf(el: HTMLInputElement) {
    const start = el.selectionStart ?? el.value.length;
    return {text: el.value, selectionStart: start, selectionEnd: el.selectionEnd ?? start};
  }

  /** Put an allowed edit in the box, as an input event so the usual handling follows. */
  function applyEdit(el: HTMLInputElement, edit: NumberEdit) {
    if (edit.kind === 'refuse') return;
    el.value = edit.text;
    el.setSelectionRange(edit.caret, edit.caret);
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }

  /** Letters never go in: the design rule judges the text the edit would leave. */
  function onBeforeInput(e: InputEvent) {
    const el = inputEl.value;
    if (!el || isReadonly.value) return;
    if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
      if (e.data !== null && typedEdit(boxOf(el), e.data).kind === 'refuse') e.preventDefault();
    } else if (e.inputType === 'insertFromDrop' && e.dataTransfer) {
      e.preventDefault();
      applyEdit(el, pastedEdit(boxOf(el), e.dataTransfer.getData('text')));
    }
  }

  /** A paste becomes the number in the pasted text, or nothing. */
  function onPaste(e: ClipboardEvent) {
    const el = inputEl.value;
    if (!el || isReadonly.value || !e.clipboardData) return;
    e.preventDefault();
    applyEdit(el, pastedEdit(boxOf(el), e.clipboardData.getData('text')));
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.shiftKey && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a')) nativeTextSelection = true;
    if (e.key === 'Escape') {
      nativeTextSelection = true;
      underlineIndex.value = null;
      const el = inputEl.value;
      if (el && el.selectionStart !== null && el.selectionEnd !== null && el.selectionEnd > el.selectionStart) {
        el.setSelectionRange(el.selectionStart, el.selectionStart);
      }
      if (refusal.value !== '') {
        // Esc puts the stored value back over a refused entry — and only that: the press does not
        // also reach a dialog's own Esc-to-close.
        e.preventDefault();
        e.stopPropagation();
        badEntry.value = false;
        display.value = fmt(props.modelValue);
        if (e.target instanceof HTMLInputElement) e.target.value = display.value;
        return;
      }
    }
    if (isReadonly.value) return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      stopRepeat();
      moveDigit(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (heldKey !== e.key) {
        beginRepeat(caretForStep(), e.key === 'ArrowUp' ? 1 : -1);
        heldKey = e.key;
      }
    } else if ((e.key === ' ' || e.key === 'Enter') && e.currentTarget instanceof HTMLButtonElement) {
      e.preventDefault();
      if (heldKey !== e.key) {
        beginRepeat(caretForStep(), e.currentTarget.title === 'Increase' ? 1 : -1);
        heldKey = e.key;
      }
    } else if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      underlineIndex.value = null;
    }
  }
  function onKeyup(event: KeyboardEvent): void {
    if (heldKey === event.key) { event.preventDefault(); stopRepeat(); }
  }
  // The wheel steps a focused box, as the browser's own number box did; an unfocused one lets the page scroll.
  function onWheel(e: WheelEvent) {
    if (!focused.value || isReadonly.value || e.deltaY === 0) return;
    e.preventDefault();
    stepAtCaret(e.deltaY < 0 ? 1 : -1);
  }

  const inputEl = ref<HTMLInputElement | null>(null);
  const unitEl = ref<HTMLElement | null>(null);
  const increaseEl = ref<HTMLButtonElement | null>(null);
  const decreaseEl = ref<HTMLButtonElement | null>(null);
  function ownGroup(element: EventTarget | null): boolean {
    return element instanceof Node && (element === inputEl.value || element === increaseEl.value || element === decreaseEl.value || unitEl.value?.contains(element) === true);
  }
  const underlineIndex = ref<number | null>(null);
  let repeatTimer: ReturnType<typeof setTimeout> | undefined;
  let heldKey: string | null = null;

  // Where the caret last was in this box, kept after the box loses focus: a ▲▼ button steps that
  // digit (John, 2026-10-15). None until a caret has been set; a step then uses the tenths digit.
  let lastCaret: StepAt = {kind: 'none'};
  function rememberCaret(): void {
    // Native mouse text selection must not replace the digit captured by a drag.
    if (dragSpinning) return;
    const el = inputEl.value;
    if (el === null || document.activeElement !== el || el.selectionStart === null) return;
    if (nativeTextSelection || (el.selectionEnd ?? el.selectionStart) - el.selectionStart > 1) {
      underlineIndex.value = null;
      lastStep = null;
      lastCaret = {kind: 'caret', at: el.selectionStart};
      return;
    }
    if (touchCaret && underlineIndex.value !== null && el.selectionStart === el.selectionEnd && el.selectionStart === underlineIndex.value + 1) return;
    const at: StepAt = el.selectionEnd === el.selectionStart + 1
      ? {kind: 'digit', at: el.selectionStart}
      : {kind: 'caret', at: el.selectionStart};
    if (lastCaret.kind !== at.kind || lastCaret.at !== at.at) lastStep = null;
    lastCaret = at;
    underlineIndex.value = at.kind === 'digit' ? at.at : digitAtCaret(display.value, at.at);
  }
  function onSelectionChange(): void { rememberCaret(); }
  onMounted(() => document.addEventListener('selectionchange', onSelectionChange));
  onBeforeUnmount(() => document.removeEventListener('selectionchange', onSelectionChange));

  function caretForStep(): StepAt {
    const el = inputEl.value;
    if (el !== null && el.selectionStart !== null && el.selectionEnd !== null) {
      if (touchCaret && underlineIndex.value !== null && el.selectionStart === el.selectionEnd && el.selectionStart === underlineIndex.value + 1) return lastCaret;
      if (el.selectionEnd === el.selectionStart + 1) {
        return {kind: 'digit', at: el.selectionStart};
      }
      if (document.activeElement === el) {
        return {kind: 'caret', at: el.selectionStart};
      }
    }
    return lastCaret;
  }

  // The place the last step stepped and where it left the box: the next step keeps that place until
  // the caret moves (John, 2026-10-21, QO291.c153).
  let lastStep: SteppedPlace | null = null;

  /** One step of the digit at `at` (the tenths digit when there is none). On desktop (the box is
   *  focused), the stepped digit stays selected at its place value. On mobile (a ▲▼ button holds
   *  focus), an underline mirror overlay is shown instead and the box is untouched. */
  function stepFrom(at: StepAt, dir: SpinDirection): void {
    nativeTextSelection = false;
    const el = inputEl.value;
    const bounds = {min: dispMin.value, max: dispMax.value};
    const rule = props.field === undefined ? undefined : props.field.spinRule(activeToken.value, props.spin);
    const spun = spinStep(display.value, at, lastStep, dir, bounds, rule);
    if (spun === null) return;
    const si = fromDisp(spun.value);
    display.value = spun.text;
    lastCaret = {kind: 'digit', at: spun.mark};
    if (el !== null) {
      el.value = spun.text;
      underlineIndex.value = spun.mark;
      if (touchCaret) el.setSelectionRange(spun.mark + 1, spun.mark + 1);
      else el.setSelectionRange(spun.mark, spun.mark + 1);

    }
    lastStep = {place: spun.place, at: caretForStep()};
    if (valid(si)) emit('update:modelValue', si, typedPrecision(spun.text));
  }

  /** A key or wheel step on the focused box: the digit at its caret. */
  function stepAtCaret(dir: SpinDirection): void {
    stepFrom(caretForStep(), dir);
  }

  let heldSince = 0;
  let cancelStepperTouch: (() => void) | null = null;
  function clearRepeat(): void {
    heldKey = null;
    if (repeatTimer !== undefined) { clearTimeout(repeatTimer); repeatTimer = undefined; }
  }

  function stopRepeat(): void {
    clearRepeat();
    cancelStepperTouch?.();
  }

  function focusStepper(button: HTMLElement): void {
    const box = inputEl.value;
    // Native blur may precede this event. Pin the target before button focus regardless of activeElement.
    if (stepperPin !== null && box !== null) stepperPin.pin(() => screenTopPx(box, window));
    button.focus({preventScroll: true});
  }

  function onStepperPointerDown(dir: SpinDirection, e: PointerEvent): void {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType !== 'touch') {
      e.preventDefault();
      startRepeat(dir, e);
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    touchCaret = true;
    const button = e.currentTarget;
    if (!(button instanceof HTMLElement)) return;
    stopRepeat();
    const at = caretForStep();
    const pressedAt = performance.now();
    const abort = new AbortController();
    let holding = false;
    const cleanup = () => {
      clearTimeout(holdTimer);
      abort.abort();
      if (cancelStepperTouch === cleanup) cancelStepperTouch = null;
    };
    cancelStepperTouch = cleanup;
    // A touch is provisional: native pan-y must win before a tap/hold is confirmed.
    // Do not preventDefault or change the project on pointerdown.
    const holdTimer = setTimeout(() => {
      holding = true;
      focusStepper(button);
      beginRepeat(at, dir, pressedAt);
    }, CARET_HOLD_START_MS);
    document.addEventListener('pointermove', move => {
      if (move.pointerId !== e.pointerId) return;
      const moved = Math.abs(move.clientX - e.clientX) >= DRAG_SPIN_THRESHOLD_PX
        || Math.abs(move.clientY - e.clientY) >= DRAG_SPIN_THRESHOLD_PX;
      const bounds = button.getBoundingClientRect();
      const outside = move.clientX < bounds.left || move.clientX > bounds.right
        || move.clientY < bounds.top || move.clientY > bounds.bottom;
      if ((!holding && moved) || (holding && outside)) stopRepeat();
    }, {signal: abort.signal});
    document.addEventListener('pointercancel', cancel => {
      if (cancel.pointerId === e.pointerId) stopRepeat();
    }, {signal: abort.signal});
    document.addEventListener('pointerup', release => {
      if (release.pointerId !== e.pointerId) return;
      const tap = !holding;
      stopRepeat();
      if (tap) { focusStepper(button); stepFrom(at, dir); }
    }, {signal: abort.signal});
  }

  function onStepperPointerUp(e: PointerEvent): void {
    // Touch release is judged by the gesture listener; mouse holds end immediately.
    if (e.pointerType !== 'touch') stopRepeat();
  }

  function onStepperLeave(e: PointerEvent): void {
    if (e.pointerType !== 'touch') stopRepeat();
  }

  function onStepperFocus(): void { groupFocused.value = true; }

  function onStepperBlur(e: FocusEvent): void {
    clearRepeat();
    if (!ownGroup(e.relatedTarget)) leaveGroup();
  }

  /** Pointer and keyboard holds use the same selected place, delay and acceleration. */
  function beginRepeat(at: StepAt, direction: SpinDirection, pressedAt = performance.now()): void {
    clearRepeat();
    heldSince = pressedAt;
    stepFrom(at, direction);
    repeatTimer = setTimeout(function tick() {
      stepFrom(caretForStep(), direction);
      repeatTimer = setTimeout(tick, caretRepeatDelayMs(performance.now() - heldSince));
    }, performance.now() - heldSince >= CARET_HOLD_START_MS
      ? caretRepeatDelayMs(performance.now() - heldSince)
      : CARET_HOLD_START_MS - (performance.now() - heldSince));
  }
  function startRepeat(direction: SpinDirection, event: PointerEvent): void {
    const at = caretForStep();
    if (event.currentTarget instanceof HTMLElement) focusStepper(event.currentTarget);
    beginRepeat(at, direction);
  }
  onMounted(() => { window.addEventListener('blur', stopRepeat); });
  onBeforeUnmount(() => { stopRepeat(); window.removeEventListener('blur', stopRepeat); });

  // Effective SI-space bounds: explicit props win; else the bound field's registry limits
  // (the row's own field def in packages/design — bounds there are in SI/model space); else the
  // non-negative default floor and no ceiling.
  //

  /**
   * The field's help text, from the ONE registry, on every NumInput that names a field.
   *
   * Bound on the component rather than written onto each call site: that is what makes help
   * CONSISTENT (one text per field, wherever the field appears) and COMPLETE (a field gains help
   * by existing in the registry, not by someone remembering to add a hover). A wrapper may still
   * set its own `title` — Vue's fallthrough puts the parent's attribute last, so an explicit one
   * wins where a pane genuinely needs to say something the field itself cannot.
   *
   * Undefined, not '', when there is nothing to say: an empty `title` renders an empty tooltip.
   */
  function toDisp(si: number | null | undefined): number {
    if (si == null || !isFinite(si)) return 0;
    if (props.field) {
      return props.field.toDisplay(si, activeToken.value);
    }
    return si;
  }
  function fromDisp(disp: number): number {
    if (props.field) {
      const res = props.field.parseEntry(String(disp), activeToken.value);
      if (res.kind === 'quantity') return res.valueSI;
    }
    return disp;
  }

  const helpText = computed<string | undefined>(() =>
    props.field === undefined || props.field.description === '' ? undefined : props.field.description);

  const effMin = computed<number>(() => props.min ?? props.field?.limits.min ?? 0);
  const effMax = computed<number | undefined>(() => props.max ?? props.field?.limits.max);

  /** The box's accepted values: the field's floor and band, or the caller's own `min`/`max`. */
  const bounds = computed<EntryBounds>(() => ({
    label: props.field?.label ?? 'This value',
    unit: props.field?.unitLabel(activeToken.value) ?? '',
    floor: props.field?.floor ?? 'none',
    min: effMin.value,
    max: effMax.value,
    show: si => props.field ? props.field.format(si, null, activeToken.value) : formatFixed(si, props.precision ?? 2),
  }));

  function valid(si: number): boolean {
    if (props.allowOutOfRange) return isFinite(si);
    return entryRefusal(bounds.value, { kind: 'number', si }) === '';
  }

  const dispMin = computed(() => toDisp(effMin.value));
  const dispMax = computed<number | undefined>(() => effMax.value === undefined ? undefined : toDisp(effMax.value));

  function typedPrecision(typed: string): number | undefined {
    if (props.field) {
      const res = props.field.parseEntry(typed, activeToken.value);
      return res.kind === 'quantity' ? res.halfWidthSI : undefined;
    }
    return undefined;
  }

  function onInput(e: Event) {
    const t = inputFrom(e);
    if (t === null) return;
    display.value = t.value;
    nativeTextSelection = false;
    lastStep = null;
    rememberCaret();
    if (t.value === '') {
      badEntry.value = false;
      emit('update:modelValue', null);
      return;
    }
    badEntry.value = !NUMBER_TEXT.test(t.value);
    const v = numberOf(t.value);
    badEntry.value = badEntry.value || !isFinite(v);   // a lone "-" or "." is not a number yet, and says so
    if (badEntry.value) return;
    const typed = fromDisp(v);
    if (valid(typed)) emit('update:modelValue', typed, typedPrecision(t.value.replace(',', '.')));
  }

  function onBlur(e: Event) {
    clearRepeat();
    focused.value = false;
    // Unit and spinner controls share the number's draft and chosen place.
    if (e instanceof FocusEvent && ownGroup(e.relatedTarget)) {
      // Clearing a coupled cell can immediately settle to a calculated value.
      // Its restored value must be visible when focus moves to its unit/buttons.
      if (display.value === '' && refusal.value === '') display.value = fmt(props.modelValue);
      return;
    }
    leaveGroup();
  }

  function leaveGroup(): void {
    pointerEntering = false;
    groupFocused.value = false;
    underlineIndex.value = null;
    stopRepeat();
    longPressEditing.value = false;
    stopLongPress();
    if (refusal.value !== '') {
      // Ruling "b": leaving the box keeps the refused entry and its ⚠; nothing was stored.
      emit('blur');
      return;
    }
    badEntry.value = false;
    display.value = fmt(props.modelValue);
    const t = inputEl.value;
    if (t === null) return;
    if (t.value !== display.value) t.value = display.value;
    emit('blur');
    if (props.modelValue !== entryValue.value) emit('blur-notify', props.modelValue ?? null);
  }

  /** What is wrong with the text in the box, '' when it may be stored (or is empty). Only a typed
   *  entry is refused: the stored value showing unchanged is never refused, even when a limit has
   *  since moved past it (a bigger box lowering the PR's Fp ceiling) — that is the domain's ⚠. */
  const refusal = computed<string>(() => {
    if (props.allowOutOfRange) return '';
    if (badEntry.value) return entryRefusal(bounds.value, { kind: 'not-a-number' });
    if (display.value === '' && props.blankRefused) return entryRefusal(bounds.value, { kind: 'not-a-number' });
    if (display.value === '' || !isFinite(numberOf(display.value))) return '';
    if (display.value === fmt(props.modelValue)) return '';
    return entryRefusal(bounds.value, { kind: 'number', si: fromDisp(numberOf(display.value)) });
  });
  watch(refusal, text => emit('refusal', text));

  const classes = computed(() => {
    const isEmp = props.modelValue == null || props.modelValue <= 0 || display.value === '';
    return {
      'inp-bad': refusal.value !== '',
      'de-input-mandatory': props.mandatory,
      'de-input-empty': props.mandatory && isEmp,
      'value-empty': (props.field instanceof NumberField ? props.field.emptyAndAllowed(props.modelValue ?? null) : false),
      'dq-flag': hasDq.value,
      'dq-root': isRootCause.value,
      'dq-symptom': isSymptom.value,
    };
  });

  const hasDq = computed(() => props.dq != null && props.dq.length > 0);
  const isRootCause = computed(() => hasDq.value && props.dqState === 'E');
  const isSymptom = computed(() => hasDq.value && props.dqState === 'C');
  const dqTooltip = computed(() => dqReason({ dq: props.dq ?? [], dqState: props.dqState ?? 'N' }));
  const dqNoteTitle = computed(() => hasDq.value ? `⚠ ${dqTooltip.value}` : '');

  /** A phone keyboard with a minus where the value can be negative, the decimal pad otherwise. */
  const keyboard = computed<'decimal' | 'text'>(() => effMin.value < 0 ? 'text' : 'decimal');

  return {inputEl, unitEl, increaseEl, decreaseEl, isReadonly, keyboard, display, classes, refusal, hasDq, helpText, dqTooltip, underlineIndex, showStepper, dqNoteTitle, isRootCause, isSymptom, onFocus, onBoxPointer, onBoxPointerUp, onBoxDoubleClick, onKeydown, onKeyup, onBeforeInput, onPaste, onWheel, onInput, onBlur, onStepperPointerDown, onStepperPointerUp, stopRepeat, onStepperLeave, onStepperFocus, onStepperBlur};
}
