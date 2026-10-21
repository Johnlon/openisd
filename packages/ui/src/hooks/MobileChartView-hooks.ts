/**
 * `MobileChartView.vue`'s hook — the project's open charts (`ChartSelection`, shared with the
 * desktop skin), stacked one column wide with the chosen number to the screen, and the picker
 * that opens and closes them. Mobile only renders this destination once a project is open.
 */
import {computed, ref, watch} from 'vue';
import {useFeatureUse} from './telemetryContext.js';
import {traceColor} from '../logic/presentationState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {useCompareOverlays} from './compareOverlays.js';
import {ChartSelection} from './chartSelection.js';
import {CHARTS_HIGH_OPTIONS, MOBILE_CHARTS_HIGH} from './chartGrid.js';
import {offeredChartsHigh, useChartStack} from './chartStack.js';
import {selectedOption} from '../logic/domEvents.js';
import type {ChartId} from '@openisd/design/engine';
import {ChartPageHelp, ChartPageSizes, SheetMode} from '@openisd/design/fields';

/** One curve of the shared legend. */
export interface LegendItem {
  readonly name: string;
  readonly color: string;
}

export function useMobileChartView() {
  const {appState, presentation: presentationState} = useApp();
  const {focusedProject, projectChanged, driverName} = appState;
  const project = useFocusedProject();
  const { engine } = useApp();
  const selection = new ChartSelection(focusedProject, projectChanged, engine.box);
  const overlays = useCompareOverlays(engine.simulation, project, appState, presentationState);
  const { openCharts, chartItems, chartLabel } = selection;
  const featureUse = useFeatureUse();
  watch(openCharts, charts => { for (const c of charts) featureUse.chart(c); }, { immediate: true });

  /** Whether the chart checklist is showing. */
  const pickerOpen = ref(false);
  function togglePicker(): void { pickerOpen.value = !pickerOpen.value; }
  /** Tapping anywhere outside the list closes it (John, 13 Oct 2026). */
  function closePicker(): void { pickerOpen.value = false; }
  /** Tapping a chart's name shows it alone and closes the list. */
  function showOnly(id: ChartId): void { selection.showOnly(id); pickerOpen.value = false; }
  /** Ticking a chart's box opens or closes it and leaves the list open. */
  function toggle(id: ChartId): void { selection.toggle(id); }

  /** The charts to the screen's height; more scroll, a whole chart at a time. */
  const chartsHigh = computed<number>({
    get: () => offeredChartsHigh(presentationState.ui.mobileChartsHigh, MOBILE_CHARTS_HIGH),
    set: (v: number) => { presentationState.ui.mobileChartsHigh = v; },
  });
  const { el: stackEl, style: stackStyle } = useChartStack(computed(() => openCharts.value.length), chartsHigh, () => 1);

  /** Whether a bottom sheet (Tune or What-if, one at a time) is open. The chart's Auto Y box shows only then: without a
   *  sheet there is nothing to rescale for (John, 2026-10-05). */
  const tuneOpen = ref(false);
  const whatIfOpen = ref(false);
  const sheetOpen = computed(() => tuneOpen.value || whatIfOpen.value);

  const traceColour = computed(() => { void projectChanged.value; return traceColor(project.value); });

  /** One legend for every chart: the focused design, then each other open project drawn behind it. Listed only
   *  when there are two or more curves to tell apart. */
  const legendItems = computed<readonly LegendItem[]>(() => {
    void projectChanged.value;
    const own = {name: project.value.name.value || driverName.value, color: traceColour.value, sortIndex: appState.openProjects().indexOf(project.value)};
    const items = [own, ...overlays.value.filter(d => d.visible !== false).map(d => ({name: d.name ?? '', color: d.color ?? own.color, sortIndex: d.sortIndex ?? 0}))]
      .sort((a, b) => a.sortIndex - b.sortIndex);
    return items.length > 1 ? items.map(({name, color}) => ({name, color})) : [];
  });

  return { openCharts, legendItems, sizeVars: Object.fromEntries(ChartPageSizes.CLASSIC.cssVars()), helpFor: ChartPageHelp.forChart, chartItems, chartLabel, pickerOpen, togglePicker, closePicker, showOnly, toggle,
    chartsHigh, CHARTS_HIGH_OPTIONS, selectedOption, stackEl, stackStyle, traceColour, overlays, sheetOpen, tuneOpen, whatIfOpen,
    TUNE: SheetMode.TUNE, WHAT_IF: SheetMode.WHAT_IF };
}

