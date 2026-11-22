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

/** A measurement sink that applies a size on the next animation frame, never inside the
 *  observer's own callback, and only when the size changed: `style` sets the grid's row height
 *  from this height, so a synchronous write resizes the element being observed in the same frame
 *  and Chrome raises "ResizeObserver loop completed with undelivered notifications"
 *  (BUG_20261001_resize-observer-loop-fault-on-chart-grid). */
export function deferredMeasurement(width: Ref<number>, height: Ref<number>): (w: number, h: number) => void {
  return (w, h) => {
    if (w === width.value && h === height.value) return;
    requestAnimationFrame(() => { width.value = w; height.value = h; });
  };
}

export function useChartStack(count: Ref<number>, high: Ref<number>, maxCols: (width: number) => number):
  { el: Ref<HTMLElement | null>; style: ComputedRef<ChartGridStyle> } {
  const el = ref<HTMLElement | null>(null);
  const width = ref(0);
  const height = ref(0);
  watch(el, (e, _old, onCleanup) => {
    if (!e) return;
    const measured = deferredMeasurement(width, height);
    const ro = new ResizeObserver(() => measured(e.clientWidth, e.clientHeight));
    ro.observe(e);
    onCleanup(() => ro.disconnect());
  });
  const style = computed(() =>
    chartGridStyle(high.value, chartGridLayout(high.value, count.value, maxCols(width.value)), height.value));
  return { el, style };
}
