/** Shared `<input @input>`/`<input @change>` parsing for every filter editor below — the DOM event's raw string
 *  value, read once as a plain number. Rounding/validation is the core update's job
 *  (`Engine.updateXFilter`), not this file's — display plumbing only. */
import {inputFrom, inputValue} from '../../../../logic/domEvents.js';

export function numFrom(e: Event): number { return Number(inputValue(e)); }

/** `@input`: hands `apply` each spin step (a held spinner fires `input` per step, `change` only on
 *  release), but only once the field holds a complete in-range number — an emptied or half-typed
 *  box waits for `@change` rather than snapping to a limit mid-entry. */
export function liveNum(e: Event, apply: (v: number) => void): void {
  const el = inputFrom(e);
  if (el === null || el.value === '') return;
  const {badInput, rangeUnderflow, rangeOverflow} = el.validity;
  if (badInput || rangeUnderflow || rangeOverflow) return;
  apply(Number(el.value));
}
