import type { Directive } from 'vue';

// v-expo-step — proportional ("exponential") spinner stepping for LIVE-graph number
// inputs (left-nav + What-If controls). It keeps the element's native `step` at ≈10%
// of the current |value|, so the up/down arrows (and ArrowUp/Down keys, and wheel)
// move the value geometrically — compounding ±10% per click — instead of by a fixed
// absolute amount that is far too coarse for milli-scale values and too fine for
// kilo-scale ones. Direction is left to the native control, so a signed field still
// increases/decreases correctly; only the step MAGNITUDE is proportional.
//
// Do NOT apply to integer counts (No. of drivers, PR count) or to Define-New panels
// (those are not live-connected and, per the UX rule, carry no spinners at all).
function syncStep(el: HTMLInputElement): void {
  const v = Math.abs(parseFloat(el.value));
  el.step = v > 0 ? String(+(v * 0.1).toPrecision(4)) : 'any';
}

const HANDLER = Symbol('expoStepHandler');

interface ExpoEl extends HTMLInputElement { [HANDLER]?: () => void; }

export const vExpoStep: Directive<ExpoEl> = {
  mounted(el) {
    const handler = (): void => syncStep(el);
    handler();
    el.addEventListener('input', handler);
    el.addEventListener('focus', handler);
    el[HANDLER] = handler;
  },
  updated(el) {
    // Re-sync after a reactive re-render changed the bound value.
    syncStep(el);
  },
  unmounted(el) {
    const handler = el[HANDLER];
    if (handler) {
      el.removeEventListener('input', handler);
      el.removeEventListener('focus', handler);
    }
  },
};
