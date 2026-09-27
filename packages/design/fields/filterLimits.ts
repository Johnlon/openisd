/**
 * The Filter Editor's own entry range per field — THE source of truth for both the core update
 * methods (`Engine.updateXFilter`, `packages/design/engine/filters/*.ts`) that clamp a typed
 * edit into range, and the UI's `uiFields.ts` registry that stamps the same range onto the
 * `<input>` for display (native min/max, arrow-key stop). One number per field, never a second
 * copy.
 *
 * `order`: WinISD itself loads up to order 10; a saved `.wpr` above that hangs WinISD's own
 * load (see `filter_Order` in `uiFields.ts`, carried over unchanged).
 */
export interface FieldLimits {
  readonly min: number;
  readonly max: number;
}

export const FILTER_ORDER_LIMITS: FieldLimits = Object.freeze({min: 1, max: 10});
export const FILTER_FC_LIMITS: FieldLimits = Object.freeze({min: 1, max: 20000});
export const FILTER_Q_LIMITS: FieldLimits = Object.freeze({min: 0.1, max: 100});
export const FILTER_GAIN_LIMITS: FieldLimits = Object.freeze({min: -60, max: 60});
export const FILTER_T_LIMITS: FieldLimits = Object.freeze({min: 0, max: 10});
export const FILTER_BW_LIMITS: FieldLimits = Object.freeze({min: 0.01, max: 10});
