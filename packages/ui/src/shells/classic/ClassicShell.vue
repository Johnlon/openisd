<script setup lang="ts">
/**
 * Classic shell — a recreation of the WinISD 0.7.0.950 desktop window over OpenISD's
 * engine and state. NOTHING here forks logic: the tab rail mounts the same editor
 * panels the modern skin uses, the chart is the same GraphPanel, the Projects list is a
 * view of `state.compare`, and the Signal Generator drives the shared toneGenerator.
 *
 * The WinISD-light look is achieved purely by overriding the palette custom properties
 * on `.classic-root` — the reused components inherit it and render light with no changes.
 *
 * Deferred (next fidelity pass, to avoid duplicating AppHeader's file I/O or forking the
 * dark canvas renderer): the open/new/save toolbar icons and a white chart canvas.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { state, driver, driverErrors, syncedP, curvesData, maxData, pinCompare, driverShort, driverRaw } from '../../store.js';
import { TABS, buildPlotData } from '../../utils/series.js';
import { DPAL } from '../../presets.js';
import { createToneGenerator, type ToneGenerator } from '../../utils/toneGenerator.js';
import DriverPanel from '../../components/DriverPanel.vue';
import BoxPanel from '../../components/BoxPanel.vue';
import PRPanel from '../../components/PRPanel.vue';
import FiltersPanel from '../../components/FiltersPanel.vue';
import SignalPanel from '../../components/SignalPanel.vue';
import GraphPanel from '../../components/GraphPanel.vue';
import SkinPicker from '../../components/SkinPicker.vue';

// --- chart-type selector (the toolbar "SPL ▾") drives the single chart ---
const chartTab = ref('SPL');
const chartMeta = computed(() => TABS.find(t => t.id === chartTab.value));

// --- Project tab rail: which editor panel shows below ---
const PROJECT_TABS = ['Driver', 'Box', 'Passive Radiator', 'Filters', 'Signal', 'Advanced', 'Project'] as const;
type ProjectTab = typeof PROJECT_TABS[number];
const projectTab = ref<ProjectTab>('Driver');

// --- cursor readout (top-right): frequency + the selected chart's value there ---
const cursorHz = computed(() => state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF));
const currentDesign = computed(() => ({
  driver: driver.value, box: state.box, P: syncedP.value,
  curves: curvesData.value, maxCurves: maxData.value, name: 'Current', color: DPAL[0],
}));
const cursorVal = computed<number | null>(() => {
  const f = cursorHz.value;
  const p = buildPlotData(chartTab.value, state.P.fmin, state.P.fmax, currentDesign.value, state.compare, driverErrors.value).value;
  if (!p || f == null) return null;
  const s = p.series.find(x => !x.phantom);
  if (!s || !s.xs.length) return null;
  const { xs, ys } = s;
  if (f <= xs[0]) return ys[0];
  if (f >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (i < xs.length && xs[i] < f) i++;
  const t = (f - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
});

// --- Projects list = current design + pinned comparisons ---
function removeCompare(i: number) { state.compare.splice(i, 1); }

// --- Signal Generator: real audible tone (shared util, gesture-gated) ---
const genOn = ref(false);
const genHz = ref(38);
let tone: ToneGenerator | null = null;
function toggleGenerate() {
  tone ??= createToneGenerator();
  if (genOn.value) tone.start(genHz.value); else tone.stop();
}
watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
onUnmounted(() => tone?.stop());
</script>

<template>
  <div class="classic-root">
    <!-- toolbar -->
    <div class="cl-toolbar">
      <span class="cl-ico" title="Choose a driver from the library" role="button" tabindex="0"
            @click="state.browseOpen = true" @keydown.enter="state.browseOpen = true">
        <svg width="28" height="24" viewBox="0 0 30 26"><circle cx="15" cy="13" r="11" fill="#c9c9c9" stroke="#8a8a8a"/><circle cx="15" cy="13" r="6.5" fill="#9c9c9c" stroke="#6f6f6f"/><circle cx="15" cy="13" r="2.6" fill="#5f5f5f"/></svg>
      </span>
      <span class="cl-sep"></span>
      <label class="cl-chartsel" title="Choose which curve the graph shows (WinISD's chart-type selector)">
        <svg width="22" height="20" viewBox="0 0 26 24"><rect x="1" y="1" width="24" height="22" rx="2" fill="#fff" stroke="#cfcfcf"/><path d="M3 18 L9 12 L13 15 L22 5" fill="none" stroke="#d05bd0" stroke-width="2"/></svg>
        <select v-model="chartTab" title="Select the graph curve — SPL, excursion, impedance, group delay, and more">
          <option v-for="t in TABS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>
      <div class="cl-readout" title="Cursor readout — hover or click the graph to place the marker">
        <div>{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</div>
        <div>{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '—' }}</div>
      </div>
      <SkinPicker />
    </div>

    <!-- body: [Projects + SignalGen] [Graph] / [tab rail] [tab content] -->
    <div class="cl-body">
      <div class="cl-tl">
        <div class="cl-heading">Projects</div>
        <div class="cl-list">
          <div class="cl-li sel" :title="'Current design — ' + driverShort(driverRaw)">
            <span class="cl-cbx on">✓</span>{{ driverShort(driverRaw) }}
          </div>
          <div v-for="(d, i) in state.compare" :key="i" class="cl-li"
               :title="'Comparison overlay — untick to remove ' + d.name">
            <span class="cl-cbx on" @click="removeCompare(i)" role="button" tabindex="0"
                  @keydown.enter="removeCompare(i)">✓</span>{{ d.name }}
          </div>
        </div>
        <button class="cl-pin" title="Snapshot the current design and overlay it for comparison" @click="pinCompare">+ Add current to comparison</button>

        <div class="cl-heading" style="margin-top:12px">Signal Generator</div>
        <div class="cl-sig">
          <label class="cl-check" title="Play a real sine tone through your speakers at the set frequency (starts on click; stops when unticked)">
            <input type="checkbox" v-model="genOn" @change="toggleGenerate"> Generate
          </label>
          <input class="cl-hz" type="number" min="20" max="20000" step="1" v-model.number="genHz"
                 title="Tone frequency in Hz (audible range 20–20000)">
          <span class="cl-u">Hz</span>
        </div>
      </div>

      <div class="cl-tr">
        <div class="cl-heading">Graph</div>
        <div class="cl-chart"><GraphPanel :tabId="chartTab" /></div>
      </div>

      <div class="cl-bl">
        <div class="cl-heading">Project</div>
        <div class="cl-rail">
          <button v-for="t in PROJECT_TABS" :key="t" class="cl-rtab" :class="{ on: projectTab === t }"
                  :title="'Edit the ' + t + ' settings'" @click="projectTab = t">{{ t }}</button>
        </div>
        <div class="cl-color" title="The current design's curve colour on the graph">
          <span class="cl-sw" :style="{ background: DPAL[0] }"></span>Color
        </div>
      </div>

      <div class="cl-br">
        <DriverPanel v-if="projectTab === 'Driver'" />
        <BoxPanel v-else-if="projectTab === 'Box'" />
        <PRPanel v-else-if="projectTab === 'Passive Radiator'" />
        <FiltersPanel v-else-if="projectTab === 'Filters'" />
        <SignalPanel v-else-if="projectTab === 'Signal'" />
        <div v-else class="cl-todo">The <b>{{ projectTab }}</b> tab isn’t modelled in OpenISD yet.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* WinISD-light palette: override the shared custom properties so every reused panel
   (DriverPanel, BoxPanel, …) renders light with no per-component change. */
.classic-root {
  --bg: #ffffff; --panel: #ffffff; --panel2: #f4f5f6; --line: #d7d7d7;
  --fg: #1b1b1b; --mut: #555; --acc: #2f6db5; --acc2: #b8790f; --good: #2e8b57; --bad: #c62828;
  height: 100vh; display: flex; flex-direction: column;
  background: #ffffff; color: var(--fg);
  font: 13px/1.35 "Segoe UI", Tahoma, system-ui, sans-serif;
}
.cl-toolbar { display: flex; align-items: center; gap: 8px; height: 56px; padding: 0 12px;
  background: #fff; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.cl-ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 5px; cursor: pointer; }
.cl-ico:hover { background: #eef3f9; }
.cl-sep { width: 1px; height: 34px; background: var(--line); }
.cl-chartsel { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 6px 0 8px;
  border: 1px solid #c4c4c4; border-radius: 5px; background: #fff; }
.cl-chartsel select { font: inherit; font-size: 14px; border: none; background: transparent; color: #1b1b1b; cursor: pointer; }
.cl-chartsel select:focus { outline: none; }
.cl-readout { margin-left: auto; text-align: right; line-height: 1.25; font-variant-numeric: tabular-nums;
  font-size: 15px; min-width: 120px; }
.cl-body { flex: 1; display: grid; grid-template-columns: 322px 1fr; grid-template-rows: 1fr auto;
  min-height: 0; }
.cl-tl { border-right: 1px solid var(--line); padding: 8px 12px; display: flex; flex-direction: column; min-height: 0; }
.cl-tr { padding: 8px 14px; display: flex; flex-direction: column; min-height: 0; }
.cl-bl { border-right: 1px solid var(--line); border-top: 1px solid var(--line); padding: 8px 12px;
  display: flex; flex-direction: column; }
.cl-br { border-top: 1px solid var(--line); background: #fbfbfb; padding: 12px 14px; overflow-y: auto; min-height: 0; }
.cl-heading { color: var(--acc); font-weight: 600; font-size: 15px; margin: 2px 0 6px; }
.cl-list { flex: 1; border: 1px solid #c4c4c4; background: #fff; overflow: auto; padding: 2px; min-height: 90px; }
.cl-li { display: flex; align-items: center; gap: 8px; padding: 5px 7px; font-size: 14px; border-radius: 2px; }
.cl-li.sel { background: #2f6db5; color: #fff; }
.cl-cbx { width: 16px; height: 16px; border: 1px solid #8aa; background: #fff; border-radius: 2px;
  display: grid; place-items: center; font-size: 11px; color: #2f6db5; cursor: default; }
.cl-cbx.on { cursor: pointer; }
.cl-pin { margin-top: 8px; font-size: 12px; padding: 5px 8px; background: #f0f0f0; border: 1px solid #c4c4c4;
  border-radius: 4px; color: #1b1b1b; cursor: pointer; }
.cl-pin:hover { border-color: var(--acc); }
.cl-sig { display: flex; align-items: center; gap: 9px; }
.cl-check { display: flex; align-items: center; gap: 6px; font-size: 14px; }
.cl-hz { width: 82px; padding: 3px 6px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; }
.cl-chart { flex: 1; min-height: 220px; border: 1px solid #c4c4c4; border-radius: 4px; overflow: hidden; position: relative; }
.cl-rail { display: flex; flex-direction: column; gap: 6px; }
.cl-rtab { padding: 7px 10px; text-align: center; font-size: 14px; border: none; border-radius: 4px;
  background: transparent; color: #1b1b1b; cursor: pointer; }
.cl-rtab:hover { background: #eef2f7; }
.cl-rtab.on { background: #cfe4f7; font-weight: 600; }
.cl-color { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px;
  padding: 9px 10px; background: #e2e200; border-radius: 4px; font-size: 14px; }
.cl-sw { width: 22px; height: 13px; border: 1px solid #999; }
.cl-todo { color: #666; font-style: italic; padding: 10px 2px; }
</style>
