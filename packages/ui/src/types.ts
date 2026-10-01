/**
 * Shared UI types — the view-layer shapes (plot series, designs, canvas geometry).
 * Engine shapes (Driver, SweepResult, …) are imported from @openisd/design/engine.
 */
import type {BoxType, MaxCurvesResult, SweepDriver, SweepResult} from '@openisd/design/engine';

/**
 * `ChartId` (`@openisd/design`'s `Engine.chartsFor`, bugs/BUG_20260927_winisd-charts-missing.md)
 * is the closed set of chart curves the engine can draw, and which apply to a given box type —
 * a design decision, not a UI one.
 *
 * Every member MUST appear in `TAB_META` and in `CURVE_BUILDERS` in `logic/series.ts` — both
 * are `Record<ChartId, …>`, so declaring a member without implementing it is a COMPILE
 * ERROR, not a chart that silently draws nothing. Design adding a curve is therefore: fix the
 * two build errors here with its name/colour/unit and its series builder.
 *
 * `parseChartId()` in `logic/series.ts` is the one string→member boundary; persisted and
 * shared blobs carry plain strings and go through it.
 */

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
  f0: number;
  f1: number;
}

/** Per-chart Y-axis override; absent entry = auto-scale. */
export interface YRange { min: number; max: number }
