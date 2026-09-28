/**
 * WinISD's EQ/Filter chain, and the two OpenISD-only shelves — one class per filter type,
 * chosen by `filterModel()` below. Every formula, evaluation order and quirk (Bessel HP not
 * mirroring its LP, Linkwitz-Riley ignoring its own order field, Allpass order above 2
 * collapsing to the 2nd-order section, …) is WinISD behaviour, verified live by debugger and
 * copied exactly onto the class that owns it: winisd_research/GHIDRA_FINDINGS.md "EQ/Filter
 * chain — every filter type's response and group delay". `.wpr` field names and Add defaults:
 * winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format".
 */
import type {Filter} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {PassFilterModel} from './PassFilterModel.js';
import {AllpassFilterModel} from './AllpassFilterModel.js';
import {LinkwitzFilterModel} from './LinkwitzFilterModel.js';
import {ParametricEqFilterModel} from './ParametricEqFilterModel.js';
import {PeakHighpassFilterModel} from './PeakHighpassFilterModel.js';
import {StaticGainFilterModel} from './StaticGainFilterModel.js';
import {RaisedCosineFilterModel} from './RaisedCosineFilterModel.js';
import {ShelfFilterModel} from './ShelfFilterModel.js';

export type {FilterModel} from './FilterModel.js';
// Re-exported so the `.wpr` import boundary (openIsdProjectToWinIsdProject.ts) can hand a WinISD
// type number's split params straight to the owning class's own static parser, with no
// string-keyed lookup table in between.
export {PassFilterModel} from './PassFilterModel.js';
export {AllpassFilterModel} from './AllpassFilterModel.js';
export {LinkwitzFilterModel} from './LinkwitzFilterModel.js';
export {ParametricEqFilterModel} from './ParametricEqFilterModel.js';
export {PeakHighpassFilterModel} from './PeakHighpassFilterModel.js';
export {StaticGainFilterModel} from './StaticGainFilterModel.js';
export {RaisedCosineFilterModel} from './RaisedCosineFilterModel.js';
export {ShelfFilterModel} from './ShelfFilterModel.js';

/**
 * The one place a `Filter` becomes behaviour — an exhaustive switch on `type`, no default
 * arm: `FilterSpec['type']` is a closed 10-member union, so an unhandled new variant fails to
 * COMPILE here ("not all code paths return a value") rather than falling through to a generic
 * model nobody asked for. Takes the whole `Filter` (spec + `enabled`), not just the spec, so a
 * model can write its own `enabled` bit into its `.wpr()` shape.
 */
export function filterModel(f: Filter): FilterModel {
  switch (f.type) {
    case 'lowpass':
    case 'highpass':     return new PassFilterModel(f);
    case 'allpass':       return new AllpassFilterModel(f);
    case 'linkwitz':      return new LinkwitzFilterModel(f);
    case 'peaking':       return new ParametricEqFilterModel(f);
    case 'peakHighpass':  return new PeakHighpassFilterModel(f);
    case 'staticGain':    return new StaticGainFilterModel(f);
    case 'raisedCosine':  return new RaisedCosineFilterModel(f);
    case 'lowshelf':
    case 'highshelf':     return new ShelfFilterModel(f);
  }
}
