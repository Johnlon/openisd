/** The filter cascade the sweep multiplies in. Everything a caller outside the engine does
 *  with a filter is `FilterEngine` (`./filters/FilterEngine.ts`); the maths per type is its
 *  `*FilterModel` class in `./filters/`. */
import {cMul, cx} from './complex.js';
import type {Complex, Filter} from './types.js';
import {filterModel} from './filters/index.js';


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
