<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { unitToken } from '../store.js';
import { toDisplay, fromDisplay, displayPrecision, type UnitGroup } from '../fields/units.js';
import { fieldById } from '../fields/fieldRegistry.js';

const props = withDefaults(defineProps<{
  modelValue: number | null | undefined;
  scale?: number;       // display = SI value × scale
  precision?: number;
  step?: string;
  // Explicit SI-space bounds. When omitted, a `field` id pulls the registry's enforced
  // min/max (fieldRegistry — the constraints SSOT); with neither, min falls back to 0
  // (physical quantities are non-negative by default) and max is unbounded.
  min?: number;
  max?: number;
  // Optional unit binding: when group + field + base are all given, the display scale and
  // precision come from the field's SELECTED unit (fields/units.ts) instead of the fixed
  // `scale`/`precision` props, so a paired <UnitToggle> rescales this field live. `precision`
  // is then the BASE-unit dp; the shown dp is derived per unit. Omit all three → unchanged.
  // `field` MAY also be given alone (no group/base) purely to bind the registry constraints.
  group?: UnitGroup;
  field?: string;
  base?: string;        // the field's default unit token
  mandatory?: boolean;
}>(), {
  modelValue: null,
  scale: 1,
  precision: 2,   // decimal places (fixed); WinISD's most common field width
  step: 'any',
  mandatory: false,
});

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>();

// Unit-bound mode is active only when the caller supplies the full triple.
const unitized = computed(() => props.group != null && props.field != null && props.base != null);
const token = computed(() => (unitized.value ? unitToken(props.field!, props.base!) : ''));
// SI ↔ display. Unit-bound mode uses the affine registry conversion (handles temperature's
// offset); otherwise the fixed `scale` multiply. Both keep the model in SI.
function toDisp(si: number | null): number {
  if (si == null) return 0;
  return unitized.value ? toDisplay(si, props.group!, token.value) : si * props.scale;
}
function fromDisp(disp: number): number {
  return unitized.value ? fromDisplay(disp, props.group!, token.value) : disp / props.scale;
}
// Decimal places: derived per selected unit when bound, else the fixed prop (min 2 dp).
const eprec = computed(() =>
  Math.max(2, unitized.value ? displayPrecision(props.precision, props.group!, props.base!, token.value) : props.precision),
);

const focused = ref(false);
// Distinguish keyboard TYPING (echo the raw keystrokes so we don't fight the caret) from
// a SPINNER/arrow/wheel STEP (reformat to `precision` so the field never shows a long
// compounding float like 7.98600001). Typing sets this true; focus / Arrow-Up-Down / wheel
// reset it, so a step always reformats.
const typing = ref(false);
// The field holds characters that are not a number (`validity.badInput`). Tracked separately
// from `display` because such an entry is deliberately NOT copied into `display` — see onInput.
const badEntry = ref(false);

// Fixed-decimal display (WinISD convention): `precision` is the number of DECIMAL
// places, so the field width doesn't jump as the value changes (e.g. Vb always
// "6.00", never "6" then "6.003"). Was toPrecision (significant figures) which gave
// variable decimals.
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

// Effective SI-space bounds: explicit props win; else the bound field's registry limits
// (fieldRegistry is the constraints SSOT — bounds there are in SI/model space); else the
// non-negative default floor and no ceiling. Lookup is tolerant of a registry-id case
// difference (e.g. field="alfaVC" vs registry id 'AlfaVC').
const regSpec = computed(() => props.field ? (fieldById(props.field) ?? fieldById(props.field[0].toUpperCase() + props.field.slice(1))) : undefined);
const effMin = computed<number>(() => props.min ?? regSpec.value?.min ?? 0);
const effMax = computed<number | undefined>(() => props.max ?? regSpec.value?.max);

// Bounds are SI-space (default floor 0 — physical quantities are non-negative; for absolute
// temperature 0 K is the floor). Validation therefore always tests the SI value, NOT the display
// value: −10 °C is a valid positive Kelvin, so a display-space check would wrongly reject it.
function valid(si: number): boolean {
  return isFinite(si) && si >= effMin.value && (effMax.value === undefined || si <= effMax.value);
}
// The native <input min>/<input max> are DISPLAY-space bounds, so each is the SI bound converted
// to the shown unit (e.g. 0 K → −273.15 °C), letting the spinner reach legitimately-negative
// display values while never stepping outside the field's real range.
const dispMin = computed(() => toDisp(effMin.value));
const dispMax = computed<number | undefined>(() => effMax.value === undefined ? undefined : toDisp(effMax.value));

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.value === '') {
    // `<input type="number">` reports value === '' for TWO different things: a field the user
    // actually emptied, and a field holding characters it cannot parse as a number — the "-"
    // of a negative being typed, "1e" on the way to "1e3". `validity.badInput` is the DOM's
    // own discriminator between them (verified in Chromium: "-" ⇒ value '', badInput true;
    // a cleared field ⇒ value '', badInput false).
    //
    // Only a genuinely empty field means "clear this". Treating a HALF-TYPED number as a clear
    // emitted null, which every v-model consumer of a number-typed model (state.P.Vb) took
    // literally — so the first keystroke of "-5" blanked the value and the charts with it.
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
    if (valid(si)) emit('update:modelValue', si);             // reject < min (e.g. negatives)
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
  if (valid(si)) emit('update:modelValue', si);
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
  const t = e.target as HTMLInputElement;
  if (t.value !== display.value) t.value = display.value;
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
  };
});

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
  <input type="number" :step="stepAttr" :min="dispMin" :max="dispMax" :value="display"
    :class="classes"
    @focus="onFocus" @keydown="onKeydown" @wheel="onWheel" @pointerdown="onPointerDown" @input="onInput" @blur="onBlur">
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
</style>
