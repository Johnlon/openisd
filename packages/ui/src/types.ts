/**
 * Shared UI types — the view-layer shapes (plot series, designs, canvas geometry).
 * Engine shapes (Driver, SweepResult, …) are imported from @openisd/design/engine.
 */
import type { EngineDriver, BoxType, SweepParams, SweepResult, MaxCurvesResult } from '@openisd/design/engine';
import type { UiParams, OpenISDProjectMeta } from '@openisd/model';

/**
 * The closed set of chart curves the engine can draw. Every member MUST appear in
 * `TAB_META` and in `CURVE_BUILDERS` in `utils/series.ts` — both are
 * `Record<ChartTabId, …>`, so declaring a member without implementing it is a COMPILE
 * ERROR, not a chart that silently draws nothing. Adding a curve is therefore: add the
 * member here, then fix the two build errors.
 *
 * `parseChartTabId()` in `utils/series.ts` is the one string→member boundary; persisted
 * and shared blobs carry plain strings and go through it.
 *
 * The `Flt*` members are the filter chain's own response (WinISD's "(EQ/Filter)" charts);
 * every other member is a property of the driver+box system.
 */
export type ChartTabId =
  | 'SPL' | 'TFMag' | 'Excursion' | 'Port' | 'GD' | 'Zmag' | 'Zph' | 'Phase'
  | 'MaxSPL' | 'MaxPwr' | 'FltMag' | 'FltPhase' | 'FltGD';

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
 * Sweep parameters plus the DISPLAY-only flags the plot builder reads. `splXmaxLimited`
 * chooses which SPL array to draw (`sw.splXlim` vs `sw.spl`) — it changes nothing the
 * engine computes, so it stays out of the engine's SweepParams.
 */
export type PlotParams = SweepParams & { splXmaxLimited?: boolean };

/** A design shown on a chart — the current design plus any pinned comparisons. */
export interface Design {
  driver: EngineDriver | null;
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

/**
 * What syncedP produces: the full UiParams (so consumers can still read ventD/
 * ventL/Pin) plus the derived drive voltage eg and, for vented/bandpass, Sp/Leff.
 * Assignable to the engine's SweepParams (it has Vb + eg + the rest).
 */
export type SyncedParams = UiParams & { eg: number; Sp?: number; Leff?: number };

/** Per-chart Y-axis override; absent entry = auto-scale. */
export interface YRange { min: number; max: number }

/**
 * The reactive application state held in the store — PERSISTENT DESIGN state only. View state
 * (dialog flags, chart cursor/selection, display prefs) lives in `logic/presentationState.ts`'s
 * `PresentationState` instead (ARCHITECTURE.md §"Approved state stores").
 */
export interface AppState {
  box: BoxType;
  /** Project-level metadata — WinISD Project tab (Creator/Created/Modified/Description). */
  project: OpenISDProjectMeta;
}

export class AppStateImpl implements AppState {
  constructor(boxType: BoxType, project: OpenISDProjectMeta) {
    this.box = boxType;
    this.project = project;
  }

  readonly box: BoxType;
  /** Project-level metadata — WinISD Project tab (Creator/Created/Modified/Description). */
  readonly project: OpenISDProjectMeta;
}
