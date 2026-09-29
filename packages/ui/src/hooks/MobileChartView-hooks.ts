/**
 * `MobileChartView.vue`'s hook — the full-screen chart. Per John's ruling: the chart menu lists
 * exactly `project.charts` (the domain's own ordered, applicable-to-this-box list), no chart list
 * of its own — unlike the desktop toolbar, which also has a no-project fallback, mobile only ever
 * renders this destination once a project is open, so there's no `engine.box.chartsFor(...)` path to
 * cover here. Persists its OWN last-chosen chart (`mobileChartTab`/`mobileChartLabel`), independent
 * of the desktop's, the same way each skin remembers its own last-chosen chart.
 */
import {computed} from 'vue';
import {projectChanged} from '../logic/appState.js';
import {presentationState, traceColor} from '../logic/presentationState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {CHART_LABELS, parseChartId} from '../logic/series.js';
import {useApp} from '../logic/app.js';
import type {ChartId} from '@openisd/design/engine';

export interface MobileChartItem { label: string; tab: ChartId }

export function useMobileChartView() {
  const project = useFocusedProject();
  const { box } = useApp().engine;

  const CHART_ITEMS = computed<MobileChartItem[]>(() => {
    void projectChanged.value;
    return project.value.charts.map(tab => ({ tab, label: CHART_LABELS[tab] }));
  });

  const chartTab = computed<ChartId>({
    get: () => {
      const id = parseChartId(box, presentationState.ui.mobileChartTab);
      return CHART_ITEMS.value.some(i => i.tab === id) ? id : box.defaultChart;
    },
    set: (v: ChartId) => { presentationState.ui.mobileChartTab = v; },
  });
  const chartLabel = computed<string>({
    get: () => presentationState.ui.mobileChartLabel ?? CHART_LABELS[box.defaultChart],
    set: (v: string) => { presentationState.ui.mobileChartLabel = v; },
  });
  function selectChart(item: MobileChartItem): void {
    chartLabel.value = item.label;
    chartTab.value = item.tab;
  }

  const traceColour = computed(() => traceColor(project.value));

  return { chartTab, chartLabel, selectChart, traceColour, CHART_ITEMS };
}
