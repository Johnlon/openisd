/**
 * WinISD's EQ/Filter chain, and the two OpenISD-only shelves — one class per filter type,
 * chosen by `filterModel()` below. Every formula, evaluation order and quirk (Bessel HP not
 * mirroring its LP, Linkwitz-Riley ignoring its own order field, Allpass order above 2
 * collapsing to the 2nd-order section, …) is WinISD behaviour, verified live by debugger and
 * copied exactly onto the class that owns it: winisd_research/GHIDRA_FINDINGS.md "EQ/Filter
 * chain — every filter type's response and group delay". `.wpr` field names and Add defaults:
 * winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format".
 */
import type {FilterSpec} from '../types.js';
import type {FilterModel} from './FilterModel.js';
import {PassFilter} from './PassFilter.js';
import {AllpassFilter} from './AllpassFilter.js';
import {LinkwitzTransformFilter} from './LinkwitzTransformFilter.js';
import {ParametricEqFilter} from './ParametricEqFilter.js';
import {PeakHighpassFilter} from './PeakHighpassFilter.js';
import {StaticGainFilter} from './StaticGainFilter.js';
import {RaisedCosineFilter} from './RaisedCosineFilter.js';
import {ShelfFilter} from './ShelfFilter.js';

export type {FilterModel} from './FilterModel.js';

/**
 * The one place a `FilterSpec` becomes behaviour — an exhaustive switch on `type`, no default
 * arm: `FilterSpec['type']` is a closed 10-member union, so an unhandled new variant fails to
 * COMPILE here ("not all code paths return a value") rather than falling through to a generic
 * model nobody asked for.
 */
export function filterModel(spec: FilterSpec): FilterModel {
  switch (spec.type) {
    case 'lowpass':
    case 'highpass':     return new PassFilter(spec);
    case 'allpass':       return new AllpassFilter(spec);
    case 'linkwitz':      return new LinkwitzTransformFilter(spec);
    case 'peaking':       return new ParametricEqFilter(spec);
    case 'peakHighpass':  return new PeakHighpassFilter(spec);
    case 'staticGain':    return new StaticGainFilter(spec);
    case 'raisedCosine':  return new RaisedCosineFilter(spec);
    case 'lowshelf':
    case 'highshelf':     return new ShelfFilter(spec);
  }
}
