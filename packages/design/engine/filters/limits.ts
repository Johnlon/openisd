/**
 * Clamp helpers shared by every filter class's `with()` — the one place a typed edit's numeric
 * fields get pinned into the Filter Editor's own entry range
 * (`packages/design/fields/filterLimits.ts`, the same bands `NumberField` states).
 */
import type {FieldLimits} from '../../fields/filterLimits.js';

export type {FieldLimits} from '../../fields/filterLimits.js';
export {
  FILTER_ORDER_LIMITS, FILTER_FC_LIMITS, FILTER_Q_LIMITS,
  FILTER_GAIN_LIMITS, FILTER_T_LIMITS, FILTER_BW_LIMITS,
} from '../../fields/filterLimits.js';

/** Pin `value` into `[min, max]`. */
export function clamp(value: number, limits: FieldLimits): number {
  return Math.min(limits.max, Math.max(limits.min, value));
}

/** Round to the nearest integer, then clamp — order 2.6 rounds to 3 (in range, no clamp);
 *  order 0 rounds to 0, then clamps up to the 1 floor. */
export function roundClamp(value: number, limits: FieldLimits): number {
  return clamp(Math.round(value), limits);
}
