<script setup lang="ts">
import {computed, onBeforeUnmount, ref, useAttrs, watch} from 'vue';
import {presentationState} from '../../logic/presentationState.js';
import {formatFixed, type NumberField} from '@openisd/design/fields';
import type {ProvenanceLetter} from '@openisd/design';
import {inputFrom} from '../../logic/domEvents.js';

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
  step?: string;
  min?: number;
  max?: number;
  field?: NumberField;
  mandatory?: boolean;
  /** Allow values outside the registry's sanity range so the caller can show a DQ warning. */
  allowOutOfRange?: boolean;
  dq?: readonly string[];
  dqState?: ProvenanceLetter;
  stepper?: boolean;
}>(), {
  modelValue: null,
  precision: undefined,
  halfWidth: null,
  step: 'any',
  mandatory: false,
  allowOutOfRange: false,
  stepper: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | null, precision?: number];
  blur: [];
  'blur-notify': [value: number | null];
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
const typing = ref(false);
const badEntry = ref(false);
const entryValue = ref<number | null | undefined>(props.modelValue);
const display = ref(fmt(props.modelValue));

watch(() => props.modelValue, (v) => {
  if (!focused.value) display.value = fmt(v);
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
  typing.value = false;   // a step done right after focusing must still reformat
  badEntry.value = false;
  entryValue.value = props.modelValue;
  // Switch to unformatted string so toPrecision doesn't fight the user's keystrokes
  display.value = fmt(props.modelValue);
}

// Text-editing keys mean "typing" → echo raw. Arrow up/down are spinner steps → reformat.
function onKeydown(e: KeyboardEvent) {
  typing.value = e.key !== 'ArrowUp' && e.key !== 'ArrowDown';
}
function onWheel() { typing.value = false; }   // wheel over the field is a step → reformat
// A mouse press (incl. on the native ▲▼ spinner buttons) is not typing → reformat on the
// resulting step. If the press is to place the caret, the next keydown flips typing back on.
function onPointerDown() { typing.value = false; }

// `readonly` is never a declared prop — it reaches the native input only through $attrs (see
// the fragment-root note above) — so the stepper reads it the same way to stay in lockstep
// with whatever actually makes the field uneditable.
const attrs = useAttrs();
const isReadonly = computed(() => attrs.readonly !== undefined && attrs.readonly !== false);
const showStepper = computed(() => props.stepper && !isReadonly.value);

const inputEl = ref<HTMLInputElement | null>(null);
let repeatTimer: ReturnType<typeof setTimeout> | undefined;

// Drives the IDENTICAL path a real ArrowUp/ArrowDown keypress or the native spinner already
// does: the browser's own stepUp()/stepDown() against the same `:step`/`:min`/`:max` this
// input is already bound to (`stepAttr`/`dispMin`/`dispMax` below), then the resulting
// `input` event runs through the SAME `onInput()` every other path uses — no second rounding
// or precision rule to keep in sync with the keyboard/spinner behaviour.
function applyStep(dir: 1 | -1): void {
  const el = inputEl.value;
  if (el === null) return;
  typing.value = false;   // a step always reformats, same as the keyboard/wheel paths
  try {
    if (dir > 0) el.stepUp(); else el.stepDown();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'InvalidStateError') {
      const stepAttrVal = el.getAttribute('step');
      const parsedStep = stepAttrVal && stepAttrVal !== 'any' ? parseFloat(stepAttrVal) : NaN;
      let effectiveStep: number = !isNaN(parsedStep) && parsedStep > 0 ? parsedStep : 1;
      if (isNaN(parsedStep) && props.field) {
        const fieldStepStr = props.field.stepAttr(activeToken.value);
        const parsedFieldStep = parseFloat(fieldStepStr);
        if (!isNaN(parsedFieldStep) && parsedFieldStep > 0) effectiveStep = parsedFieldStep;
      } else if (isNaN(parsedStep) && typeof props.precision === 'number') {
        effectiveStep = 10 ** -props.precision;
      }
      const current = parseFloat(display.value) || 0;
      const next = current + dir * effectiveStep;
      display.value = fmt(fromDisp(next));
      el.value = display.value;
      if (valid(fromDisp(next))) emit('update:modelValue', fromDisp(next), typedPrecision(display.value));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    throw err;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function stopRepeat(): void {
  if (repeatTimer !== undefined) { clearTimeout(repeatTimer); repeatTimer = undefined; }
}
// Hold-to-repeat: one immediate step, then a pause before repeating (so a single tap never
// double-fires), then a faster repeat while held — the common native-spinner feel.
// The tapped button takes focus (John, 2026-10-02): the press is `.prevent`ed so the browser
// never focuses it, and the previously focused field kept focus. Focusing the field instead
// (2026-10-01) popped the phone keyboard on every tap; the button holds focus without one.
function startRepeat(dir: 1 | -1, e: PointerEvent): void {
  stopRepeat();
  if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus({ preventScroll: true });
  applyStep(dir);
  repeatTimer = setTimeout(function tick() {
    applyStep(dir);
    repeatTimer = setTimeout(tick, 80);
  }, 450);
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

function valid(si: number): boolean {
  if (props.allowOutOfRange) return isFinite(si);
  return isFinite(si) && si >= effMin.value && (effMax.value === undefined || si <= effMax.value);
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
  if (t.value === '') {
    badEntry.value = t.validity.badInput;
    display.value = '';
    if (badEntry.value) return;
    emit('update:modelValue', null);
    return;
  }
  badEntry.value = false;
  const v = parseFloat(t.value);
  const si = fromDisp(v);
  if (typing.value || !isFinite(v)) {
    display.value = t.value;
    if (valid(si)) emit('update:modelValue', si, typedPrecision(t.value));
    return;
  }
  const s = fmt(si);
  display.value = s;
  t.value = s;
  if (valid(si)) emit('update:modelValue', si, typedPrecision(s));
}

function onBlur(e: Event) {
  focused.value = false;
  badEntry.value = false;
  display.value = fmt(props.modelValue);
  const t = inputFrom(e);
  if (t === null) return;
  if (t.value !== display.value) t.value = display.value;
  emit('blur');
  if (props.modelValue !== entryValue.value) emit('blur-notify', props.modelValue);
}

const invalid = computed(() => {
  if (badEntry.value) return true;
  if (display.value === '' || display.value === '-') return false;
  return !valid(fromDisp(parseFloat(display.value)));
});

const classes = computed(() => {
  const isEmp = props.modelValue == null || props.modelValue <= 0 || display.value === '';
  return {
    'inp-bad': invalid.value,
    'de-input-mandatory': props.mandatory,
    'de-input-empty': props.mandatory && isEmp,
    'dq-flag': hasDq.value,
    'dq-root': isRootCause.value,
    'dq-symptom': isSymptom.value,
  };
});

const hasDq = computed(() => props.dq != null && props.dq.length > 0);
const isRootCause = computed(() => hasDq.value && props.dqState === 'E');
const isSymptom = computed(() => hasDq.value && props.dqState === 'C');
const dqTooltip = computed(() => {
  if (!hasDq.value) return props.dq ?? [];
  const dq = props.dq!.join('; ');
  if (isRootCause.value) return `This entered value is the problem: ${dq}`;
  if (isSymptom.value) return `This calculated value is bad because of the flagged input — fix the entered field: ${dq}`;
  return dq;
});
const dqNoteTitle = computed(() => hasDq.value ? `⚠ ${dqTooltip.value}` : '');

const stepAttr = computed<string | number>(() => {
  if (props.step !== 'any') return props.step;
  if (props.field) return props.field.stepAttr(activeToken.value);
  if (typeof props.precision === 'number') return (10 ** -props.precision).toString();
  return 'any';
});
</script>

<template>
  <input ref="inputEl" v-bind="$attrs" type="number" :step="stepAttr" :min="dispMin" :max="dispMax" :value="display"
    :class="classes" :title="hasDq ? `${helpText ?? ''}${helpText ? ' — ' : ''}${dqTooltip}` : helpText"
    @focus="onFocus" @keydown="onKeydown" @wheel="onWheel" @pointerdown="onPointerDown" @input="onInput" @blur="onBlur">
  <span v-if="hasDq" class="dq-note" :class="{ 'dq-note-root': isRootCause, 'dq-note-symptom': isSymptom }" :title="dqNoteTitle">⚠</span>
  <span v-if="showStepper" class="num-stepper">
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Increase"
      @pointerdown.prevent="startRepeat(1, $event)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat">▲</button>
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Decrease"
      @pointerdown.prevent="startRepeat(-1, $event)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat">▼</button>
  </span>
</template>

<style scoped>
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
  margin-left: 6px;
}
.num-stepper-btn {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 32px;
  font-size: 16px;
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
</style>
