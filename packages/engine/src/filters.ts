/**
 * Analog filter transfer functions evaluated at s = jω.
 *
 * Butterworth high-pass / low-pass s-domain transfer functions:
 *   https://en.wikipedia.org/wiki/Butterworth_filter#Transfer_function
 *
 * Linkwitz transform (sealed enclosure bass extension):
 *   https://en.wikipedia.org/wiki/Linkwitz_transform
 *
 * Peaking / parametric equaliser:
 *   https://en.wikipedia.org/wiki/Audio_equalization#Parametric_equalizer
 */

import { cx, cDiv, cMul } from './complex.js';
import type { Complex, Filter } from './types.js';

/**
 * Evaluate 2nd-order analog biquad H(s) = (b0s²+b1s+b2)/(a0s²+a1s+a2) at s = jω.
 *
 * (jω)² = −ω², so:
 *   numerator   = (b2 − b0·ω²) + j·b1·ω
 *   denominator = (a2 − a0·ω²) + j·a1·ω
 */
function biquad(w: number, b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Complex {
  return cDiv(cx(b2 - b0 * w * w, b1 * w),
              cx(a2 - a0 * w * w, a1 * w));
}

/**
 * 2nd-order high-pass filter.
 * H(s) = s² / (s² + (ω₀/Q)·s + ω₀²)
 * Default Q = 1/√2 ≈ 0.7071 gives maximally-flat (Butterworth) response.
 * https://en.wikipedia.org/wiki/Butterworth_filter#Transfer_function
 */
export function highPass(f: number, fc: number, Q = Math.SQRT1_2): Complex {
  const w0 = 2 * Math.PI * fc;
  return biquad(2 * Math.PI * f, 1, 0, 0, 1, w0 / Q, w0 * w0);
}

/**
 * 2nd-order low-pass filter.
 * H(s) = ω₀² / (s² + (ω₀/Q)·s + ω₀²)
 * https://en.wikipedia.org/wiki/Butterworth_filter#Transfer_function
 */
export function lowPass(f: number, fc: number, Q = Math.SQRT1_2): Complex {
  const w0 = 2 * Math.PI * fc;
  return biquad(2 * Math.PI * f, 0, 0, w0 * w0, 1, w0 / Q, w0 * w0);
}

/**
 * Linkwitz transform — reshapes a sealed-box low-frequency response
 * from its natural alignment (f0, Q0) to a target alignment (fp, Qp).
 *
 * H(s) = (s² + (ω₀/Q₀)·s + ω₀²) / (s² + (ωₚ/Qₚ)·s + ωₚ²)
 *
 * The numerator zeros cancel the existing sealed-box poles; the denominator
 * poles set the desired bass extension.
 * https://en.wikipedia.org/wiki/Linkwitz_transform
 */
export function linkwitz(f: number, f0: number, Q0: number, fp: number, Qp: number): Complex {
  const w  = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * f0;
  const wp = 2 * Math.PI * fp;
  return biquad(w, 1, w0 / Q0, w0 * w0, 1, wp / Qp, wp * wp);
}

/**
 * Peaking (parametric) EQ.
 * H(s) = (s² + (V·ω₀/Q)·s + ω₀²) / (s² + (ω₀/Q)·s + ω₀²)
 * where V = 10^(gainDb/20).
 * At f = fc: |H| = V (gain in linear).  At DC and HF: |H| = 1.
 * https://en.wikipedia.org/wiki/Audio_equalization#Parametric_equalizer
 */
export function peakingEQ(f: number, fc: number, Q: number, gainDb: number): Complex {
  const w0 = 2 * Math.PI * fc;
  const V  = Math.pow(10, gainDb / 20);
  return biquad(2 * Math.PI * f, 1, V * w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
}

/**
 * Evaluate one filter descriptor at frequency f.
 * Returns complex H(jω) — multiply onto Hc, UD, UP in sweep.js.
 */
export function evalFilter(f: number, flt: Omit<Filter, 'enabled'>): Complex {
  switch (flt.type) {
    case 'highpass': return highPass(f, flt.fc!, flt.Q);
    case 'lowpass':  return lowPass(f, flt.fc!, flt.Q);
    case 'linkwitz': return linkwitz(f, flt.f0!, flt.Q0!, flt.fp!, flt.Qp!);
    case 'peaking':  return peakingEQ(f, flt.fc!, flt.Q!, flt.gain!);
    default:         return cx(1, 0);
  }
}

/**
 * Apply an array of filter descriptors to a complex quantity as a cascade.
 * Enabled filters multiply in sequence; disabled ones are skipped.
 * Returns the net complex gain at frequency f (unity if no filters).
 */
export function applyFilters(f: number, filters?: Filter[]): Complex {
  let H = cx(1, 0);
  if (!filters || !filters.length) return H;
  for (const flt of filters) {
    if (flt.enabled) H = cMul(H, evalFilter(f, flt));
  }
  return H;
}
