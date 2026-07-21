<script setup lang="ts">
import { ref, watch, computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number;
  scale?: number;       // display = SI value × scale
  precision?: number;
  step?: string;
  min?: number;
}>(), {
  scale: 1,
  precision: 2,   // decimal places (fixed); WinISD's most common field width
  step: 'any',
  min: 0,   // physical quantities are non-negative by default; pass :min to override
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const focused = ref(false);
// Distinguish keyboard TYPING (echo the raw keystrokes so we don't fight the caret) from
// a SPINNER/arrow/wheel STEP (reformat to `precision` so the field never shows a long
// compounding float like 7.98600001). Typing sets this true; focus / Arrow-Up-Down / wheel
// reset it, so a step always reformats.
const typing = ref(false);

// Fixed-decimal display (WinISD convention): `precision` is the number of DECIMAL
// places, so the field width doesn't jump as the value changes (e.g. Vb always
// "6.00", never "6" then "6.003"). Was toPrecision (significant figures) which gave
// variable decimals.
function fmt(v: number): string {
  const s = v * props.scale;
  return isFinite(s) ? s.toFixed(props.precision) : '';
}

// The displayed string: raw while editing, formatted otherwise
const display = ref(fmt(props.modelValue));

// Only sync formatted display when not actively typing
watch(() => props.modelValue, (v) => {
  if (!focused.value) display.value = fmt(v);
});

function onFocus() {
  focused.value = true;
  typing.value = false;   // a step done right after focusing must still reformat
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

// A value is acceptable only if finite AND at or above the minimum (default 0) —
// this is what blocks negatives from ever reaching the model/sim.
function valid(v: number): boolean { return isFinite(v) && v >= props.min; }

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  const v = parseFloat(t.value);   // display-space (already scaled)
  if (typing.value || !isFinite(v)) {
    display.value = t.value;                                   // raw echo while typing (caret-safe)
    if (valid(v)) emit('update:modelValue', v / props.scale); // reject < min (e.g. negatives)
    return;
  }
  // Spinner/arrow/wheel step: format the DISPLAY to precision (screen-only) so the field never
  // shows a long float, and force the DOM to that string (the native spinner leaves it raw, and
  // an unchanged reformat wouldn't repaint via Vue's :value diff). But EMIT THE ACTUAL VALUE —
  // never a dp-truncated one — so calculations always receive full precision. The grid-aligned
  // step keeps the value at the field's resolution anyway; dp is presentation, not the model.
  const s = v.toFixed(props.precision);
  display.value = s;
  t.value = s;
  if (valid(v)) emit('update:modelValue', v / props.scale);
}

function onBlur() {
  focused.value = false;
  // Do NOT re-parse the DOM here: onInput already emitted the actual (full-precision) value on
  // every valid change, and the spinner path formats the DOM string to dp — re-parsing it would
  // truncate the model to dp (dp is presentation only). Just reformat the display from the model;
  // an invalid in-progress entry reverts to the last valid value the same way.
  display.value = fmt(props.modelValue);
}

// Red-flag an in-progress invalid entry ('' and a lone '-' are neutral while typing).
const invalid = computed(() => {
  if (display.value === '' || display.value === '-') return false;
  return !valid(parseFloat(display.value));
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
  const dv = Math.abs(props.modelValue * props.scale);
  if (!(dv > 0)) return 'any';
  const decade = Math.pow(10, Math.floor(Math.log10(dv)) - 1);
  // Never finer than the field's own decimal places: a sub-precision step (e.g. 0.01 on a
  // 1-dp field once the value drops below 1.0) would add decimals the field can't show and
  // stall the arrow. Clamp up to 10^-precision.
  return Math.max(decade, Math.pow(10, -props.precision));
});
</script>

<template>
  <input type="number" :step="stepAttr" :min="min" :value="display"
    :class="{ 'inp-bad': invalid }"
    @focus="onFocus" @keydown="onKeydown" @wheel="onWheel" @pointerdown="onPointerDown" @input="onInput" @blur="onBlur">
</template>

<style scoped>
input.inp-bad { border-color: var(--bad); }
</style>
