/**
 * Shared UI types — the view-layer shapes (plot series, designs, canvas geometry).
 * Engine shapes (Driver, SweepResult, …) are imported from @openisd/engine.
 */
import type { Driver, DriverRaw, BoxType, SweepParams, SweepResult, MaxCurvesResult, Filter } from '@openisd/engine';
import type { OpenISDDriver } from '@openisd/model';

/** The openisd.yml record shape — what `OpenISDDriver.toRecord()` hands back. */
export type DriverJSON = ReturnType<OpenISDDriver['toRecord']>;

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
  driver: Driver | null;
  box: BoxType;
  P: PlotParams;
  curves: SweepResult | null;
  maxCurves: MaxCurvesResult | null;
  name?: string;
  color?: string;
  /** Trace visibility for compare overlays. Absent/true = shown; false = hidden from
   * the graph. Additive: a design without this field is always drawn. */
  visible?: boolean;
  project?: { name: string; creator?: string; created?: string; modified?: string; description?: string };
  _ground?: string;
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
 * A bundled passive radiator (from a driver collection's openisd.yml). PRs
 * have no WDR — WinISD doesn't model them — so they are bundled separately and
 * shown only in the Browse-PR popup. Manufacturers publish only Sd/Cms/Vas/weight
 * for a PR; Fs/Mms/Rms/Xmax are typically absent (null), never fabricated.
 */
export interface BundledPR {
  key: string;
  sourceName: string;
  path: string;
  name: string;
  brand: string;
  model: string;
  Sd: number | null;
  Cms: number | null;
  Vas: number | null;
  weightKg: number | null;
  datasheet: string;
  manu_page_url: string;
}

/**
 * UI-side parameters held in the store. A superset of the engine's SweepParams:
 * it adds view-only inputs (ventD/ventL geometry, Pin drive power, prName/prMode)
 * and omits the derived fields (eg, Sp, Leff) that syncedP computes on the fly.
 */
export interface UiParams {
  Vb: number;
  Vf: number;
  ventShape: 'round' | 'slotted';
  ventD: number;
  ventW: number;
  ventH: number;
  ventL: number;
  /** Box tuning. Tied to Vb/ventD/ventL by one Helmholtz relation — see `entered`. */
  Fb: number;
  /** Rear chamber tuning frequency (e.g. for bandpass6) */
  Frc?: number;
  /**
   * Passive-radiator system tuning (WinISD: Fp). Tied to `prMadd` by one relation — the PR's
   * intrinsic Mmd/Cms/Sd plus Vb are given, and added mass is what moves the tuning. Enter a
   * target tuning and the mass is solved; enter a mass and the tuning is. See `entered`.
   */
  prFp: number;
  /**
   * Which box/vent fields the user ENTERED. Presence ⇒ Entered: the value is held and never
   * recomputed. Absence ⇒ Calculated, re-solved whenever an entered member changes.
   *
   * Same model as the driver's provenance (`Driver.#inputs`, docs/DRIVER_ADT_DESIGN.md) and
   * the same reason: docs/design/STATE_MODEL.md rule 7 — provenance is recorded where entry happens,
   * never reconstructed downstream from "is the field present".
   *
   * `Fb` and `ventL` are the pair this arbitrates, and BOTH stay fields.
   *
   * **WinISD's direction is the default and is what ships**: `{Vb, ventD, Fb}` entered, vent
   * length calculated — change the diameter and the LENGTH moves while the tuning holds.
   * WinISD itself offers no way to reverse that; its Vents tab renders length, cross area and
   * port resonance greyed/calculated, with only vent count and diameter editable (confirmed
   * live against 0.7.0.950).
   *
   * The reverse — enter `ventL`, let the tuning be solved — falls out of the entered-set
   * model rather than being copied from WinISD. It costs nothing to allow, and it is the
   * foundation the "pin any subset and solve the rest" vent solver builds on (BACKLOG P2).
   * Storing one member and deriving the other would have baked one direction into the schema
   * and made that later work a rewrite.
   *
   * Solved by `composables/useVentGroup.ts`.
   */
  entered: Record<string, true>;
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
  // WinISD-parity driver inputs (docs/research/WINISD_PARITY.md). SI/engine units: vcTempRise K, alfaVC /K
  // (UI shows 1000/K), driverAddedMass kg (UI shows g). All 0-safe: no-op at the default.
  vcTempRise: number;
  alfaVC: number;
  driverAddedMass: number;
  // Port end-correction coefficient (× vent diameter): 0.613 two-free / 0.732 one-flanged
  // (default) / 0.849 two-flanged. Feeds Leff → box tuning Fb.
  endCorrection: number;
  // ---- WinISD Advanced-pane simulation options (PLAN_ADVANCED_SIM_OPTIONS.md) ----------
  // The fifth WinISD toggle, "Simulate voice coil inductance", is NOT a field of its own:
  // it is `circuitModel` under WinISD's wording (store.simVcInductance is the alias).
  /** Rg sits in series with each driver (true, historic) rather than at the amplifier. */
  rgAtDriverSide: boolean;
  /** Model the vent as an acoustic transmission line instead of a lumped mass. */
  tlPortModel: boolean;
  /** Auto-EQ the response flat, charging the boost to excursion/velocity/max-SPL. */
  forceFlatResponse: boolean;
  /** Plot the SPL chart backed off to Xmax (engine `splXlim`) instead of the raw SPL. */
  splXmaxLimited: boolean;
  // ---- Environment — per project, as WinISD's .wpr [Box] T / p / phi ------------------
  /** Ambient temperature, K. */
  tempK?: number;
  /** Relative humidity, PERCENT. The .wpr's `phi` is a FRACTION — converted in that writer only. */
  humidityPct?: number;
  /** Static air pressure, Pa. */
  pressurePa?: number;
  /**
   * Opt in to WinISD's behaviour of ignoring humidity and air pressure (ledger QO7).
   * Default false — openisd derives ρ and c from T, RH and p, and thence the SPL constant K.
   */
  ignoreHumidityAndPressure?: boolean;
}

/**
 * What syncedP produces: the full UiParams (so consumers can still read ventD/
 * ventL/Pin) plus the derived drive voltage eg and, for vented/bandpass, Sp/Leff.
 * Assignable to the engine's SweepParams (it has Vb + eg + the rest).
 */
export type SyncedParams = UiParams & { eg: number; Sp?: number; Leff?: number };

/** Per-chart Y-axis override; absent entry = auto-scale. */
export interface YRange { min: number; max: number }

/** UI-only preferences (not part of a design). Local to the device — never shared. */
export interface UiState {
  /** The selected Project tab rail entry (persists across reload). */
  originalProjectTab?: string;
  /** The selected chart type (persists across reload). */
  originalChartTab?: string;
  /** The chosen chart menu label (may name an engine-unavailable chart). */
  originalChartLabel?: string;
  /** A Tune (what-if) panel is open. Persisted so a refresh reopens it. */
  originalTuneOpen?: boolean;
  /** The open Tune's uncommitted what-if buffer (overlay), so a refresh
   *  restores the in-progress values. Local-only (stripped from share links via stateToUrl). */
  /** The Driver Editor modal is open. Persisted so a refresh reopens it. */
  originalEditorOpen?: boolean;
  /** Left panel width in px (splitter-dragged). Local-only layout pref
   *  (device/screen-specific): persisted across refresh, stripped from share links. */
  originalNavW?: number;
  /** Bottom section height in px (splitter-dragged). Local-only layout pref. */
  originalBottomH?: number;
  /** The left panel (Projects / Signal Generator) is collapsed. Local-only. */
  originalNavCollapsed?: boolean;
  /** The bottom section (tab rail + content) is collapsed. Local-only. */
  originalBottomCollapsed?: boolean;
  /** The chart is maximised over the whole main area (toolbar stays). Local-only. */
  originalChartMax?: boolean;
  /** Per-field selected display-unit token (keyed by field id; see fields/units.ts). The store
   *  always holds SI — this only picks how a field is shown/entered. Absent field ⇒ its base
   *  unit. Local-only presentation preference: persisted across refresh, stripped from share
   *  links (a recipient keeps their own unit-display preference). */
  unitTokens?: Record<string, string>;
  /** Options dialog → General tab "Username" field (WinISD parity). Local-only identity
   *  preference — persisted across refresh, stripped from share links. */
  username?: string;
  /** Options dialog → General tab "Environment" group (WinISD parity: Temperature/Air
   *  pressure/Relative humidity — Sound velocity is derived, not stored). These are
   *  APP-LEVEL defaults, distinct from a project's own Advanced-pane values: they only seed
   *  a shell's Advanced-pane refs on mount (replacing what used to be a hardcoded literal),
   *  they never overwrite an already-open project. Local-only, stripped from share links. */
  envDefaults: { tempK: number; pressurePa: number; humidityPct: number };
  /** Options dialog → Plot Window tab "Colors" group (WinISD parity, partial — see
   *  OptionsModal.vue header comment for which of WinISD's 6 swatches have a real OpenISD
   *  hook). Absent key = the app's own default (CSS custom property / hardcoded constant).
   *  Local-only presentation preference, stripped from share links. */
  chartColors?: Partial<Record<'background' | 'otherLines' | 'labels' | 'xmaxLimit' | 'cursor', string>>;
}

/** The reactive application state held in the store. */
export interface AppState {
  box: BoxType;
  /** Sealed-box loss model — a LossMode wire value (@openisd/engine). Default winisd-lossy. */
  lossMode: string;
  P: UiParams;
  graphs: ChartTabId[];
  editDriver: boolean;
  /** Driver EDIT pane (Brand/Model/Comment/Provided by) — distinct from editDriver (What-If T/S tweaking). */
  editDriverInfo: boolean;
  cursorF: number | null;
  pinnedF: number | null;
  cursorLocked: boolean;
  dragRange: DragRange | null;
  browseOpen: boolean;
  defineOpen: boolean;
  yRanges: Record<string, YRange>;
  ui: UiState;
  /** Project-level metadata — WinISD Project tab (Creator/Created/Modified/Description). */
  project: ProjectMeta;
}

export interface ProjectMeta {
  name: string;
  creator: string;
  created: string;
  modified: string;
  description: string;
}

/** The persisted / URL-encoded snapshot shape (persist.ts). */
export interface SerializedState {
  v: number;
  // The driver record — provenance and every stated field, so they survive reload, share and
  // save. OPTIONAL: a design with no driver chosen yet is a real state, and writing a fake one
  // to fill the slot would be indistinguishable on reload from a driver the user picked.
  driver?: DriverJSON;
  box: BoxType;
  lossMode?: string;
  P: UiParams;
  graphs: string[];
  // A local save carries the full ui; stateToUrl() carries most of it too (active
  // tab/chart), stripping only personal working state (open-editor buffer, unit prefs) —
  // see persist.ts.
  ui?: UiState;
  project?: ProjectMeta;
  // Graph cursor/marker — carried by BOTH a local save (refresh fidelity) and a share link,
  // same as tab/chart: the live hover cursor (f, transient — usually null unless a share was
  // taken mid-hover), the locked/pinned marker (pinnedF + locked), and the dragged frequency
  // band selection (range — fLo/fHi only; each panel recomputes its own stats). Optional so an
  // old v2 blob (saved/shared before this field existed) still parses — absent reads as "no
  // marker"; range likewise optional within it.
  cursor?: { f: number | null; pinnedF: number | null; locked: boolean; range?: { fLo: number; fHi: number } | null };
}

export type { Driver, DriverRaw, BoxType, SweepParams, SweepResult, MaxCurvesResult };
