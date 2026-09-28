/**
 * The signal-chain filter door: `Engine.defaultFilter`/`Engine.sweep`/`Engine.filterCaption`/
 * `Engine.filterWpr`/`Engine.filterFromWpr`/`Engine.updateXFilter` reach every WinISD filter
 * type and the two OpenISD-only shelves through here. The formulas, one class per type, live in
 * `./filters/` — this file is the cascade (`applyFilters`), the data-only defaults
 * (`defaultFilter`), the `.wpr` `[Filters]` import/export dispatch (`filterWpr`/`filterFromWpr`)
 * and the typed-edit dispatch (`updateXFilter`), not the maths itself.
 */
import {cMul, cx} from './complex.js';
import type {
  AllpassFilter, AllpassPatch, Complex, Filter, FilterSpec, FilterType, LinkwitzFilter, LinkwitzPatch,
  ParametricEqFilter, ParametricEqPatch, PassFilter, PassPatch, PeakHighpassFilter, PeakHighpassPatch,
  RaisedCosineFilter, RaisedCosinePatch, ShelfFilter, ShelfPatch, StaticGainFilter, StaticGainPatch,
  WprFilter,
} from './types.js';
import {
  AllpassFilterModel, LinkwitzFilterModel, ParametricEqFilterModel, PassFilterModel,
  PeakHighpassFilterModel, RaisedCosineFilterModel, ShelfFilterModel, StaticGainFilterModel,
  filterModel,
} from './filters/index.js';


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

/** This filter's `.wpr` `[Filters]` shape, or `null` for a type WinISD has no `.wpr`
 *  representation for (the OpenISD-only shelves) — each class writes its own. */
export function filterWpr(f: Filter): WprFilter | null {
  return filterModel(f).wpr();
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
function defaultedWprFilter(type: FilterType, fields: readonly string[]): {filter: Filter; warning: string} {
  const def = defaultFilter(type);
  return {
    filter: {...def, enabled: enabledFromWprFields(fields, def.enabled)},
    warning: `${type} params malformed — WinISD loads it as its default ${type}`,
  };
}

/**
 * One `.wpr` `[Filters]` entry, decoded — `typeNum` is WinISD's own Filter Editor type number
 * (`filter<i>type`), `fields` its already-`;`-split `filter<i>params`. One exhaustive switch on
 * `typeNum`, each branch handing `fields` to that type's own class's static parser — no
 * string-keyed lookup table. `filter` is `null` when WinISD skips the entry outright: an
 * unknown type number, or (low/highpass only) a subtype above 3
 * (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format"; not measured for a
 * negative/non-integer subtype — those fall through to the malformed-params branch instead of
 * guessing a response). `warning` is set whenever the entry did not come back as its own
 * stated values.
 */
export function filterFromWpr(typeNum: number, fields: readonly string[]): {filter: Filter | null; warning: string | null} {
  const parsed = (kind: FilterType, result: FilterSpec | 'malformed'): {filter: Filter | null; warning: string | null} => {
    if (result === 'malformed') return defaultedWprFilter(kind, fields);
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

// ── TYPED EDITS ────────────────────────────────────────────────────────────────────────────
// One function per filter class, each a straight typed forward to that class's own `with()` —
// the core's decision on what a filter editor may write (rounding, clamping to the Filter
// Editor's own entry range). No string-keyed dispatch: each editor calls the one `Engine`
// method matching its own narrowed `Filter` variant (BUG_20260927_filter-editors-hold-domain-logic.md).

/** Typed edit for a Lowpass/Highpass filter. */
export function updatePassFilter(f: PassFilter, patch: PassPatch): PassFilter {
  return PassFilterModel.with(f, patch);
}

/** Typed edit for an Allpass filter. */
export function updateAllpassFilter(f: AllpassFilter, patch: AllpassPatch): AllpassFilter {
  return AllpassFilterModel.with(f, patch);
}

/** Typed edit for a Linkwitz transform. */
export function updateLinkwitzFilter(f: LinkwitzFilter, patch: LinkwitzPatch): LinkwitzFilter {
  return LinkwitzFilterModel.with(f, patch);
}

/** Typed edit for a Parametric EQ (peaking) filter. */
export function updateParametricEqFilter(f: ParametricEqFilter, patch: ParametricEqPatch): ParametricEqFilter {
  return ParametricEqFilterModel.with(f, patch);
}

/** Typed edit for a Peaking 2nd-order highpass filter. */
export function updatePeakHighpassFilter(f: PeakHighpassFilter, patch: PeakHighpassPatch): PeakHighpassFilter {
  return PeakHighpassFilterModel.with(f, patch);
}

/** Typed edit for a Static gain filter. */
export function updateStaticGainFilter(f: StaticGainFilter, patch: StaticGainPatch): StaticGainFilter {
  return StaticGainFilterModel.with(f, patch);
}

/** Typed edit for a DLP Raised Cosine filter. */
export function updateRaisedCosineFilter(f: RaisedCosineFilter, patch: RaisedCosinePatch): RaisedCosineFilter {
  return RaisedCosineFilterModel.with(f, patch);
}

/** Typed edit for a Low/High shelf filter. */
export function updateShelfFilter(f: ShelfFilter, patch: ShelfPatch): ShelfFilter {
  return ShelfFilterModel.with(f, patch);
}
