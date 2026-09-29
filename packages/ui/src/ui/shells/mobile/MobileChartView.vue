<script setup lang="ts">
// The mobile Graph destination — a full-screen chart. Its own screen, not inline in a scrolling
// tab: GraphPanel's canvas sets touch-action:none (custom pointer pan/zoom), which would trap
// vertical scroll if it sat in a form column instead of owning the whole viewport.
import GraphPanel from '../../components/GraphPanel.vue';
import { useMobileChartView } from '../../../hooks/MobileChartView-hooks.js';

const { chartTab, chartLabel, selectChart, traceColour, CHART_ITEMS } = useMobileChartView();
</script>

<template>
  <div class="mob-chart-view">
    <div class="mob-chart-head">
      <select
        class="mob-chart-select"
        :value="chartLabel"
        @change="e => { const item = CHART_ITEMS.find(i => i.label === (e.target as HTMLSelectElement).value); if (item) selectChart(item); }"
      >
        <template v-for="item in CHART_ITEMS" :key="item.label">
          <option :value="item.label">{{ item.label }}</option>
        </template>
      </select>
    </div>
    <div class="mob-chart-body">
      <GraphPanel :chart-id="chartTab" :bare="true" :primary-color="traceColour" />
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
}
.mob-chart-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.mob-chart-select {
  width: 50%;
  min-width: 160px;
  min-height: 44px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
}
/* display:flex here (not just flex:1) so the child's own flex:1 below has an explicit flex
   container to resolve against — a block child's height:100% would not reliably fill a plain
   flex ITEM's implicit height. */
.mob-chart-body { flex: 1; display: flex; flex-direction: column; position: relative; }
/* GraphPanel's own .gpanel defaults to a 160px min-height (style.css) sized for a small tile
   in the desktop chart grid — here it's the only thing on screen, so make it fill the pane,
   the same way OriginalShell.vue's own full-screen .graph-wrap does. */
.mob-chart-body :deep(.gpanel) { flex: 1; min-height: 0; border: none; border-radius: 0; }
</style>
