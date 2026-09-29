/**
 * How the stacked charts tile the chart area: one column while every chart still gets the
 * chosen minimum height, otherwise up to three columns, as many as `CHART_MIN_W` allows.
 */

import type {CSSProperties} from 'vue';
import type {SelectorOption} from '@openisd/design/fields';

/** The default minimum chart height, px. */
export const CHART_MIN_H = 160;
/** The minimum chart heights offered in the chart bar, px. */
export const CHART_MIN_H_OPTIONS: readonly SelectorOption<number>[] = Object.freeze(
  [120, 160, 220, 300, 400].map(h => Object.freeze({ value: h, label: `${h} px` })));
/** The smallest chart width that still reads well. */
export const CHART_MIN_W = 380;
const MAX_COLS = 3;

export interface ChartGrid {
  readonly cols: number;
  readonly rows: number;
}

/** The grid for `count` charts of at least `minH` px in a `width` × `height` px area. Rows past
 *  the area's height overflow (the area scrolls). */
export function chartGridLayout(minH: number, count: number, width: number, height: number): ChartGrid {
  const rowsFit = Math.max(1, Math.floor(height / minH));
  const colsFit = Math.max(1, Math.min(MAX_COLS, Math.floor(width / CHART_MIN_W)));
  const cols = Math.max(1, Math.min(colsFit, Math.ceil(count / rowsFit)));
  return { cols, rows: Math.ceil(count / cols) };
}

/** The CSS grid templates for `grid` in an area `height` px tall. */
export interface ChartGridStyle extends CSSProperties {
  readonly gridTemplateColumns: string;
  readonly gridTemplateRows: string;
}

/** Rows that fit share the height; rows that do not keep `minH` and the area scrolls. A single
 *  row always fills the area. */
export function chartGridStyle(minH: number, grid: ChartGrid, height: number): ChartGridStyle {
  const rowMin = grid.rows > 1 && grid.rows * minH > height ? `${minH}px` : '0';
  return {
    gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${grid.rows}, minmax(${rowMin}, 1fr))`,
  };
}
