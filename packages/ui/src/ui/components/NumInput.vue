<script setup lang="ts">
import {inject, useAttrs} from 'vue';
import {useApp} from '../../logic/app.js';
import {STEPPER_PIN} from '../../logic/stepperPin.js';
import {DRAG_CLOCK, REAL_DRAG_CLOCK} from '../../logic/dragClock.js';
import {FIELD_EDIT_MODE} from '../../logic/fieldEditMode.js';
import {useNumInput, type NumInputProps} from '../../hooks/NumInput-hooks.js';

defineOptions({inheritAttrs: false});
const props = withDefaults(defineProps<NumInputProps>(), {
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
const {inputEl, unitEl, increaseEl, decreaseEl, isReadonly, keyboard, display, classes, refusal, hasDq, helpText, dqTooltip, underlineIndex, showStepper, dqNoteTitle, isRootCause, isSymptom, onFocus, onBoxPointer, onBoxPointerUp, onKeydown, onKeyup, onBeforeInput, onPaste, onWheel, onInput, onBlur, onStepperPointerDown, onStepperPointerUp, stopRepeat, onStepperLeave, onStepperFocus, onStepperBlur} = useNumInput(props, emit, {
  presentationState: useApp().presentation,
  stepperPin: inject(STEPPER_PIN, null),
  fieldEditMode: inject(FIELD_EDIT_MODE, null),
  dragClock: inject(DRAG_CLOCK, REAL_DRAG_CLOCK),
  attrs: useAttrs(),
});
</script>

<template>
  <span class="num-input-wrap">
    <input ref="inputEl" v-bind="$attrs" :readonly="isReadonly" data-numinput type="text" :inputmode="keyboard" autocomplete="off" :value="display"
      :class="classes" :title="refusal !== '' ? refusal : hasDq ? `${helpText ?? ''}${helpText ? ' — ' : ''}${dqTooltip}` : helpText"
      @focus="onFocus" @pointerdown="onBoxPointer" @pointerup="onBoxPointerUp" @keydown="onKeydown" @keyup="onKeyup" @beforeinput="onBeforeInput" @paste="onPaste" @wheel="onWheel" @input="onInput" @blur="onBlur">
    <span v-if="underlineIndex !== null" class="num-mark-overlay" aria-hidden="true"><span class="num-mark-pre">{{ display.slice(0, underlineIndex) }}</span><span class="num-mark-underline">{{ display.slice(underlineIndex, underlineIndex + 1) }}</span><span class="num-mark-post">{{ display.slice(underlineIndex + 1) }}</span></span>
  </span>
  <span v-if="hasDq || (refusal !== '' && !hideMark)" class="dq-note" :class="{ 'dq-note-root': isRootCause || refusal !== '', 'dq-note-symptom': isSymptom }" :title="refusal !== '' ? `⚠ ${refusal}` : dqNoteTitle">⚠</span>
  <span v-if="$slots.unit" ref="unitEl" class="num-unit" @focusin="onStepperFocus" @focusout="onStepperBlur"><slot name="unit" /></span>
  <span v-if="showStepper" class="num-stepper">
    <button ref="increaseEl" type="button" class="num-stepper-btn" title="Increase"
      @pointerdown="onStepperPointerDown(1, $event)" @pointerup="onStepperPointerUp" @pointerleave="onStepperLeave" @pointercancel="stopRepeat"
      @focus="onStepperFocus" @blur="onStepperBlur" @keydown="onKeydown" @keyup="onKeyup">▲</button>
    <button ref="decreaseEl" type="button" class="num-stepper-btn" title="Decrease"
      @pointerdown="onStepperPointerDown(-1, $event)" @pointerup="onStepperPointerUp" @pointerleave="onStepperLeave" @pointercancel="stopRepeat"
      @focus="onStepperFocus" @blur="onStepperBlur" @keydown="onKeydown" @keyup="onKeyup">▼</button>
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
  touch-action: pan-y;
}
.num-stepper-btn + .num-stepper-btn { border-left: none; }
.num-stepper-btn:first-child { border-radius: 4px 0 0 4px; }
.num-stepper-btn:last-child { border-radius: 0 4px 4px 0; }
.num-stepper-btn:active { background: var(--acc, #36c); color: #fff; }

.num-unit { display: contents; }

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

<style>
/* Keep mandatory desktop fields as distinct as the production editor's native controls. */
.app-root:not(.app-root-mobile) input.de-input-mandatory:not(.de-input-empty):not(.inp-bad):not(.dq-flag) {
  border-color: #767676; border-style: inset;
}
</style>
