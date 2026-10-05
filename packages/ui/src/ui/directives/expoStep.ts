import type {Directive} from 'vue';
import {shownSpinRule, spinStepAttr, spinValue, type NumberField, type SpinRule} from '@openisd/design/fields';

// v-expo-step — the spinner rule (`spinValue`, packages/design/fields/spinnerStep.ts) for RAW
// number inputs not built on NumInput (left-nav, Tune, filter editors). Bind the input's field
// (`v-expo-step="NumberField.FILTER_GAIN_DB"`) so counts step by 1 and gain by ≥ 0.1 dB; bare,
// the input steps by a tenth of its decade, never finer than its shown decimals.
//
// The browser's own step (arrows, wheel, ▲▼) supplies only the direction. A capture-phase
// `input` listener runs before the element's own handlers and replaces the browser's value with
// the rule's, so v-model / @input see the rule's value. The native `step` attribute is kept at
// the upward step, never 'any', so the browser always moves the value.

const STATE = Symbol('expoStepState');

interface ExpoState {
  readonly onInput: (e: Event) => void;
  readonly onFocus: () => void;
  field: NumberField | undefined;
  prev: string;
}

interface ExpoEl extends HTMLInputElement { [STATE]?: ExpoState; }

function ruleFor(el: ExpoEl, shown: string): SpinRule {
  const field = el[STATE]?.field;
  return field ? field.spinRule() : shownSpinRule(shown);
}

function bound(attr: string, fallback: number): number {
  const v = parseFloat(attr);
  return isFinite(v) ? v : fallback;
}

function sync(el: ExpoEl): void {
  const st = el[STATE];
  if (st) st.prev = el.value;
  el.step = spinStepAttr(el.value, ruleFor(el, el.value));
}

function onInput(el: ExpoEl, e: Event): void {
  const st = el[STATE];
  if (!st) return;
  const textEdit = e instanceof InputEvent && e.inputType !== '';
  const native = parseFloat(el.value);
  const prev = parseFloat(st.prev);
  if (!textEdit && isFinite(native) && isFinite(prev) && native !== prev) {
    const next = spinValue(st.prev, native > prev ? 1 : -1, ruleFor(el, st.prev), {
      min: bound(el.min, -Infinity),
      max: el.max === '' ? undefined : bound(el.max, Infinity),
    });
    el.value = String(next);
  }
  sync(el);
}

export const vExpoStep: Directive<ExpoEl, NumberField | undefined> = {
  mounted(el, binding) {
    const state: ExpoState = {
      onInput: (e: Event): void => onInput(el, e),
      onFocus: (): void => sync(el),
      field: binding.value,
      prev: el.value,
    };
    el[STATE] = state;
    el.addEventListener('input', state.onInput, {capture: true});
    el.addEventListener('focus', state.onFocus);
    sync(el);
  },
  updated(el, binding) {
    // Re-sync after a reactive re-render changed the bound value.
    const st = el[STATE];
    if (st) st.field = binding.value;
    sync(el);
  },
  unmounted(el) {
    const st = el[STATE];
    if (st) {
      el.removeEventListener('input', st.onInput, {capture: true});
      el.removeEventListener('focus', st.onFocus);
    }
  },
};
