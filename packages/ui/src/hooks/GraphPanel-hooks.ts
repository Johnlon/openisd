import type {InjectionKey, Ref} from 'vue';
import {computed, ref, watch} from 'vue';
import {allIssues, curvesData, driverName, maxData, openProjects, syncedP} from '../logic/appState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {buildPlotData, DPAL, TAB_META} from '../logic/series.js';
import type {ChartTabId, Design, PlotData} from '../types.js';
import type {DriverError} from '@openisd/design/engine';

export interface GraphPanelProps {
  chartId: ChartTabId;
  bare?: boolean;
  primaryColor?: string;
  overlays?: Design[];
}

export interface GraphPanelAPI {
  readonly meta: Readonly<Ref<(typeof TAB_META)[ChartTabId]>>;
  readonly currentDesign: Readonly<Ref<Design>>;
  readonly plotData: Readonly<Ref<PlotData | null>>;
  readonly blockErrors: Readonly<Ref<DriverError[]>>;
  readonly blocked: Readonly<Ref<boolean>>;
  readonly warnings: Readonly<Ref<DriverError[]>>;
  readonly warningsDismissed: Readonly<Ref<boolean>>;

  dismissWarnings(): void;
}

export const GraphPanelKey: InjectionKey<GraphPanelAPI> = Symbol('GraphPanelAPI');

export function useGraphPanel(props: GraphPanelProps): GraphPanelAPI {
  const project = useFocusedProject();
  const overlayDesigns = computed(() => props.overlays ?? []);

  const meta = computed(() => TAB_META[props.chartId]);

  const currentDesign = computed<Design>(() => ({
    driver: project.value.driver.solverParams,
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

  return {
    meta,
    currentDesign,
    plotData,
    blockErrors,
    blocked,
    warnings,
    warningsDismissed,
    dismissWarnings,
  };
}

export function createMockGraphPanelAPI(overrides?: Partial<GraphPanelAPI>): GraphPanelAPI {
  const warningsDismissed = ref(false);
  const mockDesign: Design = {
    driver: null,
    box: 'vented',
    P: { fmin: 10, fmax: 1000 },
    curves: null,
    maxCurves: undefined,
    name: 'Current',
    color: '#000000',
  };

  return {
    meta: ref(TAB_META['SPL']),
    currentDesign: ref(mockDesign),
    plotData: ref(null),
    blockErrors: ref([]),
    blocked: ref(false),
    warnings: ref([]),
    warningsDismissed,
    dismissWarnings: () => {
      warningsDismissed.value = true;
    },
    ...overrides,
  };
}
