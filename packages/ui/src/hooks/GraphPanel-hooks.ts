import type {InjectionKey, Ref} from 'vue';
import {computed, ref, watch} from 'vue';
import {allIssues, curvesData, driverName, maxData, openProjects, syncedP} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
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

  dismissWarnings(): void;
  /** The frequency axis as the sweep range sets it now — the starting point of an axis drag. */
  frequencyAxis(): FrequencyAxis;
  /** Ripple, peak and trough of this chart's trace between two frequencies; null with no trace. */
  rangeStats(fLo: number, fHi: number): RangeStats | null;
  /** The peak or trough of this chart's trace nearest `f` on one side; null when none. */
  snapFrequency(f: number | null, direction: SnapDirection, extremum: SnapExtremum): number | null;
  /** A click at `f`: on an unlocked chart it locks the cursor there; near the pinned point it
   *  unlocks it in place; elsewhere while locked it moves the cursor there, unlocked. */
  clickAt(f: number): void;
}

export const GraphPanelKey: InjectionKey<GraphPanelAPI> = Symbol('GraphPanelAPI');

/** `chartEngine`: the simulation and environment areas the curves read — the app facade's
 *  engine, handed in by the component rather than reached for here. */
export function useGraphPanel(props: GraphPanelProps, chartEngine: ChartEngineAreas): GraphPanelAPI {
  const project = useFocusedProject();
  const overlayDesigns = computed(() => props.overlays ?? []);

  const meta = computed(() => TAB_META[props.chartId]);

  const currentDesign = computed<Design>(() => ({
    driver: project.value.driver.specs.sweepDriver(),
    box: project.value.box.boxType.value,
    P: syncedP.value,
    curves: curvesData.value,
    maxCurves: maxData.value ?? undefined,
    // The compare-overlay legend prefixes each trace with its design's name (`series.ts`,
    // `buildPlotData`) — this project's own real name/driver, not the literal word "Current".
    name: project.value.name.value || driverName.value,
    color: props.primaryColor || DPAL[0],
    // Legend/draw order follows the sidebar's project list order, not "current first".
    sortIndex: openProjects().indexOf(project.value),
  }));

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

  function clickAt(f: number): void {
    const p = project.value;
    const wasLocked = p.cursorLocked.value;
    const pinnedF = p.pinnedF.value;
    if (wasLocked && pinnedF !== null && frequencyAxis().isNear(f, pinnedF)) {
      p.cursorLocked.set(false);
      return;
    }
    p.pinnedF.set(f);
    p.cursorF.set(f);
    p.cursorLocked.set(!wasLocked);
  }

  return {
    meta,
    currentDesign,
    plotData,
    blockErrors,
    blocked,
    warnings,
    warningsDismissed,
    dismissWarnings,
    frequencyAxis,
    rangeStats,
    snapFrequency: snapFrequencyOnTrace,
    clickAt,
  };
}
