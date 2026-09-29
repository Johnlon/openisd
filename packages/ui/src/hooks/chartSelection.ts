/**
 * The chart menu and the stacked charts it opens, shared by every shell: the focused project's
 * own `openCharts`. With no project open the menu lists the engine's default box's charts and
 * the stack is the default chart.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {BoxEngine, ChartId} from '@openisd/design/engine';
import {CHART_LABELS} from '../logic/series.js';

// A separator goes before the first item of each of WinISD's own visual groupings — never
// before a group that this box has nothing in (Port/PR are absent from most boxes).
const CHART_GROUP_START: ReadonlySet<ChartId> = new Set<ChartId>(['Excursion', 'PRTFMag', 'RearPort', 'FrontPort', 'FltMag']);

export interface ChartItem {
  readonly label: string;
  readonly tab: ChartId;
  readonly sep: boolean;
  readonly open: boolean;
}

export interface ChartSelectionAPI {
  /** The stacked charts, top first. Never empty. */
  readonly openCharts: ComputedRef<readonly ChartId[]>;
  /** Every chart this box shows, in WinISD's menu order, each marked open or not. */
  readonly chartItems: ComputedRef<readonly ChartItem[]>;
  /** The open charts' captions, comma-separated. */
  readonly chartLabel: ComputedRef<string>;
  /** Shows `id` alone. No-op with no project open. */
  showOnly(id: ChartId): void;
  /** Opens `id` if closed, closes it if open; the last open chart stays. No-op with no project open. */
  toggle(id: ChartId): void;
}

export class ChartSelection implements ChartSelectionAPI {
  readonly openCharts: ComputedRef<readonly ChartId[]>;
  readonly chartItems: ComputedRef<readonly ChartItem[]>;
  readonly chartLabel: ComputedRef<string>;
  readonly #focusedProject: () => OpenISDProject | null;

  constructor(focusedProject: () => OpenISDProject | null, projectChanged: Ref<number>, box: BoxEngine) {
    this.#focusedProject = focusedProject;
    this.openCharts = computed(() => {
      void projectChanged.value;
      return focusedProject()?.openCharts.value ?? [box.defaultChart];
    });
    // The design's own answer for which charts apply to THIS project's box — never a second,
    // UI-maintained list of "which charts apply" (bugs/BUG_20260927_winisd-charts-missing.md).
    this.chartItems = computed(() => {
      void projectChanged.value;
      const ids = focusedProject()?.charts ?? box.chartsFor(box.defaultBoxType);
      const open = this.openCharts.value;
      return ids.map(tab => ({ tab, label: CHART_LABELS[tab], sep: CHART_GROUP_START.has(tab), open: open.includes(tab) }));
    });
    this.chartLabel = computed(() => this.openCharts.value.map(c => CHART_LABELS[c]).join(', '));
  }

  showOnly(id: ChartId): void { this.#focusedProject()?.openCharts.showOnly(id); }

  toggle(id: ChartId): void { this.#focusedProject()?.openCharts.toggle(id); }
}
