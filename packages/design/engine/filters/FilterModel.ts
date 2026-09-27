/**
 * One filter's own behaviour — its complex response and its Filters-list caption. The boundary
 * where a `FilterSpec` (persisted data, `types.ts`) becomes behaviour: see `filterModel()` in
 * `./index.ts`, the one exhaustive switch that constructs one of these per `FilterSpec['type']`.
 */
import type {Complex} from '../types.js';

export interface FilterModel {
  /** Complex response at f (Hz). */
  response(f: number): Complex;
  /** WinISD's Filters-list caption, exact wording (see filter-caption.test.ts). */
  caption(): string;
}
