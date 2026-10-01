<script setup lang="ts">
import {computed, onBeforeUnmount, ref, useAttrs, watch} from 'vue';
import {unitToken} from '../../logic/presentationState.js';
import {displayPrecision, fromDisplay, statedPrecision, toDisplay} from '../../logic/fields/units.js';
import {type NumberField} from '@openisd/design/fields';
import type {ProvenanceLetter} from '@openisd/design';
import {inputFrom} from '../../logic/domEvents.js';

// The DQ note makes this a fragment root, so attrs (id, class, …) are not auto-inherited —
// bind them to the INPUT explicitly (never the ⚠ note).
defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue: number | null | undefined;
  precision?: number;
  step?: string;
  // Explicit SI-space bounds. When omitted, a bound `field` states its own min/max; with
  // neither, min falls back to 0 (physical quantities are non-negative by default) and max is
  // unbounded.
  min?: number;
  max?: number;
  // Unit binding: when `field` is a SWITCHABLE field (its own `display.kind`) and `unitKey` is
  // given, the display factor and precision come from the field's own group/base plus the
  // SELECTED unit (fields/units.ts), so a paired <UnitToggle> rescales this field live.
  // `precision` is then the BASE-unit dp; the shown dp is derived per unit. A fixed field, or a
  // switchable one with no `unitKey`, shows its SI value unconverted — there is no other way to
  // scale a number here, so a display unit can only ever come from the field's own registry entry.
  field?: NumberField;
  /** The key this field's SELECTED unit is stored under (`presentationState.unitTokens`), which
   *  is its own namespace — `Vb`, not `box_Vb_l` — shared with the paired `<UnitToggle>`. */
  unitKey?: string;
  mandatory?: boolean;
  /** Allow values outside the registry's sanity range so the caller can show a DQ warning. */
  allowOutOfRange?: boolean;
  // Data-quality flags. `dq` is the field's cell DQ messages (`cell.dq()`); `dqState` the cell's
  // state. The DQ rule (generic): a CALCULATED value that carries DQ is a symptom, not the cause —
  // the ENTERED field(s) carrying the same DQ are the real problem, and get the strong "root"
  // treatment. Both are redlined; only the entered one is called out as the cause.
  dq?: readonly string[];
  dqState?: ProvenanceLetter;
  /** Render touch-sized up/down buttons beside the field (mobile's dense rows, John
   *  2026-10-01: "lots of empty space ... wants up/down step buttons"). Opt-in — desktop's
   *  many call sites are unaffected unless they ask for it. The buttons drive the SAME
   *  native stepUp()/stepDown() the keyboard arrows and the browser's own spinner already
   *  use (`onKeydown`'s ArrowUp/ArrowDown case, `stepAttr` below) — there is no second step
   *  or rounding path to keep in sync. */
  stepper?: boolean;
}>(), {
  modelValue: null,
  precision: 2,   // decimal places (fixed); WinISD's most common field width
  step: 'any',
  mandatory: false,
  allowOutOfRange: false,
  stepper: false,
});

const emit = defineEmits<{
  /** The SI value, and — where the entry states one — the half-width of what it STATES, in SI.
   *  Counted off the typed characters, not off the number: "30.00" and "30" are the same number
   *  and different statements. A consumer that records provenance passes it to the field's
   *  `set`; one that only needs the number ignores the second argument. */
  'update:modelValue': [value: number | null, precision?: number];
  blur: [];
  /**
   * Blur left a cell whose value changed since the cell was entered (focused). The component owns
   * ONLY that fact — it has no Re, so it cannot compute P from V (or vice versa). The parent
   * (the drive-row binding) consumes this to re-derive the derived sibling from the entered one.
   * Carries the committed model value so the consumer has the ground truth that ended the edit.
   */
  'blur-notify': [value: number | null];
}>();

// The field's own switchable display (group + base token), when it has one — the one source for
// what NumInput used to take as separate `group`/`base` props (BUG_20260928, "NumInput's
// group/base props are a fourth table").
const sw = computed(() => (props.field?.display.kind === 'switchable' ? props.field.display : undefined));
// Unit-bound mode is active only when the field is switchable AND the caller supplies a unitKey.
const unitized = computed(() => sw.value != null && props.unitKey != null);
const token = computed(() => (unitized.value ? unitToken(props.unitKey!, sw.value!.base) : ''));
// SI ↔ display. Unit-bound mode uses the affine registry conversion (handles temperature's
// offset); unbound, the field IS its SI value. The model holds SI either way.
function toDisp(si: number | null): number {
  if (si == null) return 0;
  return unitized.value ? toDisplay(si, sw.value!.group, token.value) : si;
}
function fromDisp(disp: number): number {
  return unitized.value ? fromDisplay(disp, sw.value!.group, token.value) : disp;
}
// Decimal places: derived per selected unit when bound, else the fixed prop (min 2 dp).
const eprec = computed(() =>
  Math.max(2, unitized.value ? displayPrecision(props.precision, sw.value!.group, sw.value!.base, token.value) : props.precision),
);

const focused = ref(false);
// Distinguish keyboard TYPING (echo the raw keystrokes so we don't fight the caret) from a
// SPINNER/arrow/wheel STEP (reformat to `precision` so the field never shows a long
// compounding float like 7.98600001). Typing sets this true; focus / Arrow-Up-Down / wheel
// reset it, so a step always reformats.
const typing = ref(false);
// The field holds characters that are not a number (`validity.badInput`). Tracked separately
// from `display` because such an entry is deliberately NOT copied into `display` — see onInput.
const badEntry = ref(false);
// The committed value at the moment the cell was entered (focused). A blur whose model changed
// since then is a NOTIFICATION (`blur-notify`): the parent derives the sibling member from it.
// The component owns only this fact — it has no Re, so it never computes P from V itself.
const entryValue = ref<number | null | undefined>(null);

// Fixed-decimal display (WinISD convention): `precision` is the number of DECIMAL
// places, so the field width doesn't jump as the value changes (e.g. Vb always
// "6.00", never "6" then "6.003"). Decimal places, NOT significant figures — toPrecision
// gives a variable number of decimals and makes the width jump.
function fmt(v: number | null | undefined): string {
  if (v == null) return '';
  const s = toDisp(v);
  return isFinite(s) ? s.toFixed(eprec.value) : '';
}

// The displayed string: raw while editing, formatted otherwise
const display = ref(fmt(props.modelValue));

// Only sync formatted display when not actively typing
watch(() => props.modelValue, (v) => {
  if (!focused.value) display.value = fmt(v);
});
// Rotating the field's unit changes the conversion/precision → reformat the shown value (same
// SI model, new unit) whenever the field isn't being actively edited.
watch([token, eprec], () => {
  if (!focused.value) display.value = fmt(props.modelValue);
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
  if (dir > 0) el.stepUp(); else el.stepDown();
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function stopRepeat(): void {
  if (repeatTimer !== undefined) { clearTimeout(repeatTimer); repeatTimer = undefined; }
}
// Hold-to-repeat: one immediate step, then a pause before repeating (so a single tap never
// double-fires), then a faster repeat while held — the common native-spinner feel.
function startRepeat(dir: 1 | -1): void {
  stopRepeat();
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
const helpText = computed<string | undefined>(() =>
  props.field === undefined || props.field.description === '' ? undefined : props.field.description);

const effMin = computed<number>(() => props.min ?? props.field?.limits.min ?? 0);
const effMax = computed<number | undefined>(() => props.max ?? props.field?.limits.max);

// Bounds are SI-space (default floor 0 — physical quantities are non-negative; for absolute
// temperature 0 K is the floor). Validation therefore always tests the SI value, NOT the display
// value: −10 °C is a valid positive Kelvin, so a display-space check would wrongly reject it.
function valid(si: number): boolean {
  if (props.allowOutOfRange) return isFinite(si);
  return isFinite(si) && si >= effMin.value && (effMax.value === undefined || si <= effMax.value);
}
// The native <input min>/<input max> are DISPLAY-space bounds, so each is the SI bound converted
// to the shown unit (e.g. 0 K → −273.15 °C), letting the spinner reach legitimately-negative
// display values while never stepping outside the field's real range.
const dispMin = computed(() => toDisp(effMin.value));
const dispMax = computed<number | undefined>(() => effMax.value === undefined ? undefined : toDisp(effMax.value));

/** What the characters in the field STATE, in SI — `statedPrecision` against this field's own
 *  unit binding, or against the SI value itself when the field is not unit-bound. */
function typedPrecision(typed: string): number | undefined {
  return unitized.value ? statedPrecision(typed, sw.value!.group, token.value) : statedPrecision(typed);
}

function onInput(e: Event) {
  const t = inputFrom(e);
  if (t === null) return;
  if (t.value === '') {
    // `<input type="number">` reports value === '' for TWO different things: a field the user
    // actually emptied, and a field holding characters it cannot parse as a number — the "-"
    // of a negative being typed, "1e" on the way to "1e3". `validity.badInput` is the DOM's
    // own discriminator between them (verified in Chromium: "-" ⇒ value '', badInput true;
    // a cleared field ⇒ value '', badInput false).
    //
    // Only a genuinely empty field means "clear this". Treating a HALF-TYPED number as a clear
    // emitted null, which every v-model consumer of a number-typed model (a box volume, say)
    // took literally — so the first keystroke of "-5" blanked the value and the charts with it.
    //
    // `display` is still set to '' on BOTH paths, and must be: Vue's :value patch compares its
    // new value against the LIVE el.value and writes whenever they differ, so leaving `display`
    // at the old formatted string ("30.00") makes the very next re-render overwrite the "-" the
    // user just typed and move the caret to the end. '' matches el.value exactly (that is what
    // the DOM reports for a badInput entry), so Vue writes nothing and the typed characters —
    // which the browser keeps on screen regardless — survive untouched.
    badEntry.value = t.validity.badInput;
    display.value = '';
    if (badEntry.value) return;   // partial entry: nothing was cleared, so emit nothing
    emit('update:modelValue', null);
    return;
  }
  badEntry.value = false;
  const v = parseFloat(t.value);   // display-space
  const si = fromDisp(v);          // back to SI (the model's units)
  if (typing.value || !isFinite(v)) {
    display.value = t.value;                                   // raw echo while typing (caret-safe)
    // reject < min (e.g. negatives)
    if (valid(si)) emit('update:modelValue', si, typedPrecision(t.value));
    return;
  }
  // Spinner/arrow/wheel step: format the DISPLAY to precision (screen-only) so the field never
  // shows a long float, and force the DOM to that string (the native spinner leaves it raw, and
  // an unchanged reformat wouldn't repaint via Vue's :value diff). But EMIT THE ACTUAL VALUE —
  // never a dp-truncated one — so calculations always receive full precision. The grid-aligned
  // step keeps the value at the field's resolution anyway; dp is presentation, not the model.
  const s = v.toFixed(eprec.value);
  display.value = s;
  t.value = s;
  if (valid(si)) emit('update:modelValue', si, typedPrecision(s));
}

function onBlur(e: Event) {
  focused.value = false;
  badEntry.value = false;
  // Do NOT re-parse the DOM here: onInput already emitted the actual (full-precision) value on
  // every valid change, and the spinner path formats the DOM string to dp — re-parsing it would
  // truncate the model to dp (dp is presentation only). Just reformat the display from the model;
  // an invalid in-progress entry reverts to the last valid value the same way.
  display.value = fmt(props.modelValue);
  // An unparseable entry left `display` untouched (see onInput), so Vue's :value diff sees no
  // change and would leave the rejected characters on screen. Push the resting value into the
  // DOM directly. Safe here and only here — focus has already left, so no caret to disturb.
  const t = inputFrom(e);
  if (t === null) return;
  if (t.value !== display.value) t.value = display.value;
  emit('blur');
  // A blur that ended with a model different from the one the cell was entered with is a
  // notification the parent can act on (re-derive the sibling member). Never fire for a
  // focus→blur that changed nothing.
  if (props.modelValue !== entryValue.value) emit('blur-notify', props.modelValue);
}

// Red-flag an in-progress invalid entry, on the keystroke that makes it invalid rather than on
// blur. Two ways to be invalid: out of the field's range, or not a number at all. '' and a lone
// '-' are neutral — nothing has been entered yet, so there is nothing to complain about.
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

// ── DQ — the generic "flagged field" rule ────────────────────────────────────────────────────
// A field that carries a data-quality flag is redlined. But a CALCULATED value with DQ is not the
// real problem — it is the symptom of an ENTERED field carrying the same DQ (the relation's
// input). So: dq-root = entered (draw attention, this is the cause); dq-symptom = calculated
// (flagged consequence, with a note that the cause is an entered field). Both are red.
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

// Spinner step ≈ one decade below the value's magnitude (a power of ten), so it feels
// proportional across scales (~10–100 steps per decade) WITHOUT the two bugs of a raw
// value×0.1 step: (1) value×0.1 is an arbitrary float, so it compounds into long decimals;
// (2) it shifts every click and is not a clean multiple of `min=0`, so the browser's
// step-snapping refuses stepDown near min (the "down-arrow sticks" symptom). A power of ten
// is always a clean multiple of 0, so stepping stays grid-aligned and never stalls. A
// caller-supplied explicit `step` (e.g. integer counts) still wins.
const stepAttr = computed<string | number>(() => {
  if (props.step !== 'any') return props.step;
  const dv = Math.abs(toDisp(props.modelValue));
  if (!(dv > 0)) return 'any';
  const decade = Math.pow(10, Math.floor(Math.log10(dv)) - 1);
  // Never finer than the field's own decimal places: a sub-precision step (e.g. 0.01 on a
  // 1-dp field once the value drops below 1.0) would add decimals the field can't show and
  // stall the arrow. Clamp up to 10^-precision.
  return Math.max(decade, Math.pow(10, -eprec.value));
});
</script>

<template>
  <input ref="inputEl" v-bind="$attrs" type="number" :step="stepAttr" :min="dispMin" :max="dispMax" :value="display"
    :class="classes" :title="hasDq ? `${helpText ?? ''}${helpText ? ' — ' : ''}${dqTooltip}` : helpText"
    @focus="onFocus" @keydown="onKeydown" @wheel="onWheel" @pointerdown="onPointerDown" @input="onInput" @blur="onBlur">
  <span v-if="hasDq" class="dq-note" :class="{ 'dq-note-root': isRootCause, 'dq-note-symptom': isSymptom }" :title="dqNoteTitle">⚠</span>
  <span v-if="showStepper" class="num-stepper">
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Increase"
      @pointerdown.prevent="startRepeat(1)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat">▲</button>
    <button type="button" class="num-stepper-btn" tabindex="-1" title="Decrease"
      @pointerdown.prevent="startRepeat(-1)" @pointerup="stopRepeat" @pointerleave="stopRepeat" @pointercancel="stopRepeat">▼</button>
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
