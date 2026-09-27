/** Shared `<input @change>` parsing for every filter editor below — the DOM event's raw string
 *  value, read once as a plain number. Rounding/validation is the core update's job
 *  (`Engine.updateXFilter`), not this file's — display plumbing only. */
import {inputValue} from '../../../../logic/domEvents.js';

export function numFrom(e: Event): number { return Number(inputValue(e)); }
