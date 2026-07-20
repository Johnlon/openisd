import type { Directive } from 'vue';

// v-expo-step — proportional ("exponential") spinner stepping for LIVE-graph number
// inputs (left-nav + What-If controls). It keeps the element's native `step` at a power
// of ten one decade below the current |value|, so the up/down arrows (and ArrowUp/Down
// keys, and wheel) move the value proportionally across scales — ~10–100 steps per decade
// — instead of by a fixed absolute amount too coarse for milli-scale values and too fine
// for kilo-scale ones. Direction is left to the native control, so a signed field still
// increases/decreases correctly; only the step MAGNITUDE is proportional.
//
// A power of ten (not the old value×0.1) is deliberate: value×0.1 is an arbitrary float,
// so it compounds into long decimals (50 → 55 → 60.5 → 66.55 → …) and, not being a clean
// multiple of the min, makes the browser refuse stepDown near min (the "down-arrow sticks"
// symptom). A power of ten is a clean multiple of 0, so the browser grid-snaps each step to
// a tidy decimal and stepping never stalls. Mirrors NumInput.vue's stepAttr.
//
// Do NOT apply to integer counts (No. of drivers, PR count) or to Define-New panels
// (those are not live-connected and, per the UX rule, carry no spinners at all).
function syncStep(el: HTMLInputElement): void {
  const v = Math.abs(parseFloat(el.value));
  if (!(v > 0)) { el.step = 'any'; return; }
  const decade = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  // Clamp so the step is never finer than the decimals the field currently shows — otherwise
  // a value below 1.0 would get a sub-display step (0.01 under "0.7") and gain a decimal.
  // These raw inputs carry no `precision` prop, so infer the floor from the shown decimals.
  const shownDp = (el.value.split('.')[1] || '').length;
  const minStep = shownDp > 0 ? Math.pow(10, -shownDp) : 1;
  el.step = String(Math.max(decade, minStep));
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
