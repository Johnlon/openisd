/**
 * Shared UI types — the view-layer shapes (plot series, designs, canvas geometry).
 * Engine shapes (Driver, SweepResult, …) are imported from @openisd/engine.
 */
import type { Driver, DriverRaw, BoxType, SweepParams, SweepResult, MaxCurvesResult, Filter } from '@openisd/engine';
import type { DriverJSON } from '@openisd/winisd';

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

/** A design shown on a chart — the current design plus any pinned comparisons. */
export interface Design {
  driver: Driver | null;
  box: BoxType;
  P: SweepParams;
  curves: SweepResult | null;
  maxCurves: MaxCurvesResult | null;
  name?: string;
  color?: string;
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

/** A saved passive-radiator library entry. */
export interface PRLibEntry {
  id: number;
  name: string;
  prSd: number;
  prMmd: number;
  prCms: number;
  prRms: number;
  prXmax: number;
  savedAt: string;
}

/**
 * UI-side parameters held in the store. A superset of the engine's SweepParams:
 * it adds view-only inputs (ventD/ventL geometry, Pin drive power, prName/prMode)
 * and omits the derived fields (eg, Sp, Leff) that syncedP computes on the fly.
 */
export interface UiParams {
  Vb: number;
  Vf: number;
  ventD: number;
  ventL: number;
  Ql: number;
  Qa: number;
  Qp: number;
  nDrivers: number;
  wiring: 'series' | 'parallel';
  Pin: number;
  Rs: number;
  prName: string;
  prSd: number;
  prNum: number;
  prMmd: number;
  prMadd: number;
  prCms: number;
  prRms: number;
  prXmax: number;
  prMode: string;
  fmin: number;
  fmax: number;
  N: number;
  circuitModel: 'winisd' | 'gyrator';
  filters: Filter[];
}

/**
 * What syncedP produces: the full UiParams (so consumers can still read ventD/
 * ventL/Pin) plus the derived drive voltage eg and, for vented/bandpass, Sp/Leff.
 * Assignable to the engine's SweepParams (it has Vb + eg + the rest).
 */
export type SyncedParams = UiParams & { eg: number; Sp?: number; Leff?: number };

/** Per-chart Y-axis override; absent entry = auto-scale. */
export interface YRange { min: number; max: number }

/** The reactive application state held in the store. */
export interface AppState {
  box: BoxType;
  P: UiParams;
  graphs: string[];
  compare: Design[];
  editDriver: boolean;
  cursorF: number | null;
  pinnedF: number | null;
  cursorLocked: boolean;
  dragRange: DragRange | null;
  browseOpen: boolean;
  defineOpen: boolean;
  driverSource: DriverRaw | null;
  yRanges: Record<string, YRange>;
}

/** The persisted / URL-encoded snapshot shape (persist.ts). */
export interface SerializedState {
  v: number;
  // v≥2: the Driver's full state (entered marks + carried WDR fields + ParState), so
  // provenance and pass-through fields survive reload/share/save. v1 blobs carry a flat
  // DriverRaw here instead — handled on load (setDriverFromSerialized).
  driver: DriverJSON;
  box: BoxType;
  P: UiParams;
  graphs: string[];
  compare: Array<{ driver: Driver | null; box: BoxType; P: SweepParams; name?: string; color?: string }>;
}

export type { Driver, DriverRaw, DriverJSON, BoxType, SweepParams, SweepResult, MaxCurvesResult };
