/**
 * The chart stack's measured grid: bind `el` to the stack element, apply `style` to it. Shared by
 * both skins; the desktop passes `chartColumnsFit`, the mobile one column.
 */
import {computed, ref, watch, type ComputedRef, type Ref} from 'vue';
import {chartGridLayout, chartGridStyle, CHARTS_HIGH_OPTIONS, type ChartGridStyle} from './chartGrid.js';

/** `stored` when it is still an offered number, else `fallback`. */
export function offeredChartsHigh(stored: number | undefined, fallback: number): number {
  return CHARTS_HIGH_OPTIONS.find(o => o.value === stored)?.value ?? fallback;
}

export function useChartStack(count: Ref<number>, high: Ref<number>, maxCols: (width: number) => number):
  { el: Ref<HTMLElement | null>; style: ComputedRef<ChartGridStyle> } {
  const el = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);
  watch(el, (e, _old, onCleanup) => {
    if (!e) return;
    const ro = new ResizeObserver(() => { width.value = e.clientWidth; height.value = e.clientHeight; });
    ro.observe(e);
    onCleanup(() => ro.disconnect());
  });
  const style = computed(() =>
    chartGridStyle(high.value, chartGridLayout(high.value, count.value, maxCols(width.value)), height.value));
  return { el, style };
}
