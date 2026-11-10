import type {Directive} from 'vue';
import {createPhoneLabelColumn, type PhoneLabelColumn} from './phoneLabelColumn.js';

/**
 * `v-phone-label-column` on a popup or sheet that floats over a phone page: the popup sizes its own label column
 * to its own labels, never the page behind it (John, 10 Nov 2026: "there is tons of empty space").
 */
export function createPhoneLabelColumnDirective(): Directive<HTMLElement, undefined> {
  const columns = new WeakMap<HTMLElement, PhoneLabelColumn>();
  return {
    mounted(el): void { columns.set(el, createPhoneLabelColumn(el)); },
    unmounted(el): void { columns.get(el)?.stop(); columns.delete(el); },
  };
}
