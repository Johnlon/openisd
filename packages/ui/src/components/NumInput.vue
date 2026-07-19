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
  precision: 4,
  step: 'any',
  min: 0,   // physical quantities are non-negative by default; pass :min to override
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

const focused = ref(false);

function fmt(v: number): string {
  const s = v * props.scale;
  return isFinite(s) ? (+s.toPrecision(props.precision)).toString() : '';
}

// The displayed string: raw while editing, formatted otherwise
const display = ref(fmt(props.modelValue));

// Only sync formatted display when not actively typing
watch(() => props.modelValue, (v) => {
  if (!focused.value) display.value = fmt(v);
});

function onFocus() {
  focused.value = true;
  // Switch to unformatted string so toPrecision doesn't fight the user's keystrokes
  display.value = fmt(props.modelValue);
}

// A value is acceptable only if finite AND at or above the minimum (default 0) —
// this is what blocks negatives from ever reaching the model/sim.
function valid(v: number): boolean { return isFinite(v) && v >= props.min; }

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  display.value = t.value;   // track what the user actually typed
  const v = parseFloat(t.value);
  if (valid(v)) emit('update:modelValue', v / props.scale);   // reject < min (e.g. negatives)
}

function onBlur(e: Event) {
  focused.value = false;
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (valid(v)) emit('update:modelValue', v / props.scale);
  display.value = fmt(props.modelValue);   // an invalid entry reverts to the last valid value
}

// Red-flag an in-progress invalid entry ('' and a lone '-' are neutral while typing).
const invalid = computed(() => {
  if (display.value === '' || display.value === '-') return false;
  return !valid(parseFloat(display.value));
});

// Spinner step scales with the value: ~10% of the current magnitude so each click
// moves proportionally (compounding → geometric ±10%/click), instead of a fixed
// absolute amount that is far too coarse for milli-scale values and too fine for
// kilo-scale ones. A caller-supplied explicit `step` (e.g. integer counts) wins.
// step ≈ value/10 keeps the value ~10 step-units above min=0, so native stepping
// stays aligned (no step-snapping surprises).
const stepAttr = computed<string | number>(() => {
  if (props.step !== 'any') return props.step;
  const dv = Math.abs(props.modelValue * props.scale);
  return dv > 0 ? dv * 0.1 : 'any';
});
</script>

<template>
  <input type="number" :step="stepAttr" :min="min" :value="display"
    :class="{ 'inp-bad': invalid }"
    @focus="onFocus" @input="onInput" @blur="onBlur">
</template>

<style scoped>
input.inp-bad { border-color: var(--bad); }
</style>
