<script setup lang="ts">
// The mobile Graph destination — the project's open charts, one column. The header's "per screen"
// number sets how many share the screen's height; more scroll, snapping to whole charts.
// GraphPanel's canvas sets touch-action:none (custom pointer gestures); in a stack it is relaxed
// to pan-y, so a vertical swipe scrolls the list and a sideways drag still moves the cursor.
import GraphPanel from '../../components/GraphPanel.vue';
import MobileSaveButton from './MobileSaveButton.vue';
import PhoneBand from './PhoneBand.vue';
import MobileSheet from './MobileSheet.vue';
import { useMobileChartView } from '../../../hooks/MobileChartView-hooks.js';

const emit = defineEmits<{ menu: [] }>();
const { legendItems, sizeVars, helpFor, openCharts, chartItems, chartLabel, pickerOpen, togglePicker, closePicker, showOnly, toggle,
  chartsHigh, CHARTS_HIGH_OPTIONS, selectedOption, stackEl, stackStyle, traceColour, overlays, sheetOpen, tuneOpen, whatIfOpen, autoY, setAutoY, collectChart, TUNE, WHAT_IF } = useMobileChartView();
</script>

<template>
  <div class="mob-chart-view mob-classic" :class="{ 'mob-chart-view-legend': legendItems.length > 0 }" :style="sizeVars">
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
      <MobileSaveButton />
    </div>
    <div v-if="legendItems.length > 0" class="mob-chart-legend" aria-label="Curves">
      <span v-for="item in legendItems" :key="item.name" class="mob-chart-legend-item" :style="{ color: item.color }">
        <svg width="14" height="8" aria-hidden="true"><line x1="0" x2="14" y1="4" y2="4" :stroke="item.color" stroke-width="2.5" /></svg>{{ item.name }}
      </span>
    </div>
    <div v-if="pickerOpen" class="mob-chart-backdrop" @click="closePicker"></div>
    <ul v-if="pickerOpen" class="mob-chart-list">
      <li v-for="item in chartItems" :key="item.tab" class="mob-chart-row" :class="{ sep: item.sep }">
        <input type="checkbox" :checked="item.open" :aria-label="'Stack ' + item.label" @change="toggle(item.tab)">
        <button class="mob-chart-name" type="button" @click="showOnly(item.tab)">{{ item.label }}</button>
      </li>
    </ul>
    <div ref="stackEl" class="mob-chart-stack" :class="{ stacked: openCharts.length > 1 }" :style="stackStyle">
      <div v-for="id in openCharts" :key="id" class="mob-chart-cell">
        <!-- Auto Y is in the sheet footer (QO267 mock), not over the chart. -->
        <GraphPanel :ref="el => collectChart(id, el)" :chart-id="id" :bare="true" :classic="true" :primary-color="traceColour" :overlays="overlays" :hide-auto-y="true">
          <template #band="{ title, hasData, openData }">
            <PhoneBand :title="title" :section="helpFor(title) ?? undefined">
              <button v-if="hasData" type="button" class="mob-chart-data" title="Show this chart's data as a table, to copy or download as CSV" @click="openData"><span class="mob-chart-data-chip">Data</span></button>
            </PhoneBand>
          </template>
        </GraphPanel>
      </div>
    </div>
    <!-- Two separate sheets, each from its own pull-tab, side by side when both are closed. -->
    <div class="mob-sheet-dock" :class="{ 'mob-sheet-dock-closed': !sheetOpen }">
      <MobileSheet v-model:open="tuneOpen" :mode="TUNE" :hidden="whatIfOpen" :auto-y="autoY" @update:auto-y="setAutoY" />
      <MobileSheet v-model:open="whatIfOpen" :mode="WHAT_IF" :hidden="tuneOpen" :auto-y="autoY" @update:auto-y="setAutoY" />
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
  /* The Saved popup hangs below the chart band (and the legend, when shown), over the chart's empty
     top-right corner, not over the band's ? (MobileSaveButton.vue). The 7 px is the legend's padding and rule. */
  --mob-save-note-drop: calc(var(--gp-head-pad-y) + var(--gp-band));
}
.mob-chart-view-legend { --mob-save-note-drop: calc(var(--gp-head-pad-y) + var(--gp-band) + var(--gp-legend-line) + 7px); }
.mob-sheet-dock { flex: 0 1 auto; display: flex; min-height: 0; }
/* Both sheets closed: the Tune and What-if buttons, side by side (sizes from ChartPageSizes). */
.mob-sheet-dock-closed {
  box-sizing: border-box;
  gap: var(--gp-bar-gap);
  padding: var(--gp-bar-pad-y) 8px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}
.mob-chart-head {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--gp-head-h);
  position: relative;
  z-index: 6; /* above .mob-chart-backdrop, so the picker button and per-screen select stay tappable while the list is open */
  gap: 6px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.mob-chart-head :deep(.mob-save-wrap) { margin-left: 0; }
.mob-chart-menu {
  flex: none;
  width: var(--gp-head-control);
  height: var(--gp-head-control);
  min-height: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: none;
  border-radius: 5px;
  background: none;
  cursor: pointer;
}
/* The curves, listed once for every chart under the bar; wraps only when it must. */
.mob-chart-legend {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  column-gap: 12px;
  padding: 3px 12px;
  border-bottom: 1px solid #e6e6e6;
  background: #fff;
  font-size: 12px;
  line-height: var(--gp-legend-line);
}
.mob-chart-legend-item { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mob-chart-legend-item svg { flex: none; }
/* The band over each chart: no gap above it, the Data chip right after the title. */
.mob-chart-cell :deep(.mob-band) { margin-top: 0; flex: none; }
/* The Data button is the one phone button's size (--gp-tap, 44 px) so a finger can hit it, but drawn
   only as the small chip inside it; it spills over the 28 px band above and below without moving it. */
.mob-chart-data {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  vertical-align: middle;
  box-sizing: border-box;
  min-width: var(--gp-tap);
  height: var(--gp-tap);
  margin: calc((var(--gp-band) - var(--gp-tap)) / 2) 0 calc((var(--gp-band) - var(--gp-tap)) / 2) 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
}
.mob-chart-data-chip {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 20px;
  padding: 0 7px;
  border: 1px solid #999;
  border-radius: 3px;
  background: #fff;
  color: #333;
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.mob-chart-menu span { display: block; width: 20px; height: 2px; background: var(--fg); border-radius: 1px; }
.mob-chart-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: var(--gp-head-control);
  padding: 0 12px;
  border: 1px solid #c4c4c4;
  border-radius: 6px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
}
.mob-chart-high { flex: none; display: flex; }
.mob-chart-high select {
  box-sizing: border-box;
  width: var(--gp-per-w);
  height: var(--gp-head-control);
  padding: 0 8px;
  border: 1px solid #c4c4c4;
  border-radius: 6px;
  background: #fff;
  color: var(--fg);
  font: inherit;
  font-size: 14px;
}
.mob-chart-pick-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The checklist drops over the charts rather than pushing them down. */
.mob-chart-backdrop { position: absolute; inset: 0; z-index: 4; }
.mob-chart-list {
  position: absolute;
  left: 8px;
  right: 8px;
  top: calc(var(--gp-head-h) + 1px);
  z-index: 5;
  max-height: calc(100% - 140px);
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  background: #fff;
  border: 1px solid #bbb;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
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
.mob-chart-stack { flex: 1; min-height: 120px; display: grid; overflow-y: auto; scroll-snap-type: y mandatory; }
.mob-chart-cell { display: flex; flex-direction: column; min-height: 0; scroll-snap-align: start; }
.mob-chart-cell + .mob-chart-cell { border-top: 1px solid var(--line); }
/* GraphPanel's own .gpanel defaults to a 160px min-height (style.css) sized for a small tile;
   here it fills its cell. */
.mob-chart-cell :deep(.gpanel) { flex: 1; min-height: 0; border: none; border-radius: 0; }
.mob-chart-stack.stacked :deep(canvas) { touch-action: pan-y; }
</style>
