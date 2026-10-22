<script setup lang="ts">
import {computed, inject, onBeforeUnmount, onMounted, ref, useAttrs, watch} from 'vue';
import {useApp} from '../../logic/app.js';
import {CARET_HOLD_START_MS, DragSpin, DRAG_SPIN_THRESHOLD_PX, caretRepeatDelayMs, pressedDigit, formatFixed, NUMBER_TEXT, pastedEdit, typedEdit, spinStep, NumberField, type FieldSpin, type NumberEdit, type SpinDirection, type SteppedPlace, type StepAt} from '@openisd/design/fields';
import type {ProvenanceLetter} from '@openisd/design';
import {inputFrom} from '../../logic/domEvents.js';
import {dqReason} from '../../logic/cellDataQuality.js';
import {entryRefusal, type EntryBounds} from '../../logic/entryRefusal.js';
import {STEPPER_PIN} from '../../logic/stepperPin.js';
import {DRAG_CLOCK, REAL_DRAG_CLOCK} from '../../logic/dragClock.js';
import {screenTopPx} from '../../logic/visibleViewport.js';
const presentationState = useApp().presentation;
const stepperPin = inject(STEPPER_PIN, null);

// The DQ note makes this a fragment root, so attrs (id, class, …) are not auto-inherited —
// bind them to the INPUT explicitly (never the ⚠ note).
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
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
}>(), {
  modelValue: null,
  precision: undefined,
  halfWidth: null,
  mandatory: false,
  blankRefused: false,
  allowOutOfRange: false,
  stepper: true,
  hideMark: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null, precision?: number];
  blur: [];
  'blur-notify': [value: number | null];
  /** What is wrong with the text in the box and what to enter instead; '' when it is acceptable. */
  refusal: [text: string];
}>();

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
const badEntry = ref(false);
const entryValue = ref<number | null | undefined>(props.modelValue);
const display = ref(fmt(props.modelValue));

watch(() => props.modelValue, (v) => {
  if (!focused.value && refusal.value === '') display.value = fmt(v);
});
watch(activeToken, (newToken, oldToken) => {
  if (!focused.value) {
    display.value = fmt(props.modelValue);
  } else if (props.field && display.value && oldToken) {
    // Rescale active draft string when token changes while focused (C24)
    const oldRes = props.field.parseEntry(display.value, oldToken);
    if (oldRes.kind === 'quantity') {
      display.value = props.field.format(oldRes.valueSI, oldRes.halfWidthSI, newToken);
    }
  }
});

function onFocus() {
  focused.value = true;
  underlineIndex.value = null;
  if (refusal.value !== '') return;   // a refused entry stays as typed until fixed or Esc
  badEntry.value = false;
  entryValue.value = props.modelValue;
  // Switch to unformatted string so toPrecision doesn't fight the user's keystrokes
  display.value = fmt(props.modelValue);
}

/** A press in the box: a tap or click puts the caret as ever; a drag past the dead zone spins. */
function onBoxPointer(e: PointerEvent) {
  underlineIndex.value = null;
  lastStep = null;   // a tap or click in the box puts the caret, even where the last step left it
  const el = inputEl.value;
  if (el === null || isReadonly.value || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const pressed = pressedDigitOf(el, e.clientX);
  dragAbort?.abort();
  const abort = new AbortController();
  dragAbort = abort;
  const press = {x: e.clientX, id: e.pointerId, at: pressed, nowX: e.clientX, since: dragClock.now()};
  const spin = new DragSpin();
  let dragging = false;
  let first = true;
  let timer: number | undefined;
  let last = press.since;
  const tick = () => {
    const now = dragClock.now();
    const steps = spin.advance(press.nowX - press.x, now - last);
    last = now;
    const dir: SpinDirection = steps < 0 ? -1 : 1;
    for (let i = 0; i < Math.abs(steps); i++) {
      stepFrom(first && press.at.kind === 'digit' ? press.at : lastStep?.at ?? caretForStep(), dir);
      first = false;
    }
  };
  const end = () => {
    abort.abort();
    if (timer !== undefined) dragClock.clear(timer);
    if (dragAbort === abort) dragAbort = null;
    dragging = false;
  };
  document.addEventListener('pointermove', (m: PointerEvent) => {
    if (m.pointerId !== press.id) return;
    press.nowX = m.clientX;
    if (!dragging && DRAG_SPIN_THRESHOLD_PX <= (m.clientX > press.x ? m.clientX - press.x : press.x - m.clientX)) {
      dragging = true;
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
let dragAbort: AbortController | null = null;
const DRAG_TICK_MS = 40;
const dragClock = inject(DRAG_CLOCK, REAL_DRAG_CLOCK);
onBeforeUnmount(() => dragAbort?.abort());

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
  if (e.key === 'Escape') {
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
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !isReadonly.value) {
    e.preventDefault();
    stepAtCaret(e.key === 'ArrowUp' ? 1 : -1);
  } else if (e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
    underlineIndex.value = null;
  }
}
// The wheel steps a focused box, as the browser's own number box did; an unfocused one lets the page scroll.
function onWheel(e: WheelEvent) {
  if (!focused.value || isReadonly.value || e.deltaY === 0) return;
  e.preventDefault();
  stepAtCaret(e.deltaY < 0 ? 1 : -1);
}

// `readonly` is never a declared prop — it reaches the native input only through $attrs (see
// the fragment-root note above) — so the stepper reads it the same way to stay in lockstep
// with whatever actually makes the field uneditable.
const attrs = useAttrs();
const isReadonly = computed(() => attrs.readonly !== undefined && attrs.readonly !== false);
const showStepper = computed(() => props.stepper && !isReadonly.value);

const inputEl = ref<HTMLInputElement | null>(null);
const underlineIndex = ref<number | null>(null);
let repeatTimer: ReturnType<typeof setTimeout> | undefined;

// Where the caret last was in this box, kept after the box loses focus: a ▲▼ button steps that
// digit (John, 2026-10-15). None until a caret has been set; a step then uses the tenths digit.
let lastCaret: StepAt = {kind: 'none'};
function rememberCaret(): void {
  const el = inputEl.value;
  if (el === null || document.activeElement !== el || el.selectionStart === null) return;
  lastCaret = el.selectionEnd === el.selectionStart + 1
    ? {kind: 'digit', at: el.selectionStart}
    : {kind: 'caret', at: el.selectionStart};
}
function onSelectionChange(): void { rememberCaret(); }
onMounted(() => document.addEventListener('selectionchange', onSelectionChange));
onBeforeUnmount(() => document.removeEventListener('selectionchange', onSelectionChange));

function caretForStep(): StepAt {
  const el = inputEl.value;
  if (el !== null && el.selectionStart !== null && el.selectionEnd !== null) {
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
    if (document.activeElement === el) {
      underlineIndex.value = null;
      el.setSelectionRange(spun.mark, spun.mark + 1);
    } else {
      underlineIndex.value = spun.mark;
    }
  }
  lastStep = {place: spun.place, at: caretForStep()};
  if (valid(si)) emit('update:modelValue', si, typedPrecision(spun.text));
}

/** A key or wheel step on the focused box: the digit at its caret. */
function stepAtCaret(dir: SpinDirection): void {
  stepFrom(caretForStep(), dir);
}

let heldSince = 0;
function stopRepeat(): void {
  if (repeatTimer !== undefined) { clearTimeout(repeatTimer); repeatTimer = undefined; }
}

function onStepperBlur(e: FocusEvent): void {
  const next = e.relatedTarget;
  if (next !== inputEl.value && !(next instanceof HTMLElement && next.classList.contains('num-stepper-btn'))) {
    underlineIndex.value = null;
  }
}

// On desktop, the box keeps focus across ▲▼ clicks and key/wheel steps and selects that digit.
// On mobile, the button holds focus (keeping keyboard down) and draws an underline under that digit.
function startRepeat(dir: SpinDirection, e: PointerEvent): void {
  stopRepeat();
  const fromCaret = caretForStep();
  const isMobile = presentationState.shownSkin() === 'mobile' || e.pointerType === 'touch';
  if (isMobile) {
    // The box has the keyboard up: the press closes it, so the pin keeps the box where it is on screen.
    const box = inputEl.value;
    if (stepperPin !== null && box !== null && document.activeElement === box) stepperPin.pin(() => screenTopPx(box, window));
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus({ preventScroll: true });
  } else {
    inputEl.value?.focus();
  }
  heldSince = performance.now();
  stepFrom(fromCaret, dir);
  repeatTimer = setTimeout(function tick() {
    stepFrom(caretForStep(), dir);
    repeatTimer = setTimeout(tick, caretRepeatDelayMs(performance.now() - heldSince));
  }, CARET_HOLD_START_MS);
}
onBeforeUnmount(stopRepeat);

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
  lastStep = null;
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
  focused.value = false;
  if (refusal.value !== '') {
    // Ruling "b": leaving the box keeps the refused entry and its ⚠; nothing was stored.
    emit('blur');
    return;
  }
  badEntry.value = false;
  display.value = fmt(props.modelValue);
  const t = inputFrom(e);
  if (t === null) return;
  if (t.value !== display.value) t.value = display.value;
  emit('blur');
  if (props.modelValue !== entryValue.value) emit('blur-notify', props.modelValue);
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
</script>

<template>
  <span class="num-input-wrap">
    <input ref="inputEl" v-bind="$attrs" data-numinput type="text" :inputmode="keyboard" autocomplete="off" :value="display"
      :class="classes" :title="refusal !== '' ? refusal : hasDq ? `${helpText ?? ''}${helpText ? ' — ' : ''}${dqTooltip}` : helpText"
      @focus="onFocus" @pointerdown="onBoxPointer" @keydown="onKeydown" @beforeinput="onBeforeInput" @paste="onPaste" @wheel="onWheel" @input="onInput" @blur="onBlur">
    <span v-if="underlineIndex !== null" class="num-mark-overlay" aria-hidden="true"><span class="num-mark-pre">{{ display.slice(0, underlineIndex) }}</span><span class="num-mark-underline">{{ display.slice(underlineIndex, underlineIndex + 1) }}</span><span class="num-mark-post">{{ display.slice(underlineIndex + 1) }}</span></span>
  </span>
  <span v-if="hasDq || (refusal !== '' && !hideMark)" class="dq-note" :class="{ 'dq-note-root': isRootCause || refusal !== '', 'dq-note-symptom': isSymptom }" :title="refusal !== '' ? `⚠ ${refusal}` : dqNoteTitle">⚠</span>
  <span v-if="showStepper" class="num-stepper">
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Increase"
      @pointerdown.prevent="startRepeat(1, $event)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat"
      @blur="onStepperBlur">▲</button>
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Decrease"
      @pointerdown.prevent="startRepeat(-1, $event)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat"
      @blur="onStepperBlur">▼</button>
  </span>
</template>

<style scoped>
/* Left/right drags spin the value; vertical swipes still scroll the page. */
.num-input-wrap > input { touch-action: pan-y; }
input.inp-bad { border-color: var(--bad); }
input.de-input-mandatory {
  border-width: 2px !important;
}
input.de-input-empty {
  border-color: var(--bad) !important;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bad) 25%, transparent) !important;
}
/* DQ — the generic "flagged field" rule. Both root (entered, the cause) and symptom
   (calculated, the consequence) are redlined; only the root gets the extra attention ring. */
input.dq-flag { border-color: var(--bad); }
input.dq-root {
  border-color: var(--bad);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--bad) 60%, transparent);
  background: color-mix(in srgb, var(--bad) 12%, transparent);
}
input.dq-symptom {
  border-color: color-mix(in srgb, var(--bad) 65%, orange);
}
span.dq-note {
  margin-left: 4px;
  font-size: 12px;
  cursor: help;
}
span.dq-note-root { color: var(--bad); }
span.dq-note-symptom { color: color-mix(in srgb, var(--bad) 65%, orange); }

/* Side-by-side (▲ then ▼), not stacked: the dense mobile row has spare width — the empty space
   to the right of a short number — which is exactly what a horizontal pair uses (John,
   2026-10-02: "wide beside, not above"; "make up down 2x wider" — 64px, not square). */
.num-stepper {
  display: inline-flex;
  flex-direction: row;
  flex-shrink: 0;
  margin-left: 2px;
}
.num-stepper-btn {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--stepper-w, 14px);
  height: var(--stepper-h, 20px);
  font-size: 12px;
  line-height: 1;
  color: var(--mut);
  background: var(--panel2, #f0f0f0);
  border: 1px solid var(--line);
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
}
.num-stepper-btn + .num-stepper-btn { border-left: none; }
.num-stepper-btn:first-child { border-radius: 4px 0 0 4px; }
.num-stepper-btn:last-child { border-radius: 0 4px 4px 0; }
.num-stepper-btn:active { background: var(--acc, #36c); color: #fff; }

.num-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  flex: 0 1 auto;
  min-width: 0;
}
.num-input-wrap > input {
  flex: 0 1 auto;
  min-width: 0;
}
.num-mark-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  font: inherit;
  letter-spacing: inherit;
  white-space: pre;
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
  padding: 4px 6px;
}
.num-mark-pre,
.num-mark-post {
  color: transparent;
  visibility: hidden;
}
.num-mark-underline {
  color: transparent;
  text-decoration: underline 2px solid var(--fg, currentColor);
  text-underline-offset: 3px;
  border-bottom: 2px solid var(--fg, currentColor);
  line-height: 1;
}
</style>
