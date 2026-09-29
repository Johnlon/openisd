/**
 * How the stacked charts tile the chart area: one column while every chart still gets
 * `CHART_MIN_H`, otherwise up to three columns, as many as `CHART_MIN_W` allows.
 */

import type {CSSProperties} from 'vue';

/** The smallest chart height that still reads well. */
export const CHART_MIN_H = 220;
/** The smallest chart width that still reads well. */
export const CHART_MIN_W = 380;
const MAX_COLS = 3;

export interface ChartGrid {
  readonly cols: number;
  readonly rows: number;
}

/** The grid for `count` charts in a `width` × `height` px area. Rows past the area's height
 *  overflow (the area scrolls). */
export function chartGridLayout(count: number, width: number, height: number): ChartGrid {
  const rowsFit = Math.max(1, Math.floor(height / CHART_MIN_H));
  const colsFit = Math.max(1, Math.min(MAX_COLS, Math.floor(width / CHART_MIN_W)));
  const cols = Math.max(1, Math.min(colsFit, Math.ceil(count / rowsFit)));
  return { cols, rows: Math.ceil(count / cols) };
}

/** The CSS grid templates for `grid` in an area `height` px tall. */
export interface ChartGridStyle extends CSSProperties {
  readonly gridTemplateColumns: string;
  readonly gridTemplateRows: string;
}

/** Rows that fit share the height; rows that do not keep `CHART_MIN_H` and the area scrolls.
 *  A single row always fills the area. */
export function chartGridStyle(grid: ChartGrid, height: number): ChartGridStyle {
  const rowMin = grid.rows > 1 && grid.rows * CHART_MIN_H > height ? `${CHART_MIN_H}px` : '0';
  return {
    gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${grid.rows}, minmax(${rowMin}, 1fr))`,
  };
}
