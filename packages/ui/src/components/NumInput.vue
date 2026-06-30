<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  scale:      { type: Number,  default: 1 },       // display = SI value × scale
  precision:  { type: Number,  default: 4 },
  step:       { type: String,  default: 'any' },
  min:        { type: Number,  default: undefined },
});

const emit = defineEmits(['update:modelValue']);

const focused = ref(false);

function fmt(v) {
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

function onInput(e) {
  display.value = e.target.value;   // track what the user actually typed
  const v = parseFloat(e.target.value);
  if (isFinite(v)) emit('update:modelValue', v / props.scale);
}

function onBlur(e) {
  focused.value = false;
  const v = parseFloat(e.target.value);
  if (isFinite(v)) emit('update:modelValue', v / props.scale);
  display.value = fmt(props.modelValue);
}
</script>

<template>
  <input type="number" :step="step" :min="min" :value="display"
    @focus="onFocus" @input="onInput" @blur="onBlur">
</template>
