import type {InjectionKey, Ref} from 'vue';
import {computed, ref, watch} from 'vue';
import {allIssues, curvesData, driverName, maxData, openProjects, syncedP} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {presentationState} from '../logic/presentationState.js';
import {isTraceVisible, traceVisibilityRevision} from '../logic/traceVisibility.js';
import {
  buildPlotData, type ChartEngineAreas, type Design, DPAL, FrequencyAxis, type PlotData, rangeStatsOf, type RangeStats,
  type SnapDirection, type SnapExtremum, snapFrequency, TAB_META,
} from '@openisd/design/chart';
import type {ChartId, DriverError} from '@openisd/design/engine';

export interface GraphPanelProps {
  chartId: ChartId;
  bare?: boolean;
  primaryColor?: string;
  overlays?: Design[];
}

export interface GraphPanelAPI {
  readonly meta: Readonly<Ref<(typeof TAB_META)[ChartId]>>;
  readonly currentDesign: Readonly<Ref<Design>>;
  readonly plotData: Readonly<Ref<PlotData | null>>;
  readonly blockErrors: Readonly<Ref<DriverError[]>>;
  readonly blocked: Readonly<Ref<boolean>>;
  readonly warnings: Readonly<Ref<DriverError[]>>;
  readonly warningsDismissed: Readonly<Ref<boolean>>;
  /** The plot as drawn: `plotData` with this chart's Y-axis override applied, when it has one. */
  readonly viewPlot: Readonly<Ref<PlotData | null>>;
  /** True while this chart has no Y-axis override, so its Y axis fits the data. */
  readonly autoY: Readonly<Ref<boolean>>;
  /** The drawn Y range as axis labels, `min to max`; empty with no plot. */
  readonly yRangeLabel: Readonly<Ref<string>>;

  dismissWarnings(): void;
  /** Off stores the Y range drawn now as this chart's override, so later data changes never
   *  rescale it; on removes the override. */
  setAutoY(on: boolean): void;
  /** The frequency axis as the sweep range sets it now — the starting point of an axis drag. */
  frequencyAxis(): FrequencyAxis;
  /** Ripple, peak and trough of this chart's trace between two frequencies; null with no trace. */
  rangeStats(fLo: number, fHi: number): RangeStats | null;
  /** A click on the chart at `f`: locks the cursor there; while locked, a click near the pinned
   *  point unlocks it, and a click elsewhere moves the cursor there unlocked. */
  clickCursorAt(f: number): void;
  /** The peak or trough of this chart's trace nearest `f` on one side; null when none. */
  snapFrequency(f: number | null, direction: SnapDirection, extremum: SnapExtremum): number | null;
}

export const GraphPanelKey: InjectionKey<GraphPanelAPI> = Symbol('GraphPanelAPI');

/** `chartEngine`: the simulation and environment areas the curves read — the app facade's
 *  engine, handed in by the component rather than reached for here. */
export function useGraphPanel(props: GraphPanelProps, chartEngine: ChartEngineAreas): GraphPanelAPI {
  const project = useFocusedProject();
  const overlayDesigns = computed(() => props.overlays ?? []);

  const meta = computed(() => TAB_META[props.chartId]);

  const currentDesign = computed<Design>(() => {
    void traceVisibilityRevision.value;   // a show/hide toggle recomputes the design (`traceVisibility.ts`)
    return {
    driver: project.value.driver.specs.sweepDriver(),
    box: project.value.box.boxType.value,
    P: syncedP.value,
    curves: curvesData.value,
    maxCurves: maxData.value ?? undefined,
    // The compare-overlay legend prefixes each trace with its design's name (`series.ts`,
    // `buildPlotData`) — this project's own real name/driver, not the literal word "Current".
    name: project.value.name.value || driverName.value,
    color: props.primaryColor || DPAL[0],
    visible: isTraceVisible(project.value),
    // Legend/draw order follows the sidebar's project list order, not "current first".
    sortIndex: openProjects().indexOf(project.value),
    };
  });

  const plot = computed(() =>
    buildPlotData(
      chartEngine,
      props.chartId,
      syncedP.value.fmin,
      syncedP.value.fmax,
      currentDesign.value,
      overlayDesigns.value,
      allIssues.value,
      { bare: props.bare, primaryColor: props.primaryColor }
    )
  );

  const plotData = computed(() => plot.value.value);
  const blockErrors = computed(() => plot.value.errors.filter(e => e.level === 'error'));
  const blocked = computed(() => blockErrors.value.length > 0);
  const warnings = computed(() =>
    blocked.value ? [] : plot.value.errors.filter(e => e.level === 'warn')
  );

  const warningsDismissed = ref(false);
  watch(warnings, () => { warningsDismissed.value = false; });

  function dismissWarnings() {
    warningsDismissed.value = true;
  }

  const yOverride = computed(() => presentationState.yRanges[props.chartId] ?? null);
  const viewPlot = computed<PlotData | null>(() => {
    const p = plotData.value;
    const ov = yOverride.value;
    const axis = p && ov ? p.levelAxis.overridden(ov.min, ov.max) : null;
    return p && axis ? {...p, ymin: axis.min, ymax: axis.max, levelAxis: axis} : p;
  });
  const autoY = computed(() => yOverride.value === null);
  const yRangeLabel = computed(() => {
    const axis = viewPlot.value?.levelAxis;
    return axis ? `${axis.tickLabel(axis.min)} to ${axis.tickLabel(axis.max)}` : '';
  });

  function setAutoY(on: boolean): void {
    if (on) { delete presentationState.yRanges[props.chartId]; return; }
    const axis = viewPlot.value?.levelAxis;
    if (axis) presentationState.yRanges[props.chartId] = {min: axis.min, max: axis.max};
  }

  function frequencyAxis(): FrequencyAxis {
    return new FrequencyAxis(syncedP.value.fmin, syncedP.value.fmax);
  }

  function rangeStats(fLo: number, fHi: number): RangeStats | null {
    const s = plotData.value?.series.find(x => !x.dash && !x.phantom);
    return s ? rangeStatsOf(s, fLo, fHi) : null;
  }

  function snapFrequencyOnTrace(f: number | null, direction: SnapDirection, extremum: SnapExtremum): number | null {
    const s = plotData.value?.series.find(x => !x.dash);
    return s ? snapFrequency(s.xs, s.ys, f, direction, extremum) : null;
  }

  function clickCursorAt(f: number): void {
    const p = project.value;
    const pinnedF = p.pinnedF.value;
    if (p.cursorLocked.value && pinnedF !== null && frequencyAxis().isNear(f, pinnedF)) {
      p.cursorLocked.set(false);
    } else if (p.cursorLocked.value) {
      p.pinnedF.set(f);
      p.cursorF.set(f);
      p.cursorLocked.set(false);
    } else {
      p.pinnedF.set(f);
      p.cursorF.set(f);
      p.cursorLocked.set(true);
    }
  }

  return {
    meta,
    currentDesign,
    plotData,
    blockErrors,
    blocked,
    warnings,
    warningsDismissed,
    viewPlot,
    autoY,
    yRangeLabel,
    dismissWarnings,
    setAutoY,
    frequencyAxis,
    clickCursorAt,
    rangeStats,
    snapFrequency: snapFrequencyOnTrace,
  };
}
