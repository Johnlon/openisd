/** Shared `<input @change>` parsing for every filter editor below — the DOM event's raw string
 *  value, read once and turned into the number/int a filter field wants. */
import {inputValue} from '../../../../logic/domEvents.js';

export function numFrom(e: Event): number { return Number(inputValue(e)); }
export function intFrom(e: Event): number { return Math.round(numFrom(e)); }
