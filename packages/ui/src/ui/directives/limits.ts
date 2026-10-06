import type {Directive} from 'vue';

// v-limits — hard entry constraints for RAW <input type="number"> elements (the ones not
// built on NumInput, which enforces the same bounds itself from the field registry).
//
//   <input type="number" v-model.number="advHumidity" v-limits="NumberField.ADV_HUMIDITY_PCT.limits">
//
// The binding value is { min?, max? } in the INPUT's own display space — pass the registry's
// `NumberField.X.limits` when the input edits the model unit directly, or explicit numbers where the
// input works in a scaled display unit. The directive:
//   1. stamps native min/max attributes (so the spinner/arrow keys can never leave the range);
//   2. clamps a typed value ABOVE max on 'input', and below min only on 'change' (leaving the
//      box, or Enter), re-dispatching the corrected value so a v-model written BEFORE this
//      listener ran is overwritten with the clamped one. Below min is not clamped mid-typing:
//      it is usually a number on its way somewhere — deleting the 7 of a Q of 0.7 leaves 0,
//      and clamping that to 0.1 made the box impossible to clear (John, 2026-10-06, LT filter).
// A transient empty/partial entry ('' or '-') is left alone so typing isn't fought mid-keystroke.
type Limits = { min?: number; max?: number };

const HANDLER = Symbol('limitsHandler');
const LIMITS = Symbol('limitsValue');
const REENTRY = Symbol('limitsReentry');

interface LimitsEl extends HTMLInputElement {
  [HANDLER]?: { readonly onInput: () => void; readonly onChange: () => void };
  [LIMITS]?: Limits;
  [REENTRY]?: boolean;
}

function applyAttrs(el: LimitsEl, lim: Limits | undefined): void {
  if (lim === undefined) {
    // Bare `v-limits` (no value): adopt the element's own native min/max attributes as the
    // clamp range — the attrs already stop the spinner; this adds the typed-entry clamp.
    const min = el.min === '' ? undefined : parseFloat(el.min);
    const max = el.max === '' ? undefined : parseFloat(el.max);
    el[LIMITS] = { min, max };
    return;
  }
  el[LIMITS] = lim;
  if (lim.min !== undefined) el.min = String(lim.min); else el.removeAttribute('min');
  if (lim.max !== undefined) el.max = String(lim.max); else el.removeAttribute('max');
}

/** `typing`: the 'input' event of a keystroke, which clamps only above max. */
function clampNow(el: LimitsEl, typing: boolean): void {
  if (el[REENTRY]) return;
  const lim = el[LIMITS] ?? {};
  const raw = el.value;
  if (raw === '' || raw === '-') return;          // in-progress entry — don't fight the caret
  const v = parseFloat(raw);
  if (!isFinite(v)) return;
  let c = v;
  if (!typing && lim.min !== undefined && c < lim.min) c = lim.min;
  if (lim.max !== undefined && c > lim.max) c = lim.max;
  if (c === v) return;
  el.value = String(c);
  // Re-dispatch so the v-model listener (which already ran with the out-of-range value)
  // runs again with the clamped one. REENTRY guards the recursive dispatch.
  el[REENTRY] = true;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el[REENTRY] = false;
}

export const vLimits: Directive<LimitsEl, Limits | undefined> = {
  mounted(el, binding) {
    applyAttrs(el, binding.value);
    const onInput = (): void => clampNow(el, true);
    const onChange = (): void => clampNow(el, false);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    el[HANDLER] = {onInput, onChange};
  },
  updated(el, binding) {
    applyAttrs(el, binding.value);
  },
  unmounted(el) {
    const handler = el[HANDLER];
    if (handler) {
      el.removeEventListener('input', handler.onInput);
      el.removeEventListener('change', handler.onChange);
    }
  },
};
