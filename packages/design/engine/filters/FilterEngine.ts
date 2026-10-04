/**
 * The filters area of the engine: what a caller outside the engine does WITH a filter — the
 * starting values of a fresh one, its Filters-list caption, its `.wpr` shape in and out, and
 * the typed edits an editor may make. The maths of each filter type stays on its own
 * `*FilterModel` class; this is the one door to them.
 */
import type {
  AllpassFilter, AllpassPatch, Filter, FilterSpec, FilterType, LinkwitzFilter, LinkwitzPatch,
  ParametricEqFilter, ParametricEqPatch, PassFilter, PassPatch, PeakHighpassFilter, PeakHighpassPatch,
  RaisedCosineFilter, RaisedCosinePatch, ShelfFilter, ShelfPatch, StaticGainFilter, StaticGainPatch,
  WinisdFilterErrors, WprFilter, WprFilterImport,
} from '../types.js';
import {
  AllpassFilterModel, LinkwitzFilterModel, ParametricEqFilterModel, PassFilterModel,
  PeakHighpassFilterModel, RaisedCosineFilterModel, StaticGainFilterModel, filterModel,
} from './index.js';
import {
  FILTER_BW_LIMITS, FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_ORDER_LIMITS, FILTER_Q_LIMITS,
  FILTER_T_LIMITS, LINKWITZ_RILEY_ORDER_LIMITS, type FieldLimits,
} from '../../fields/filterLimits.js';
import {clamp, roundClamp} from './limits.js';
import {LinkwitzRileyFamily} from './passFamilies/LinkwitzRileyFamily.js';

/** How a low/high-pass filter's Order box takes entry, decided per family. */
export interface PassOrderEntry {
  /** The entry range. */
  readonly limits: FieldLimits;
  /** The spinner step. */
  readonly step: number;
  /** False where the family has one order only (User SOS); the box is shown greyed out. */
  readonly editable: boolean;
  /** The box's tooltip. */
  readonly title: string;
}

const ORDER_ANY: PassOrderEntry = Object.freeze({
  limits: FILTER_ORDER_LIMITS, step: 1, editable: true,
  title: 'Filter order: 1st order = 6 dB/oct, 2nd = 12 dB/oct, 4th = 24 dB/oct. Up to 20.',
});
const ORDER_LINKWITZ_RILEY: PassOrderEntry = Object.freeze({
  limits: LINKWITZ_RILEY_ORDER_LIMITS, step: 2, editable: true,
  title: 'Linkwitz-Riley order: even orders only, 2 to 20 (Butterworth of half the order, squared).',
});
const ORDER_SOS: PassOrderEntry = Object.freeze({
  limits: FILTER_ORDER_LIMITS, step: 1, editable: false,
  title: 'A user second-order section is order 2 by definition; its order is not used.',
});

export interface FilterEngine {
  /** A fresh, enabled filter of `type` with its starting values — WinISD's own Filter Editor
   *  "Add" defaults for its 8 types (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]`
   *  format", Add defaults column); linkwitz and the two OpenISD-only shelves keep the values
   *  OpenISD already shipped. No list id: the UI mints that. */
  default(type: FilterType): Filter;
  /** WinISD's Filters-list caption for one filter, exact wording. */
  caption(f: Filter): string;
  /** This filter's `.wpr` `[Filters]` `filter<i>type`/`filter<i>params` shape, or `null` for a
   *  type WinISD has no `.wpr` representation for (the OpenISD-only shelves). */
  wpr(f: Filter): WprFilter | null;
  /** One `.wpr` `[Filters]` entry, decoded — WinISD's own type number (`filter<i>type`, 0-7)
   *  and its already-split `filter<i>params` fields. `filter` is `null` when WinISD skips the
   *  entry outright (unknown type, or a low/highpass subtype above 3); `warning` is set
   *  whenever the entry did not import as its own stated values. */
  fromWpr(typeNum: number, fields: readonly string[]): WprFilterImport;
  // Typed edits, one per filter class — what a filter EDITOR may write: `order` rounded to an
  // integer then clamped to WinISD's 1..10, every other field clamped to its own entry range
  // (`fields/filterLimits.ts`). A field left out of `patch` passes through unchanged; the
  // variant in is the variant out (bugs/archive/BUG_20260927_filter-editors-hold-domain-logic.md).
  editPass(f: PassFilter, patch: PassPatch): PassFilter;
  /** How `f`'s Order box takes entry: Linkwitz-Riley even orders only, User SOS fixed. */
  passOrderEntry(f: PassFilter): PassOrderEntry;
  editAllpass(f: AllpassFilter, patch: AllpassPatch): AllpassFilter;
  editLinkwitz(f: LinkwitzFilter, patch: LinkwitzPatch): LinkwitzFilter;
  editParametricEq(f: ParametricEqFilter, patch: ParametricEqPatch): ParametricEqFilter;
  editPeakHighpass(f: PeakHighpassFilter, patch: PeakHighpassPatch): PeakHighpassFilter;
  editStaticGain(f: StaticGainFilter, patch: StaticGainPatch): StaticGainFilter;
  editRaisedCosine(f: RaisedCosineFilter, patch: RaisedCosinePatch): RaisedCosineFilter;
  editShelf(f: ShelfFilter, patch: ShelfPatch): ShelfFilter;
}

/** `fields[1]` is every WinISD `.wpr` filter type's own `enabled` bit — parse it once here;
 *  `fallback` (the type default's own `enabled`, always `true`) covers an absent/non-numeric
 *  line (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format"). */
function enabledFromWprFields(fields: readonly string[], fallback: boolean): boolean {
  const n = Number(fields[1]);
  return Number.isFinite(n) ? n === 1 : fallback;
}

/** `type`'s own WinISD Add default, with `enabled` taken from the params line when it states
 *  one — the load behaviour WinISD itself shows for a malformed/wrong-field-count params line
 *  (measured: `runs/filter-allpass-1`, a 4-field allpass loads as n=1, t=0.001). */
function defaultedWprFilter(engine: FilterEngine, type: FilterType, fields: readonly string[]): WprFilterImport {
  const def = engine.default(type);
  return {
    filter: {...def, enabled: enabledFromWprFields(fields, def.enabled)},
    warning: `${type} params malformed — WinISD loads it as its default ${type}`,
  };
}

/** No WinISD filter error reproduced: for a caption or `.wpr` shape, which no response maths reaches. */
const NO_WINISD_FILTER_ERRORS: WinisdFilterErrors = Object.freeze({besselHighpass: false});

/** The one implementation. Built by `Engine`; nothing outside the engine names it. */
export class FilterEngineImpl implements FilterEngine {
  default(type: FilterType): Filter {
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
    // No default arm: `type` is `FilterType`, a closed 10-member union, so an unhandled new
    // variant fails to COMPILE ("not all code paths return a value").
  }

  caption(f: Filter): string {
    // A caption and a `.wpr` shape do not depend on the response maths, so the error switches are moot.
    return filterModel(f, NO_WINISD_FILTER_ERRORS).caption();
  }

  wpr(f: Filter): WprFilter | null {
    return filterModel(f, NO_WINISD_FILTER_ERRORS).wpr();
  }

  fromWpr(typeNum: number, fields: readonly string[]): WprFilterImport {
    const parsed = (kind: FilterType, result: FilterSpec | 'malformed'): WprFilterImport => {
      if (result === 'malformed') return defaultedWprFilter(this, kind, fields);
      return {filter: {...result, enabled: enabledFromWprFields(fields, true)}, warning: null};
    };
    switch (typeNum) {
      case 0:
      case 1: {
        const kind = typeNum === 0 ? 'lowpass' : 'highpass';
        const result = PassFilterModel.fromWpr(kind, fields);
        if (result === 'unsupportedSubtype') {
          return {filter: null, warning: `unsupported ${kind} subtype — skipped`};
        }
        return parsed(kind, result);
      }
      case 2: return parsed('allpass', AllpassFilterModel.fromWpr(fields));
      case 3: return parsed('linkwitz', LinkwitzFilterModel.fromWpr(fields));
      case 4: return parsed('peaking', ParametricEqFilterModel.fromWpr(fields));
      case 5: return parsed('peakHighpass', PeakHighpassFilterModel.fromWpr(fields));
      case 6: return parsed('staticGain', StaticGainFilterModel.fromWpr(fields));
      case 7: return parsed('raisedCosine', RaisedCosineFilterModel.fromWpr(fields));
      default:
        return {filter: null, warning: `unknown filter type ${typeNum} — skipped`};
    }
  }

  editPass(f: PassFilter, patch: PassPatch): PassFilter {
    const next = {...f, ...patch};
    const order = roundClamp(next.order, FILTER_ORDER_LIMITS);
    return {
      ...next,
      order: next.family === 'linkwitzRiley' ? LinkwitzRileyFamily.evenOrder(order) : order,
      fc: clamp(next.fc, FILTER_FC_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
    };
  }

  passOrderEntry(f: PassFilter): PassOrderEntry {
    switch (f.family) {
      case 'linkwitzRiley': return ORDER_LINKWITZ_RILEY;
      case 'sos':           return ORDER_SOS;
      case 'butterworth':
      case 'bessel':        return ORDER_ANY;
    }
  }

  editAllpass(f: AllpassFilter, patch: AllpassPatch): AllpassFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      order: roundClamp(next.order, FILTER_ORDER_LIMITS),
      t: clamp(next.t, FILTER_T_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
    };
  }

  editLinkwitz(f: LinkwitzFilter, patch: LinkwitzPatch): LinkwitzFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      f0: clamp(next.f0, FILTER_FC_LIMITS),
      Q0: clamp(next.Q0, FILTER_Q_LIMITS),
      fp: clamp(next.fp, FILTER_FC_LIMITS),
      Qp: clamp(next.Qp, FILTER_Q_LIMITS),
    };
  }

  editParametricEq(f: ParametricEqFilter, patch: ParametricEqPatch): ParametricEqFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      fc: clamp(next.fc, FILTER_FC_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
      gain: clamp(next.gain, FILTER_GAIN_LIMITS),
    };
  }

  editPeakHighpass(f: PeakHighpassFilter, patch: PeakHighpassPatch): PeakHighpassFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      fpk: clamp(next.fpk, FILTER_FC_LIMITS),
      gainPk: clamp(next.gainPk, FILTER_GAIN_LIMITS),
    };
  }

  editStaticGain(f: StaticGainFilter, patch: StaticGainPatch): StaticGainFilter {
    const next = {...f, ...patch};
    return {...next, gain: clamp(next.gain, FILTER_GAIN_LIMITS)};
  }

  editRaisedCosine(f: RaisedCosineFilter, patch: RaisedCosinePatch): RaisedCosineFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      fc: clamp(next.fc, FILTER_FC_LIMITS),
      bwOct: clamp(next.bwOct, FILTER_BW_LIMITS),
      gain: clamp(next.gain, FILTER_GAIN_LIMITS),
    };
  }

  editShelf(f: ShelfFilter, patch: ShelfPatch): ShelfFilter {
    const next = {...f, ...patch};
    return {
      ...next,
      fc: clamp(next.fc, FILTER_FC_LIMITS),
      Q: clamp(next.Q, FILTER_Q_LIMITS),
      gain: clamp(next.gain, FILTER_GAIN_LIMITS),
    };
  }
}
