/**
 * How the stacked charts tile the chart area. The viewer picks N, the charts that stack in the
 * area's height; each row is 1/N of it. More than N charts add columns, up to as many as
 * `CHART_MIN_W` allows; past that the rows overflow and the area scrolls, a whole chart at a time.
 */

import type {CSSProperties} from 'vue';
import type {SelectorOption} from '@openisd/design/fields';

/** The charts-high numbers offered in a chart bar. */
export const CHARTS_HIGH_OPTIONS: readonly SelectorOption<number>[] = Object.freeze(
  [1, 2, 3, 4, 5].map(n => Object.freeze({ value: n, label: `${n}` })));
/** The charts high by default: desktop, where more add columns, and mobile, one column. */
export const ORIGINAL_CHARTS_HIGH = 3;
export const MOBILE_CHARTS_HIGH = 2;
/** The smallest chart width that still reads well. */
export const CHART_MIN_W = 380;
const MAX_COLS = 3;

export interface ChartGrid {
  readonly cols: number;
  readonly rows: number;
}

/** The most chart columns a `width` px area holds. */
export function chartColumnsFit(width: number): number {
  return Math.max(1, Math.min(MAX_COLS, Math.floor(width / CHART_MIN_W)));
}

/** The grid for `count` charts, `high` to the area's height, in at most `maxCols` columns. */
export function chartGridLayout(high: number, count: number, maxCols: number): ChartGrid {
  const cols = Math.max(1, Math.min(maxCols, Math.ceil(count / high)));
  return { cols, rows: Math.ceil(count / cols) };
}

/** The CSS grid templates for `grid` in an area `height` px tall. */
export interface ChartGridStyle extends CSSProperties {
  readonly gridTemplateColumns: string;
  readonly gridTemplateRows: string;
}

/** Up to `high` rows share the height; more rows are each `height / high` px and the area
 *  scrolls. */
export function chartGridStyle(high: number, grid: ChartGrid, height: number): ChartGridStyle {
  const overflow = grid.rows > high && height > 0;
  return {
    gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
    gridTemplateRows: overflow ? `repeat(${grid.rows}, ${height / high}px)` : `repeat(${grid.rows}, minmax(0, 1fr))`,
  };
}
