<script setup lang="ts">
/**
 * Classic shell — a recreation of the WinISD 0.7.0.950 desktop window (docs/winisd/*.png)
 * over OpenISD's engine and state. NOTHING here forks logic: the chart is the shared
 * GraphPanel (themed white via CSS vars, not forked), the Projects list is a view of
 * state.compare, file I/O reuses useDesignIO (shared with the modern header), and the
 * Signal Generator drives the shared toneGenerator. The Driver tab presents WinISD's own
 * field layout, but bound to the same store — presentation differs per skin, logic does not.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import { state, driver, driverErrors, syncedP, curvesData, maxData, pinCompare, driverShort, driverRaw } from '../../store.js';
import { TABS, buildPlotData } from '../../utils/series.js';
import { DPAL } from '../../presets.js';
import { createToneGenerator, type ToneGenerator } from '../../utils/toneGenerator.js';
import { useDesignIO } from '../../composables/useDesignIO.js';
import BoxPanel from '../../components/BoxPanel.vue';
import PRPanel from '../../components/PRPanel.vue';
import FiltersPanel from '../../components/FiltersPanel.vue';
import SignalPanel from '../../components/SignalPanel.vue';
import GraphPanel from '../../components/GraphPanel.vue';
import SkinPicker from '../../components/SkinPicker.vue';

const { exportDesign, exportWdr, importFile, about } = useDesignIO();

// toolbar file input (import)
const fileInput = ref<HTMLInputElement | null>(null);
function importClick() { fileInput.value!.click(); }
function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) importFile(f);
  input.value = '';
}

// chart-type selector drives the single chart
const chartTab = ref('SPL');
const chartMeta = computed(() => TABS.find(t => t.id === chartTab.value));

// Project tab rail
const PROJECT_TABS = ['Driver', 'Box', 'Passive Radiator', 'Filters', 'Signal', 'Advanced', 'Project'] as const;
type ProjectTab = typeof PROJECT_TABS[number];
const projectTab = ref<ProjectTab>('Driver');

// cursor readout (top-right): frequency + the selected chart's value there
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

// Projects list = current design + pinned comparisons
function removeCompare(i: number) { state.compare.splice(i, 1); }

// Signal Generator — real audible tone (shared util, gesture-gated)
const genOn = ref(false);
const genHz = ref(38);
let tone: ToneGenerator | null = null;
function toggleGenerate() {
  tone ??= createToneGenerator();
  if (genOn.value) tone.start(genHz.value); else tone.stop();
}
watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
onUnmounted(() => tone?.stop());

// Driver tab (WinISD layout) bound to the store
const brand = computed(() => driverRaw.value.brand || '');
const model = computed(() => driverRaw.value.model || driverShort(driverRaw.value));
</script>

<template>
  <div class="classic-root">
    <!-- title bar -->
    <div class="cl-title">
      <span class="cl-app"></span>
      <span class="cl-tt">WinISD 0.7.0.950</span>
      <span class="cl-wb">&#8211;</span><span class="cl-wb">&#9633;</span><span class="cl-wb cl-x">&#10005;</span>
    </div>

    <!-- toolbar -->
    <div class="cl-toolbar">
      <button class="cl-ico" title="Open / import a .wdr driver or .json design" @click="importClick">
        <svg width="30" height="26" viewBox="0 0 30 26"><path d="M2 6 h9 l2 3 h14 a2 2 0 0 1 2 2 v11 a2 2 0 0 1-2 2 H4 a2 2 0 0 1-2-2 Z" fill="#f4b23e" stroke="#c8871a"/><path d="M5 12 h20 l-3 10 H8 Z" fill="#ffd980" stroke="#c8871a"/></svg>
      </button>
      <button class="cl-ico" title="New — pick a driver from the library" @click="state.browseOpen = true">
        <svg width="22" height="26" viewBox="0 0 22 26"><path d="M3 2 h11 l5 5 v17 H3 Z" fill="#fff" stroke="#9aa4ad"/><path d="M14 2 v5 h5" fill="#e8edf2" stroke="#9aa4ad"/><circle cx="16" cy="6" r="3.4" fill="#ffe14d" stroke="#d4b800"/></svg>
      </button>
      <button class="cl-ico" title="Save the design as a .json project" @click="exportDesign">
        <svg width="24" height="26" viewBox="0 0 24 26"><path d="M3 3 h15 l3 3 v17 H3 Z" fill="#5b7fb0" stroke="#3c5a86"/><rect x="7" y="3" width="9" height="7" fill="#cdd8e6"/><rect x="7" y="14" width="10" height="7" fill="#eef2f7"/></svg>
      </button>
      <button class="cl-ico" title="Export the driver as a WinISD .wdr file" @click="exportWdr">
        <svg width="24" height="26" viewBox="0 0 24 26"><path d="M3 3 h15 l3 3 v17 H3 Z" fill="#5b7fb0" stroke="#3c5a86"/><rect x="7" y="3" width="9" height="7" fill="#cdd8e6"/><path d="M13 21 l7-7 3 3 -7 7 -3.6 .6 Z" fill="#ffd34d" stroke="#b8901f"/></svg>
      </button>
      <span class="cl-sep"></span>
      <button class="cl-ico" title="Choose a driver from the library" @click="state.browseOpen = true">
        <svg width="30" height="26" viewBox="0 0 30 26"><circle cx="15" cy="13" r="11" fill="#c9c9c9" stroke="#8a8a8a"/><circle cx="15" cy="13" r="6.5" fill="#9c9c9c" stroke="#6f6f6f"/><circle cx="15" cy="13" r="2.6" fill="#5f5f5f"/></svg>
      </button>
      <span class="cl-ico cl-dim" title="Options — not yet in OpenISD">
        <svg width="26" height="26" viewBox="0 0 26 26"><path d="M17 4 a5 5 0 0 0-6.5 6.4 L4 17 l4.6 4.6 6.6-6.5 A5 5 0 0 0 21.6 8.6 l-3 3-2.2-2.2 3-3 A5 5 0 0 0 17 4Z" fill="#8ea2b8" stroke="#5b6b7d"/></svg>
      </span>
      <button class="cl-ico" title="About OpenISD" @click="about">
        <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#2f8fe0" stroke="#1c6db3"/><circle cx="13" cy="7.5" r="1.8" fill="#fff"/><rect x="11.4" y="11" width="3.2" height="9" rx="1.4" fill="#fff"/></svg>
      </button>
      <span class="cl-sep"></span>
      <label class="cl-chartsel" title="Choose which curve the graph shows (WinISD's chart-type selector)">
        <svg width="22" height="20" viewBox="0 0 26 24"><rect x="1" y="1" width="24" height="22" rx="2" fill="#fff" stroke="#cfcfcf"/><path d="M3 18 L9 12 L13 15 L22 5" fill="none" stroke="#d05bd0" stroke-width="2"/></svg>
        <select v-model="chartTab" title="Select the graph curve — SPL, excursion, impedance, group delay, and more">
          <option v-for="t in TABS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <span class="cl-drop">&#9662;</span>
      </label>
      <div class="cl-readout" title="Cursor readout — hover or click the graph to place the marker">
        <div>{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</div>
        <div>{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '—' }}</div>
      </div>
      <SkinPicker />
      <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFile">
    </div>

    <!-- body: [Projects + SignalGen] [Graph] / [tab rail] [tab content] -->
    <div class="cl-body">
      <div class="cl-tl">
        <div class="cl-heading">Projects</div>
        <div class="cl-list">
          <div class="cl-li sel" :title="'Current design — ' + driverShort(driverRaw)">
            <span class="cl-cbx on">&#10003;</span>{{ driverShort(driverRaw) }}
          </div>
          <div v-for="(d, i) in state.compare" :key="i" class="cl-li"
               :title="'Comparison overlay — untick to remove ' + d.name">
            <span class="cl-cbx on" role="button" tabindex="0" @click="removeCompare(i)" @keydown.enter="removeCompare(i)">&#10003;</span>{{ d.name }}
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
        <!-- Driver tab — WinISD field layout bound to the shared store -->
        <div v-if="projectTab === 'Driver'" class="cl-driver">
          <div class="cl-drow">
            <div class="cl-fld"><label>Brand</label><input :value="brand" readonly></div>
            <div class="cl-fld"><label>Model</label><input :value="model" readonly></div>
            <button class="cl-edit" title="Choose or replace the driver from the library" @click="state.browseOpen = true">
              <svg width="16" height="16" viewBox="0 0 18 18"><path d="M2 14 l9-9 3 3 -9 9 -3.6 .6 Z" fill="#ffd34d" stroke="#b8901f"/></svg>Edit
            </button>
          </div>

          <div class="cl-cols">
            <div class="cl-subhdr">Placement</div>
            <div class="cl-subhdr">Advanced options</div>
          </div>
          <div class="cl-cols">
            <div class="cl-place">
              <div>
                <div class="cl-fld"><label>Num. of drivers</label>
                  <select v-model.number="state.P.nDrivers" title="Number of identical drivers in the design">
                    <option v-for="n in 8" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <label class="cl-radio" title="Standard placement (both drivers radiate)"><input type="radio" checked disabled> Standard</label>
                <label class="cl-radio cl-dim" title="Iso-Barik (compound) placement is not modelled in OpenISD"><input type="radio" disabled> Iso-Barik <em>(not modelled)</em></label>
                <div class="cl-fld"><label>Voice coil connection</label>
                  <select v-model="state.P.wiring" title="How multiple voice coils are wired">
                    <option value="parallel">Parallel</option>
                    <option value="series">Series</option>
                  </select>
                </div>
              </div>
              <div class="cl-glyph" aria-hidden="true" title="Driver cross-section">
                <svg width="64" height="110" viewBox="0 0 70 118"><rect x="46" y="2" width="4" height="114" fill="#111"/><path d="M20 40 L46 30 v58 L20 78 Z" fill="#111"/><path d="M12 46 h8 v26 h-8 Z" fill="#111"/></svg>
              </div>
            </div>
            <div>
              <div class="cl-fld cl-dim"><label>Voice coil temp rise</label><div class="cl-unit"><input value="0.00" disabled><span>K</span></div></div>
              <div class="cl-fld cl-dim"><label>Voice coil resistance TC</label><div class="cl-unit"><input value="3.9000" disabled><span>1000/K</span></div></div>
              <div class="cl-fld cl-dim"><label>Added mass to cone</label><div class="cl-unit"><input value="0.00000" disabled><span>kg</span></div></div>
              <div class="cl-note">Thermal &amp; added-mass options are not modelled yet.</div>
            </div>
          </div>
        </div>

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
/* WinISD-light palette + chart theming: overriding the shared custom properties makes
   every reused panel AND the shared canvas renderer render light with no fork. */
.classic-root {
  --bg: #ffffff; --panel: #ffffff; --panel2: #f4f5f6; --line: #d7d7d7;
  --fg: #1b1b1b; --mut: #555; --acc: #2f6db5; --acc2: #b8790f; --good: #2e8b57; --bad: #c62828;
  --chart-bg: #ffffff; --chart-grid: #dde3ea; --chart-text: #5a6b7b;
  --chart-cross: #00000055; --chart-band: rgba(0,0,0,0.05); --chart-band-line: rgba(0,0,0,0.3);
  height: 100vh; display: flex; flex-direction: column;
  background: #ffffff; color: var(--fg);
  font: 13px/1.35 "Segoe UI", Tahoma, system-ui, sans-serif;
}

/* title bar */
.cl-title { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 6px 0 9px;
  background: #f3ece9; flex-shrink: 0; }
.cl-app { width: 15px; height: 15px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #4a4a4a, #111); }
.cl-tt { flex: 1; font-size: 13px; color: #2a2a2a; }
.cl-wb { width: 28px; height: 22px; display: grid; place-items: center; color: #333; font-size: 12px; }
.cl-wb:hover { background: #e3d9d5; }
.cl-x:hover { background: #e81123; color: #fff; }

/* toolbar */
.cl-toolbar { display: flex; align-items: center; gap: 3px; height: 58px; padding: 0 12px;
  background: #fff; border-bottom: 1px solid var(--line); flex-shrink: 0; }
.cl-ico { display: grid; place-items: center; width: 44px; height: 46px; border: none; background: transparent;
  border-radius: 5px; cursor: pointer; padding: 0; }
.cl-ico:hover { background: #eef3f9; }
.cl-dim { opacity: .5; cursor: default; }
.cl-dim:hover { background: transparent; }
.cl-sep { width: 1px; height: 34px; background: var(--line); margin: 0 5px; }
.cl-chartsel { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 6px 0 8px;
  border: 1px solid #c4c4c4; border-radius: 5px; background: #fff; }
.cl-chartsel select { font: inherit; font-size: 14px; border: none; background: transparent; color: #1b1b1b; cursor: pointer; }
.cl-chartsel select:focus { outline: none; }
.cl-drop { color: #3a6ea5; font-size: 11px; }
.cl-readout { margin-left: auto; text-align: right; line-height: 1.25; font-variant-numeric: tabular-nums; font-size: 15px; min-width: 120px; }

/* body grid */
.cl-body { flex: 1; display: grid; grid-template-columns: 322px 1fr; grid-template-rows: 1fr auto; min-height: 0; }
.cl-tl { border-right: 1px solid var(--line); padding: 8px 12px; display: flex; flex-direction: column; min-height: 0; }
.cl-tr { padding: 8px 14px; display: flex; flex-direction: column; min-height: 0; }
.cl-bl { border-right: 1px solid var(--line); border-top: 1px solid var(--line); padding: 8px 12px; display: flex; flex-direction: column; }
.cl-br { border-top: 1px solid var(--line); background: #fbfbfb; padding: 12px 14px; overflow-y: auto; min-height: 0; }
.cl-heading { color: var(--acc); font-weight: 600; font-size: 15px; margin: 2px 0 6px; }

/* projects */
.cl-list { flex: 1; border: 1px solid #c4c4c4; background: #fff; overflow: auto; padding: 2px; min-height: 90px; }
.cl-li { display: flex; align-items: center; gap: 8px; padding: 5px 7px; font-size: 14px; border-radius: 2px; }
.cl-li.sel { background: #2f6db5; color: #fff; }
.cl-cbx { width: 16px; height: 16px; border: 1px solid #8aa; background: #fff; border-radius: 2px; display: grid; place-items: center; font-size: 11px; color: #2f6db5; }
.cl-cbx.on { cursor: pointer; }
.cl-pin { margin-top: 8px; font-size: 12px; padding: 5px 8px; background: #f0f0f0; border: 1px solid #c4c4c4; border-radius: 4px; color: #1b1b1b; cursor: pointer; }
.cl-pin:hover { border-color: var(--acc); }
.cl-sig { display: flex; align-items: center; gap: 9px; }
.cl-check { display: flex; align-items: center; gap: 6px; font-size: 14px; }
.cl-hz { width: 82px; padding: 3px 6px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; }

/* chart */
.cl-chart { flex: 1; min-height: 220px; border: 1px solid #c4c4c4; border-radius: 4px; overflow: hidden; position: relative; }

/* tab rail */
.cl-rail { display: flex; flex-direction: column; gap: 6px; }
.cl-rtab { padding: 7px 10px; text-align: center; font-size: 14px; border: none; border-radius: 4px; background: transparent; color: #1b1b1b; cursor: pointer; }
.cl-rtab:hover { background: #eef2f7; }
.cl-rtab.on { background: #cfe4f7; font-weight: 600; }
.cl-color { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; padding: 9px 10px; background: #e2e200; border-radius: 4px; font-size: 14px; }
.cl-sw { width: 22px; height: 13px; border: 1px solid #999; }

/* driver tab (WinISD layout) */
.cl-driver { font-size: 14px; }
.cl-drow { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px 22px; align-items: end; }
.cl-fld label { display: block; font-size: 13px; margin-bottom: 3px; color: #333; }
.cl-fld input, .cl-fld select { width: 100%; padding: 5px 8px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; background: #fff; }
.cl-fld input[readonly], .cl-fld input:disabled, .cl-fld select:disabled { background: #f0f0f0; color: #555; }
.cl-edit { display: flex; align-items: center; gap: 6px; font-size: 14px; padding: 6px 8px; background: #f0f0f0; border: 1px solid #c4c4c4; border-radius: 4px; cursor: pointer; height: 32px; }
.cl-edit:hover { border-color: var(--acc); }
.cl-cols { display: grid; grid-template-columns: 1.05fr .95fr; gap: 8px 22px; margin-top: 6px; }
.cl-subhdr { background: #e7e7e7; text-align: center; font-size: 14px; padding: 5px 0; border-radius: 2px; margin: 12px 0 8px; color: #333; }
.cl-place { display: grid; grid-template-columns: 1.35fr .65fr; gap: 8px 14px; align-items: start; }
.cl-glyph { display: grid; place-items: center; padding-top: 4px; }
.cl-radio { display: flex; align-items: center; gap: 7px; margin: 6px 0; }
.cl-radio em { color: #999; font-style: italic; font-size: 12px; }
.cl-unit { display: flex; align-items: center; gap: 8px; }
.cl-unit span { color: #333; font-size: 13px; white-space: nowrap; }
.cl-note { color: #888; font-style: italic; font-size: 12px; margin-top: 8px; }
.cl-dim { opacity: .6; }
.cl-todo { color: #666; font-style: italic; padding: 10px 2px; }
</style>
