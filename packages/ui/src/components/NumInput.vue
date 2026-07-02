<script setup lang="ts">
import { ref, watch } from 'vue';

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
  min: undefined,
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

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  display.value = t.value;   // track what the user actually typed
  const v = parseFloat(t.value);
  if (isFinite(v)) emit('update:modelValue', v / props.scale);
}

function onBlur(e: Event) {
  focused.value = false;
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (isFinite(v)) emit('update:modelValue', v / props.scale);
  display.value = fmt(props.modelValue);
}
</script>

<template>
  <input type="number" :step="step" :min="min" :value="display"
    @focus="onFocus" @input="onInput" @blur="onBlur">
</template>
