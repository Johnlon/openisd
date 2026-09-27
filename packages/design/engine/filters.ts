/**
 * WinISD's EQ/Filter chain — every filter type's response, evaluated at s = jω (or the
 * normalised s = j·f/fc for the pass families).
 *
 * Formulas, evaluation order and every quirk (Bessel HP not mirroring its LP, Linkwitz-Riley
 * ignoring its own order field, Allpass order above 2 collapsing to the 2nd-order section, …)
 * are WinISD behaviour, verified live by debugger and copied exactly:
 * winisd_research/GHIDRA_FINDINGS.md "EQ/Filter chain — every filter type's response and
 * group delay". `.wpr` field names and Add defaults: winisd_research/PROBE_FINDINGS.md
 * "`.wpr` `[Filters]` format".
 *
 * Linkwitz transform (sealed enclosure bass extension) is the one type that predates this
 * doc and is unchanged by it:
 *   https://en.wikipedia.org/wiki/Linkwitz_transform
 */

import {cAdd, cDiv, cInv, cMul, cScale, cSub, cx} from './complex.js';
import type {Complex, Filter, FilterType, PassFamily} from './types.js';

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

// ---- Butterworth (GHIDRA_FINDINGS.md "EQ/Filter chain": Bn = Π(s − pk), pk = exp(jπ(2k+n+1)/(2n))) ----

function butterworthPoles(n: number): Complex[] {
  const poles: Complex[] = [];
  for (let k = 0; k < n; k++) {
    const theta = Math.PI * (2 * k + n + 1) / (2 * n);
    poles.push(cx(Math.cos(theta), Math.sin(theta)));
  }
  return poles;
}

function polyFromRoots(s: Complex, roots: readonly Complex[]): Complex {
  let acc = cx(1, 0);
  for (const r of roots) acc = cMul(acc, cSub(s, r));
  return acc;
}

/** Butterworth LP, order n, at normalised s = j·x (x = f/fc): H = 1/Bn(s). */
function butterworthLP(x: number, n: number): Complex {
  return cInv(polyFromRoots(cx(0, x), butterworthPoles(n)));
}

/** Butterworth HP, order n: H = 1/Bn(1/s) — the mirror, via 1/s, not a reflected pole set. */
function butterworthHP(x: number, n: number): Complex {
  return cInv(polyFromRoots(cInv(cx(0, x)), butterworthPoles(n)));
}

// ---- Bessel (GHIDRA_FINDINGS.md: phase-normalised, k = c0^(1/n)) ----

function factorial(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

/** cm = (2n−m)!/(2^(n−m)·m!·(n−m)!), m = 0..n. cm[0] = c0, cm[n] = 1 always. */
function besselCoeffs(n: number): number[] {
  const cm: number[] = [];
  for (let m = 0; m <= n; m++) cm.push(factorial(2 * n - m) / (Math.pow(2, n - m) * factorial(m) * factorial(n - m)));
  return cm;
}

/** [(k·s)^0, (k·s)^1, …, (k·s)^n] at normalised s = j·x. */
function besselTerms(x: number, n: number, k: number): Complex[] {
  const ks = cx(0, k * x);
  const terms: Complex[] = [cx(1, 0)];
  for (let m = 1; m <= n; m++) terms.push(cMul(terms[m - 1], ks));
  return terms;
}

function besselDenominator(cm: readonly number[], terms: readonly Complex[]): Complex {
  let sum = cx(0, 0);
  for (let m = 0; m < cm.length; m++) sum = cAdd(sum, cScale(terms[m], cm[m]));
  return sum;
}

/** Bessel LP, order n: c0 / Σ cm·(k·s)^m. */
function besselLP(x: number, n: number): Complex {
  const cm = besselCoeffs(n);
  const k = Math.pow(cm[0], 1 / n);
  return cDiv(cx(cm[0], 0), besselDenominator(cm, besselTerms(x, n, k)));
}

/**
 * Bessel HP, order n: (k·s)^n / Σ cm·(k·s)^m — the LP's own denominator with numerator
 * (k·s)^n. NOT the mirror of the LP (a correct HP would be c0/Σ cm·(k/s)^m) — WinISD quirk,
 * GHIDRA_FINDINGS.md "Bessel HP ⚠".
 */
function besselHP(x: number, n: number): Complex {
  const cm = besselCoeffs(n);
  const k = Math.pow(cm[0], 1 / n);
  const terms = besselTerms(x, n, k);
  return cDiv(terms[n], besselDenominator(cm, terms));
}

// ---- SOS: plain 2nd-order LP/HP with Q, order ignored ----

/** LP 1/(s²+s/Q+1), HP s²/(s²+s/Q+1), at normalised s = j·x. */
function sos(kind: 'lowpass' | 'highpass', x: number, Q: number): Complex {
  const denom = cx(1 - x * x, x / Q);
  return kind === 'lowpass' ? cInv(denom) : cDiv(cx(-x * x, 0), denom);
}

/**
 * One WinISD pass-family filter (Lowpass/Highpass "Subtype"), normalised s = j·(f/fc).
 * Linkwitz-Riley always uses the underlying Butterworth order 2, squared — the `order`
 * field is kept (it round-trips through the `.wpr`) but ignored, same as WinISD.
 */
function passFilter(kind: 'lowpass' | 'highpass', family: PassFamily, order: number, fc: number, Q: number, f: number): Complex {
  const x = f / fc;
  switch (family) {
    case 'butterworth': return kind === 'lowpass' ? butterworthLP(x, order) : butterworthHP(x, order);
    case 'linkwitzRiley': {
      const h2 = kind === 'lowpass' ? butterworthLP(x, 2) : butterworthHP(x, 2);
      return cMul(h2, h2);
    }
    case 'bessel': return kind === 'lowpass' ? besselLP(x, order) : besselHP(x, order);
    case 'sos': return sos(kind, x, Q);
  }
}

// ---- Allpass ----

/**
 * Allpass. Order 1: (1 − jωt/2)/(1 + jωt/2), DC group delay t. Order ≥ 2: the 2nd-order
 * allpass with ω0 = 2/t and Q, DC group delay t/Q; order above 2 is ignored (GHIDRA_FINDINGS.md
 * "Allpass n ≥ 2 ⚠": n=3 and n=4 give the same 2nd-order section as n=2).
 */
function allpass(f: number, order: number, t: number, Q: number): Complex {
  const w = 2 * Math.PI * f;
  if (order <= 1) return cDiv(cx(1, -w * t / 2), cx(1, w * t / 2));
  const w0 = 2 / t;
  return biquad(w, 1, -w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
}

// ---- Linkwitz transform ----

/**
 * Linkwitz transform — reshapes a sealed-box low-frequency response from its natural
 * alignment (f0, Q0) to a target alignment (fp, Qp).
 * H(s) = (s² + (ω₀/Q₀)·s + ω₀²) / (s² + (ωₚ/Qₚ)·s + ωₚ²)
 * https://en.wikipedia.org/wiki/Linkwitz_transform
 */
export function linkwitz(f: number, f0: number, Q0: number, fp: number, Qp: number): Complex {
  const w  = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * f0;
  const wp = 2 * Math.PI * fp;
  return biquad(w, 1, w0 / Q0, w0 * w0, 1, wp / Qp, wp * wp);
}

// ---- Parametric EQ (peaking) ----

/**
 * Parametric EQ. V = 10^(G/20). Boost (V ≥ 1): (s²+V·(ω0/Q)s+ω0²)/(s²+(ω0/Q)s+ω0²).
 * Cut (V < 1): (s²+(ω0/Q)s+ω0²)/(s²+(ω0/(V·Q))s+ω0²) — symmetric boost/cut, not the same
 * curve run backwards.
 */
function parametricEQ(f: number, fc: number, Q: number, gainDb: number): Complex {
  const w = 2 * Math.PI * f, w0 = 2 * Math.PI * fc;
  const V = Math.pow(10, gainDb / 20);
  if (V >= 1) return biquad(w, 1, V * w0 / Q, w0 * w0, 1, w0 / Q, w0 * w0);
  return biquad(w, 1, w0 / Q, w0 * w0, 1, w0 / (V * Q), w0 * w0);
}

// ---- Peaking 2nd-order highpass ----

/**
 * The HP2 whose peak is Gpk at fpk: s²/(s²+(ω0/Q)s+ω0²), P = 10^(Gpk/20),
 * Q² = (P² + P·√(P²−1))/2, ω0 = 2π·fpk·√(1 − 1/(2Q²)).
 */
function peakHighpass(f: number, fpk: number, gainPk: number): Complex {
  const P = Math.pow(10, gainPk / 20);
  const Q2 = (P * P + P * Math.sqrt(P * P - 1)) / 2;
  const Q = Math.sqrt(Q2);
  const w0 = 2 * Math.PI * fpk * Math.sqrt(1 - 1 / (2 * Q2));
  return biquad(2 * Math.PI * f, 1, 0, 0, 1, w0 / Q, w0 * w0);
}

// ---- Static gain ----

function staticGain(gainDb: number): Complex {
  return cx(Math.pow(10, gainDb / 20), 0);
}

// ---- DLP Raised Cosine ----

/**
 * Real, zero phase: x = log10(f/fc)/(log10(2)·BW); for −1 ≤ x ≤ 1,
 * 10^((1+cos(πx))·(G/20)·0.5), else 1. fc or BW ≤ 0 is replaced by 1e-6.
 */
function raisedCosine(f: number, fcIn: number, bwOctIn: number, gainDb: number): Complex {
  const fc = fcIn <= 0 ? 1e-6 : fcIn;
  const bw = bwOctIn <= 0 ? 1e-6 : bwOctIn;
  const x = Math.log10(f / fc) / (Math.log10(2) * bw);
  if (x < -1 || x > 1) return cx(1, 0);
  return cx(Math.pow(10, (1 + Math.cos(Math.PI * x)) * (gainDb / 20) * 0.5), 0);
}

// ---- OpenISD-only shelves (not a WinISD type) ----

/**
 * 2nd-order Low-shelf filter.
 * H(s) = A * (s² + (√A/Q)·s + A) / (A·s² + (√A/Q)·s + 1)
 * where A = 10^(gainDb/40).
 */
function lowShelf(f: number, fc: number, Q: number, gainDb: number): Complex {
  const w = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * fc;
  const A  = Math.pow(10, gainDb / 40);
  const sqA = Math.sqrt(A);
  return biquad(w,
    A, A * sqA * w0 / Q, A * A * w0 * w0,
    A, sqA * w0 / Q, w0 * w0
  );
}

/**
 * 2nd-order High-shelf filter.
 * H(s) = A * (A·s² + (√A/Q)·s + 1) / (s² + (√A/Q)·s + A)
 * where A = 10^(gainDb/40).
 */
function highShelf(f: number, fc: number, Q: number, gainDb: number): Complex {
  const w = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * fc;
  const A  = Math.pow(10, gainDb / 40);
  const sqA = Math.sqrt(A);
  return biquad(w,
    A * A, A * sqA * w0 / Q, A * w0 * w0,
    1, sqA * w0 / Q, A * w0 * w0
  );
}

/**
 * A fresh filter of `type` with its starting values — the numbers a quick-add button puts on
 * screen before the user touches anything. Enabled; no list id — that key is the UI's, minted
 * where the filter is put in a list. WinISD's own Filter Editor "Add" defaults for its 8 types
 * (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format", Add defaults column);
 * linkwitz and the two OpenISD-only shelves keep the values OpenISD already shipped. Exhaustive
 * over `FilterType`: a new type with no starting values fails to compile here.
 */
export function defaultFilter(type: FilterType): Filter {
  switch (type) {
    case 'lowpass':      return {type, enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707};
    case 'highpass':     return {type, enabled: true, family: 'butterworth', order: 2, fc: 20, Q: 0.707};
    case 'allpass':       return {type, enabled: true, order: 1, t: 0.001, Q: 0.707};
    case 'linkwitz':      return {type, enabled: true, f0: 50, Q0: 0.7, fp: 20, Qp: 0.5};
    case 'peaking':        return {type, enabled: true, fc: 30, Q: 2, gain: 6};
    case 'peakHighpass':   return {type, enabled: true, fpk: 20, gainPk: 6};
    case 'staticGain':     return {type, enabled: true, gain: 0};
    case 'raisedCosine':   return {type, enabled: true, fc: 100, bwOct: 0.333, gain: 6};
    case 'lowshelf':       return {type, enabled: true, fc: 150, Q: Math.SQRT1_2, gain: 6};
    case 'highshelf':      return {type, enabled: true, fc: 2000, Q: Math.SQRT1_2, gain: 6};
  }
  // No default arm: `type` is `FilterType`, a closed 10-member union, and every call site is
  // either a literal from that union or a value parsed through `filterJsonSchema`'s matching
  // `z.discriminatedUnion(...)` (openisdSchema.ts) — nothing untyped can reach this switch.
  // Leaving the default off (rather than a `never`-typed throw) means an unhandled new variant
  // fails to COMPILE ("not all code paths return a value") instead of merely failing to be
  // dead code at runtime.
}

/**
 * Evaluate one filter descriptor at frequency f.
 * Returns complex H(jω) — multiply onto Hc, UD, UP in sweep.js.
 */
export function evalFilter(f: number, flt: Filter): Complex {
  switch (flt.type) {
    case 'lowpass':
    case 'highpass':    return passFilter(flt.type, flt.family, flt.order, flt.fc, flt.Q, f);
    case 'allpass':      return allpass(f, flt.order, flt.t, flt.Q);
    case 'linkwitz':     return linkwitz(f, flt.f0, flt.Q0, flt.fp, flt.Qp);
    case 'peaking':      return parametricEQ(f, flt.fc, flt.Q, flt.gain);
    case 'peakHighpass': return peakHighpass(f, flt.fpk, flt.gainPk);
    case 'staticGain':   return staticGain(flt.gain);
    case 'raisedCosine': return raisedCosine(f, flt.fc, flt.bwOct, flt.gain);
    case 'lowshelf':     return lowShelf(f, flt.fc, flt.Q, flt.gain);
    case 'highshelf':    return highShelf(f, flt.fc, flt.Q, flt.gain);
  }
  // No default arm — same closed-union reasoning as `defaultFilter` above: `flt.type` is
  // `FilterType`, so an unhandled new variant fails to compile rather than silently returning
  // a "no-op" unity gain that would mask the missing case.
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
