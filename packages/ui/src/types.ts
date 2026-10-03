/**
 * Shared UI types — the view-layer shapes (drag selection, canvas geometry, Y-axis overrides).
 * Chart data shapes (Series, PlotData, PlotParams, Design) live in `@openisd/design/chart`.
 */

import type {FrequencyAxis} from '@openisd/design/chart';

/** Stats over a selected band (canvas reads ripple/peak/trough; peakF/avg are extra). */
export interface RangeStats {
  ripple: number;
  peak: number;
  trough: number;
  peakF?: number | null;
  avg?: number;
}

/** Frequency-band selection shared across graph panels. */
export interface DragRange {
  fLo: number;
  fHi: number;
  stats?: RangeStats;
}

/** Pixel↔data mapping returned by drawOne for crosshair hit-testing. */
export interface Geo {
  m: { l: number; r: number; t: number; b: number };
  pw: number;
  ph: number;
  X: (f: number) => number;
  Y: (v: number) => number;
  axis: FrequencyAxis;
}

/** Per-chart Y-axis override; absent entry = auto-scale. */
export interface YRange { min: number; max: number }
