/**
 * Chart data shapes — what a curve builder returns and what a chart panel draws: plot series,
 * plot bundles, the designs shown on a chart. Engine shapes (SweepResult, …) come from the engine.
 */
import type {BoxType, MaxCurvesResult, SweepDriver, SweepResult} from '../engine/index.js';
import type {FrequencyAxis, LevelAxis} from './axis.js';

/** One plotted line. Optional fields are set only by the series that need them. */
export interface Series {
  xs: number[];
  ys: number[];
  color: string;
  name: string;
  dash?: boolean;
  /** Per-point "Xmax is the limiting factor" flags — drives two-pass MaxSPL coloring. */
  xlim?: boolean[];
  /** Legend-only entry with no drawn line. */
  phantom?: boolean;
  /** This is the focused project's own trace, not a compare overlay — the legend and the
   *  line itself are drawn emphasized so it reads apart from the overlays around it. */
  current?: boolean;
}

/** A chart's full plot bundle. */
export interface PlotData {
  series: Series[];
  ymin: number;
  ymax: number;
  logy: boolean;
  unit: string;
  fmin?: number;
  fmax?: number;
  /** Frequency axis the series are drawn on. */
  freqAxis: FrequencyAxis;
  /** Level axis over `ymin … ymax`. */
  levelAxis: LevelAxis;
}

/**
 * The sweep-range/display fields a chart panel and the Options dialog actually read — the rest
 * of the engine's `SweepParams` (Vb, eg, losses, …) comes off the project itself
 * (`OpenISDProject.sweep()`/`maxCurves()`) and is never read back out through a `Design`.
 * `splXmaxLimited` chooses which SPL array to draw (`sw.splXlimCurve` vs `sw.spl`); `prXmax`
 * is the passive radiator's own excursion limit, used only by the Excursion chart's PR trace.
 * `portVelocityLimit_m_per_s` is the project's port air-velocity limit line; absent, none is drawn.
 */
export type PlotParams = {
  fmin: number;
  fmax: number;
  splXmaxLimited?: boolean;
  prXmax?: number;
  portVelocityLimit_m_per_s?: number;
};

/** A design shown on a chart — the current design plus any pinned comparisons. */
export interface Design {
  driver: SweepDriver | null;
  box: BoxType;
  P: PlotParams;
  curves: SweepResult | null;
  maxCurves: MaxCurvesResult | undefined;
  name?: string;
  color?: string;
  /** Trace visibility for compare overlays. Absent/true = shown; false = hidden from
   * the graph. Additive: a design without this field is always drawn. */
  visible?: boolean;
  project?: { name: string; creator?: string; created?: string; modified?: string; description?: string };
  ground?: string;
  isModified?: boolean;
  /** Position in the sidebar's project list — legend/draw order follows this, not "current first". */
  sortIndex?: number;
}
