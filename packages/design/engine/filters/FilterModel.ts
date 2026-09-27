/**
 * One filter's own behaviour — its complex response, its Filters-list caption, and its `.wpr`
 * on-disk shape. The boundary where a `FilterSpec` (persisted data, `types.ts`) becomes
 * behaviour: see `filterModel()` in `./index.ts`, the one exhaustive switch that constructs one
 * of these per `FilterSpec['type']`.
 */
import type {Complex, WprFilter} from '../types.js';

export interface FilterModel {
  /** Complex response at f (Hz). */
  response(f: number): Complex;
  /** WinISD's Filters-list caption, exact wording (see filter-caption.test.ts). */
  caption(): string;
  /** This filter's `.wpr` `[Filters]` `filter<i>type`/`filter<i>params` shape, or `null` for a
   *  type WinISD has no `.wpr` representation for (the OpenISD-only shelves). */
  wpr(): WprFilter | null;
}
