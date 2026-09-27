/**
 * The signal-chain filter door: `Engine.defaultFilter`/`Engine.sweep`/`Engine.filterCaption`
 * reach every WinISD filter type and the two OpenISD-only shelves through here. The formulas,
 * one class per type, live in `./filters/` — this file is the cascade (`applyFilters`) and the
 * data-only defaults (`defaultFilter`), not the maths itself.
 */
import {cMul, cx} from './complex.js';
import type {Complex, Filter, FilterType} from './types.js';
import {filterModel} from './filters/index.js';

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
  return filterModel(flt).response(f);
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

/** WinISD's Filters-list caption for one filter, exact wording — WinISD's own wording per type
 *  (winisd_research: `filter-add-all-1`, `filter-editor-3`/`filter-editor-4`). */
export function filterCaption(f: Filter): string {
  return filterModel(f).caption();
}
