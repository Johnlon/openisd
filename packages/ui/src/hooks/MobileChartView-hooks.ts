/**
 * `MobileChartView.vue`'s hook — the project's open charts (`ChartSelection`, shared with the
 * desktop skin), stacked one column wide with the chosen number to the screen, and the picker
 * that opens and closes them. Mobile only renders this destination once a project is open.
 */
import {computed, ref} from 'vue';
import {focusedProject, projectChanged} from '../logic/appState.js';
import {presentationState, traceColor} from '../logic/presentationState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {useCompareOverlays} from './compareOverlays.js';
import {ChartSelection} from './chartSelection.js';
import {CHARTS_HIGH_OPTIONS, MOBILE_CHARTS_HIGH} from './chartGrid.js';
import {offeredChartsHigh, useChartStack} from './chartStack.js';
import {selectedOption} from '../logic/domEvents.js';
import type {ChartId} from '@openisd/design/engine';

export function useMobileChartView() {
  const project = useFocusedProject();
  const { engine } = useApp();
  const selection = new ChartSelection(focusedProject, projectChanged, engine.box);
  const overlays = useCompareOverlays(engine.simulation, project);
  const { openCharts, chartItems, chartLabel } = selection;

  /** Whether the chart checklist is showing. */
  const pickerOpen = ref(false);
  function togglePicker(): void { pickerOpen.value = !pickerOpen.value; }
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

  const traceColour = computed(() => { void projectChanged.value; return traceColor(project.value); });

  return { openCharts, chartItems, chartLabel, pickerOpen, togglePicker, showOnly, toggle,
    chartsHigh, CHARTS_HIGH_OPTIONS, selectedOption, stackEl, stackStyle, traceColour, overlays };
}
