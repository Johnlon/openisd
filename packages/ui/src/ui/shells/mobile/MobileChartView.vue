<script setup lang="ts">
// The mobile Graph destination — the project's open charts, one column. The header's "per screen"
// number sets how many share the screen's height; more scroll, snapping to whole charts.
// GraphPanel's canvas sets touch-action:none (custom pointer gestures); in a stack it is relaxed
// to pan-y, so a vertical swipe scrolls the list and a sideways drag still moves the cursor.
import GraphPanel from '../../components/GraphPanel.vue';
import { useMobileChartView } from '../../../hooks/MobileChartView-hooks.js';

const emit = defineEmits<{ menu: [] }>();
const { openCharts, chartItems, chartLabel, pickerOpen, togglePicker, showOnly, toggle,
  chartsHigh, CHARTS_HIGH_OPTIONS, selectedOption, stackEl, stackStyle, traceColour } = useMobileChartView();
</script>

<template>
  <div class="mob-chart-view">
    <div class="mob-chart-head">
      <button type="button" class="mob-chart-menu" title="Menu" aria-label="Menu" @click.stop="emit('menu')">
        <span></span><span></span><span></span>
      </button>
      <button class="mob-chart-pick" type="button" :aria-expanded="pickerOpen" @click="togglePicker">
        <span class="mob-chart-pick-label">{{ chartLabel }}</span>
        <span class="mob-chart-pick-caret">{{ pickerOpen ? '▴' : '▾' }}</span>
      </button>
      <label class="mob-chart-high" title="Charts per screen">
        <select :value="chartsHigh" aria-label="Charts per screen"
                @change="e => { const n = selectedOption(e, CHARTS_HIGH_OPTIONS); if (n !== null) chartsHigh = n; }">
          <option v-for="o in CHARTS_HIGH_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} / screen</option>
        </select>
      </label>
    </div>
    <ul v-if="pickerOpen" class="mob-chart-list">
      <li v-for="item in chartItems" :key="item.tab" class="mob-chart-row" :class="{ sep: item.sep }">
        <input type="checkbox" :checked="item.open" :aria-label="'Stack ' + item.label" @change="toggle(item.tab)">
        <button class="mob-chart-name" type="button" @click="showOnly(item.tab)">{{ item.label }}</button>
      </li>
    </ul>
    <div ref="stackEl" class="mob-chart-stack" :class="{ stacked: openCharts.length > 1 }" :style="stackStyle">
      <div v-for="id in openCharts" :key="id" class="mob-chart-cell">
        <GraphPanel :chart-id="id" :bare="true" :primary-color="traceColour" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mob-chart-view {
  display: flex;
  flex-direction: column;
  /* .mob-content (MobileShell.vue) is a real flex container with a JS-measured, hard-capped
     height, so flex:1 here fills it exactly — no independent viewport calc that could disagree
     with the parent's own (more robust) sizing. */
  flex: 1;
  min-height: 0;
  position: relative;
}
.mob-chart-head {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.mob-chart-menu {
  flex: none;
  width: 44px;
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.mob-chart-menu span { display: block; width: 20px; height: 2px; background: var(--fg); border-radius: 1px; }
.mob-chart-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
  text-align: left;
}
.mob-chart-high select {
  height: 100%;
  min-height: 44px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
}
.mob-chart-pick-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The checklist drops over the charts rather than pushing them down. */
.mob-chart-list {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 60px;
  z-index: 5;
  max-height: 70%;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.mob-chart-row { display: flex; align-items: center; gap: 4px; padding: 0 8px; }
.mob-chart-row.sep { border-top: 1px solid var(--line); }
.mob-chart-row input { width: 22px; height: 22px; margin: 11px; flex: none; }
.mob-chart-name {
  flex: 1;
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
  text-align: left;
}
/* One-column grid; the rows come from stackStyle (chartGrid.ts). Overflow snaps to whole charts. */
.mob-chart-stack { flex: 1; min-height: 0; display: grid; overflow-y: auto; scroll-snap-type: y mandatory; }
.mob-chart-cell { display: flex; flex-direction: column; min-height: 0; scroll-snap-align: start; }
.mob-chart-cell + .mob-chart-cell { border-top: 1px solid var(--line); }
/* GraphPanel's own .gpanel defaults to a 160px min-height (style.css) sized for a small tile;
   here it fills its cell. */
.mob-chart-cell :deep(.gpanel) { flex: 1; min-height: 0; border: none; border-radius: 0; }
.mob-chart-stack.stacked :deep(canvas) { touch-action: pan-y; }
</style>
