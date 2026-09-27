import {cDiv, cx} from '../complex.js';
import type {Complex} from '../types.js';

/**
 * Evaluate 2nd-order analog biquad H(s) = (b0s²+b1s+b2)/(a0s²+a1s+a2) at s = jω.
 *
 * (jω)² = −ω², so:
 *   numerator   = (b2 − b0·ω²) + j·b1·ω
 *   denominator = (a2 − a0·ω²) + j·a1·ω
 *
 * Shared by every filter class whose response is one 2nd-order section: `AllpassFilter`,
 * `LinkwitzTransformFilter`, `ParametricEqFilter`, `PeakHighpassFilter`, `ShelfFilter`.
 */
export function biquad(w: number, b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Complex {
  return cDiv(cx(b2 - b0 * w * w, b1 * w),
              cx(a2 - a0 * w * w, a1 * w));
}
