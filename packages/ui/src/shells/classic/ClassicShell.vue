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
import { createToneGenerator, type ToneGenerator } from '../../utils/toneGenerator.js';
import { useDesignIO } from '../../composables/useDesignIO.js';
import { prVas as calcPrVas, prFs as calcPrFs, prQms as calcPrQms,
         driveVoltage, soundVelocity } from '@openisd/engine';
import BoxPanel from '../../components/BoxPanel.vue';
import FiltersPanel from '../../components/FiltersPanel.vue';
import GraphPanel from '../../components/GraphPanel.vue';
import SkinPicker from '../../components/SkinPicker.vue';
import ExportMenu from '../../components/ExportMenu.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import DriverWhatIfPanel from '../../components/DriverWhatIfPanel.vue';
import DriverEditorModal from '../../components/DriverEditorModal.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import PREditModal from '../../components/PREditModal.vue';
import PRWhatIfPanel from '../../components/PRWhatIfPanel.vue';

const { saveProject, importFile, about } = useDesignIO();

// PR "Edit" is a real popup (state.prEditOpen); PR "What-If" (added mass) is an
// overlay (state.prWhatIfOpen) — same split as the driver's Edit/What-If.
const prEditOpen = ref(false);
const optionsOpen = ref(false);
const prWhatIfOpen = ref(false);
const prVasSummary = computed(() => calcPrVas(state.P.prCms, state.P.prSd));
const prFsSummary = computed(() => calcPrFs(state.P.prMmd, state.P.prCms));
const prQmsSummary = computed(() => calcPrQms(state.P.prMmd, state.P.prCms, state.P.prRms));

// Signal tab — "Signal source" voltage readout (WinISD: "Driver input voltage (each)").
const driveV = computed(() => driveVoltage(state.P.Pin ?? 1, driver.value?.Re || 8));

// Advanced tab — environment params are not modelled by the engine yet (screens-first):
// static WinISD-default values/derived readouts, and the 5 checkboxes are inert for now.
const advTemp = ref(293.15);
const advHumidity = ref(30.0);
const advPressure = ref(101325.0);
const advSoundVelocity = computed(() => soundVelocity(advTemp.value));
const advAirDensity = ref(1.20095);
const advSimVcInductance = ref(false);
const advForceFlat = ref(false);
const advTransmissionLine = ref(false);
const advRgAtDriverSide = ref(false);
const advSplXmaxLimited = ref(false);

// Driver "Edit" (state.editDriverInfo) opens DriverEditorModal — a real popup, since
// it recreates WinISD's own multi-tab "Driver editor" dialog and doesn't need the
// graph visible while editing. Driver "What-If?" (state.editDriver) stays an inline
// panel that replaces the Driver-tab summary in place, so the graph keeps redrawing
// live as T/S parameters change. Distinct from the folder icon / "Choose or replace
// the driver" flow (state.browseOpen), which swaps in a different catalogue driver
// entirely.
function startWhatIf() {
  if (!state.driverSource) state.driverSource = { ...driverRaw.value };
  state.editDriver = true;
}
function startEditInfo() {
  if (!state.driverSource) state.driverSource = { ...driverRaw.value };
  state.editDriverInfo = true;
}

// The classic skin's default trace colour — matches WinISD's own yellow-green plot line
// (chart_spl.png) rather than OpenISD's blue. Also drives the Color swatch.
const WINISD_TRACE = '#c9c900';

// toolbar file input (import)
const fileInput = ref<HTMLInputElement | null>(null);
function importClick() { fileInput.value!.click(); }
function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) importFile(f);
  input.value = '';
}

// chart-type selector drives the single chart — persisted in state.ui so it survives reload
const chartTab = computed({
  get: () => state.ui.classicChartTab ?? 'SPL',
  set: (v: string) => { state.ui.classicChartTab = v; },
});
const chartMeta = computed(() => TABS.find(t => t.id === chartTab.value));

// Project tab rail — also persisted in state.ui
const PROJECT_TABS = ['Driver', 'Box', 'Passive Radiator', 'Filters', 'Signal', 'Advanced', 'Project'] as const;
type ProjectTab = typeof PROJECT_TABS[number];
const projectTab = computed<ProjectTab>({
  get: () => (state.ui.classicProjectTab as ProjectTab) ?? 'Driver',
  set: (v: ProjectTab) => { state.ui.classicProjectTab = v; },
});

// The 3rd rail slot's identity key stays 'Passive Radiator' (state persistence,
// tab-content matching), but its displayed label tracks the box type — the
// type-specific content (vented/bandpass/PR) all lives on this one specialist tab.
const BOX_TYPE_TAB_LABEL: Record<string, string> = { sealed: 'Passive Radiator', vented: 'Vented', bandpass4: 'Bandpass', pr: 'Passive Radiator' };
function railLabel(t: string): string { return t === 'Passive Radiator' ? BOX_TYPE_TAB_LABEL[state.box] : t; }


// cursor readout (top-right): frequency + the selected chart's value there
const cursorHz = computed(() => state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF));
const currentDesign = computed(() => ({
  driver: driver.value, box: state.box, P: syncedP.value,
  curves: curvesData.value, maxCurves: maxData.value, name: 'Current', color: WINISD_TRACE,
}));
const cursorVal = computed<number | null>(() => {
  const f = cursorHz.value;
  const p = buildPlotData(chartTab.value, state.P.fmin, state.P.fmax, currentDesign.value, state.compare, driverErrors.value,
    { bare: true, primaryColor: WINISD_TRACE }).value;
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
      <img class="cl-app" src="/icon.svg" alt="" width="16" height="16">
      <span class="cl-tt">OpenISD — WinISD Classic Mode</span>
      <span class="cl-wb">&#8211;</span><span class="cl-wb">&#9633;</span><span class="cl-wb cl-x">&#10005;</span>
    </div>

    <!-- toolbar -->
    <div class="cl-toolbar">
      <button class="cl-ico" title="Open / import a .wdr driver or .json design" @click="importClick">
        <ToolbarIcon name="open" />
      </button>
      <button class="cl-ico" title="New — pick a driver from the library" @click="state.browseOpen = true">
        <ToolbarIcon name="new" />
      </button>
      <button class="cl-ico" title="Save — write the design as an OpenISD .json project to the file you picked (or pick one now)" @click="saveProject">
        <ToolbarIcon name="save" />
      </button>
      <ExportMenu class="cl-ico" title="Save As / Export — OpenISD project, WinISD project, driver file, or a share link">
        <ToolbarIcon name="saveAs" />
      </ExportMenu>
      <span class="cl-sep"></span>
      <button class="cl-ico" title="Choose a driver from the library" @click="state.browseOpen = true">
        <ToolbarIcon name="drivers" />
      </button>
      <button class="cl-ico" title="Options" @click="optionsOpen = true">
        <ToolbarIcon name="options" />
      </button>
      <button class="cl-ico" title="About OpenISD" @click="about">
        <ToolbarIcon name="info" />
      </button>
      <span class="cl-sep"></span>
      <label class="cl-chartsel" title="Choose which curve the graph shows (WinISD's chart-type selector)">
        <ToolbarIcon name="chart" />
        <select v-model="chartTab" title="Select the graph curve — SPL, excursion, impedance, group delay, and more">
          <option v-for="t in TABS" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <span class="cl-drop">&#9662;</span>
      </label>
      <div class="cl-readout" title="Cursor readout — hover or click the graph to place the marker">
        <div>{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</div>
        <div>{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '— ' + (chartMeta?.unit ?? 'dB') }}</div>
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
        <button class="cl-pin" title="Snapshot the current design and overlay it for comparison" @click="pinCompare">＋ Compare</button>

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
        <div class="cl-chart"><GraphPanel :tabId="chartTab" :bare="true" :primaryColor="WINISD_TRACE" /></div>
      </div>

      <div class="cl-bl">
        <div class="cl-heading">Project</div>
        <div class="cl-rail">
          <button v-for="t in PROJECT_TABS" :key="t" class="cl-rtab" :class="{ on: projectTab === t }"
                  :title="'Edit the ' + railLabel(t) + ' settings'" @click="projectTab = t">{{ railLabel(t) }}</button>
        </div>
        <div class="cl-color" title="The current design's curve colour on the graph">
          <span class="cl-sw" :style="{ background: WINISD_TRACE }"></span>Color
        </div>
      </div>

      <div class="cl-br">
        <!-- Driver tab — WinISD field layout bound to the shared store. Edit opens
             the global DriverEditorModal (a real popup, mounted once below); What-If
             overlays DriverWhatIfPanel inline so the graph keeps redrawing live. -->
        <div v-if="projectTab === 'Driver'" class="cl-driver">
          <div class="cl-drow">
            <div class="cl-fld"><label>Brand</label><input :value="brand" readonly></div>
            <div class="cl-fld"><label>Model</label><input :value="model" readonly></div>
            <button class="cl-edit" title="Edit this driver's Brand/Model/notes for the current project — never overwrites the shared library" @click="startEditInfo">
              <svg width="16" height="16" viewBox="0 0 18 18"><path d="M2 14 l9-9 3 3 -9 9 -3.6 .6 Z" fill="#ffd34d" stroke="#b8901f"/></svg>Edit
            </button>
          </div>
          <button class="cl-whatif" title="Open the What-If panel — tweak T/S parameters live and watch the graph update, without touching the shared library" @click="startWhatIf">What-If? ✎</button>
          <DriverWhatIfPanel v-if="state.editDriver" />

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

        <BoxPanel v-else-if="projectTab === 'Box'" variant="common" />
        <!-- 3rd rail slot: specialist tab for whatever box type is selected — vented/
             bandpass type-specific fields, or the PR unit's own summary/edit/what-if. -->
        <div v-else-if="projectTab === 'Passive Radiator' && state.box === 'sealed'" class="cl-todo">
          Nothing extra for a Sealed box — Box volume and losses are on the <b>Box</b> tab.
        </div>
        <BoxPanel v-else-if="projectTab === 'Passive Radiator' && (state.box === 'vented' || state.box === 'bandpass4')" variant="type" />
        <div v-else-if="projectTab === 'Passive Radiator'" class="cl-driver">
          <div class="drvsum" title="Passive radiator summary">
            <span class="nm">{{ state.P.prName || 'Custom PR' }}</span>
          </div>
          <div class="drvspecs">
            Sd <b>{{ (state.P.prSd*1e4).toFixed(0) }} cm²</b> ·
            Fs <b>{{ prFsSummary.toFixed(1) }} Hz</b> ·
            Qms <b>{{ prQmsSummary.toFixed(2) }}</b> ·
            Vas <b>{{ prVasSummary.toFixed(2) }} L</b> ·
            Xmax <b>{{ (state.P.prXmax*1000).toFixed(1) }} mm</b>
          </div>
          <button class="cl-edit" title="Edit this passive radiator's own specs — Sd/Fs/Qms/Vas/Xmax" @click="prEditOpen = true">
            <svg width="16" height="16" viewBox="0 0 18 18"><path d="M2 14 l9-9 3 3 -9 9 -3.6 .6 Z" fill="#ffd34d" stroke="#b8901f"/></svg>Edit
          </button>
          <button class="cl-whatif" title="Open the What-If overlay — tune added mass live and watch the graph update" @click="prWhatIfOpen = true">What-If? ✎</button>
          <PREditModal v-if="prEditOpen" @close="prEditOpen = false" />
          <PRWhatIfPanel v-if="prWhatIfOpen" @close="prWhatIfOpen = false" />
        </div>
        <FiltersPanel v-else-if="projectTab === 'Filters'" />
        <div v-else-if="projectTab === 'Signal'" class="cl-cols">
          <div>
            <div class="cl-subhdr">Listening place</div>
            <div class="row cl-dim" title="Listening distance from the speaker — not modelled yet (near-field/free-space assumption).">
              <label>Distance</label>
              <input value="1.000" disabled>
              <span class="u">m</span>
            </div>
            <div class="row cl-dim" title="Off-axis listening angle — not modelled yet.">
              <label>Angle</label>
              <input value="0.0000" disabled>
              <span class="u">rad</span>
            </div>
          </div>
          <div>
            <div class="cl-subhdr">Signal source</div>
            <div class="row" title="Total input power. Changing this updates the drive voltage below. WinISD: System input power.">
              <label>System input power</label>
              <input type="number" step="0.1" min="0" :value="(state.P.Pin ?? 1).toFixed(1)" @change="e => state.P.Pin = parseFloat((e.target as HTMLInputElement).value)||1">
              <span class="u">W</span>
            </div>
            <div class="row" title="Drive voltage = √(Pin × Re), per driver. WinISD: Driver input voltage (each).">
              <label>Driver input voltage (each)</label>
              <input type="text" :value="driveV.toFixed(1)" readonly>
              <span class="u">V</span>
            </div>
            <div class="row" title="Series resistance — wire, crossover DCR, amplifier output impedance. WinISD default: 0.1 Ω.">
              <label>Series resistance</label>
              <input type="number" step="0.01" min="0" :value="state.P.Rs" @input="e => state.P.Rs = parseFloat((e.target as HTMLInputElement).value)||0">
              <span class="u">ohm</span>
            </div>
          </div>
        </div>
        <div v-else-if="projectTab === 'Advanced'" class="cl-advanced">
          <div class="cl-adv-row">
            <div class="cl-fld"><label>Temperature</label><div class="cl-unit"><input type="number" v-model.number="advTemp"><span>K</span></div></div>
            <div class="cl-fld"><label>Relative humidity</label><div class="cl-unit"><input type="number" v-model.number="advHumidity"><span>%</span></div></div>
            <div class="cl-fld"><label>Air pressure</label><div class="cl-unit"><input type="number" v-model.number="advPressure"><span>Pa</span></div></div>
          </div>
          <div class="cl-arrow">---&gt;</div>
          <div class="cl-adv-row">
            <div class="cl-fld cl-dim"><label>Sound velocity</label><div class="cl-unit"><input type="text" :value="advSoundVelocity.toFixed(2)" readonly><span>m/s</span></div></div>
            <div class="cl-fld cl-dim"><label>Air density</label><div class="cl-unit"><input type="text" :value="advAirDensity.toFixed(5)" readonly><span>kg/m³</span></div></div>
          </div>
          <div class="cl-adv-checks">
            <label class="cl-check" title="Include voice-coil inductance Le in the acoustic circuit — not modelled yet in this view (see Signal tab's Circuit model).">
              <input type="checkbox" v-model="advSimVcInductance"> Simulate voice coil inductance
            </label>
            <label class="cl-check" title="Force the SPL response to render flat, ignoring driver rolloff — not modelled yet.">
              <input type="checkbox" v-model="advForceFlat"> Force flat response
            </label>
            <label class="cl-check" title="Use a transmission-line model for the vent instead of a simple tube — not modelled yet.">
              <input type="checkbox" v-model="advTransmissionLine"> Use "transmission line"-model for port simulation
            </label>
            <label class="cl-check" title="Places the series (generator) resistance on the driver side of the circuit rather than the amplifier side — not modelled yet.">
              <input type="checkbox" v-model="advRgAtDriverSide"> Rg is at driver side
            </label>
            <label class="cl-check" title="Clip the SPL graph at the excursion (Xmax) limit rather than showing the unbounded curve — not modelled yet.">
              <input type="checkbox" v-model="advSplXmaxLimited"> SPL graph is Xmax limited
            </label>
          </div>
        </div>
        <div v-else-if="projectTab === 'Project'" class="cl-project">
          <div class="row"><label>Creator</label><input type="text" v-model="state.project.creator" placeholder="Your name"></div>
          <div class="row"><label>Created</label><input type="text" v-model="state.project.created" placeholder="DD/MM/YYYY"></div>
          <div class="row"><label>Modified</label><input type="text" v-model="state.project.modified" placeholder="DD/MM/YYYY"></div>
          <div class="cl-subhdr" style="margin-top:8px">Description</div>
          <textarea class="cl-desc" v-model="state.project.description" placeholder="Notes about this project…"></textarea>
        </div>
        <div v-else class="cl-todo">The <b>{{ projectTab }}</b> tab isn’t modelled in OpenISD yet.</div>
      </div>
    </div>

    <DriverEditorModal v-if="state.editDriverInfo" @close="state.editDriverInfo = false" />
    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />
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
  --readout-bg: rgba(248,250,252,0.92);
  height: 100vh; display: flex; flex-direction: column;
  background: #ffffff; color: var(--fg);
  font: 13px/1.35 "Segoe UI", Tahoma, system-ui, sans-serif;
}

/* title bar */
.cl-title { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 6px 0 9px;
  background: #f3ece9; flex-shrink: 0; }
.cl-app { width: 16px; height: 16px; display: block; }
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
/* Freeform whitespace layout — WinISD has NO structural divider rules (no cross that
   quarters the window). Separation comes only from each control's own border + gaps. */
.cl-body { flex: 1; display: grid; grid-template-columns: 210px 1fr; grid-template-rows: minmax(0, 1fr) minmax(150px, 270px); min-height: 0; column-gap: 6px; }
.cl-tl { padding: 8px 10px; display: flex; flex-direction: column; min-height: 0; }
.cl-tr { padding: 8px 14px 8px 4px; display: flex; flex-direction: column; min-height: 0; }
.cl-bl { padding: 4px 10px 8px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
/* auto not hidden: most tabs fit the budget with no scrollbar, but a few genuine
   cases (bandpass4 + losses expanded, >4 filters) have more content than fits —
   scroll rather than silently clip. */
.cl-br { padding: 6px 14px 8px 4px; min-height: 0; overflow-y: auto; }
.cl-heading { color: var(--acc); font-weight: 600; font-size: 15px; margin: 2px 0 6px; }

/* Shared Box/PR/Filters/Signal panels use the global `.row` layout (style.css),
   where the label and select both take `flex:1` — correct in modern's narrow
   sidebar, but in classic's much wider body it stretches the label across empty
   space and blows the select out full-width. Rein it in here (deep, classic-only)
   rather than touching the shared component or style.css, so modern is unaffected.
   Design rule: .claude/context/ui-rules.md "No stretch-fit fields". */
.cl-br :deep(.row) { max-width: 460px; }
.cl-br :deep(.row label) { flex: none; width: 150px; }
.cl-br :deep(.row select) { flex: none; width: 200px; }

/* projects */
.cl-list { flex: 1; border: 1px solid #c4c4c4; background: #fff; overflow: auto; padding: 2px; min-height: 90px; }
.cl-li { display: flex; align-items: center; gap: 8px; padding: 5px 7px; font-size: 14px; border-radius: 2px; }
.cl-li.sel { background: #2f6db5; color: #fff; }
.cl-cbx { width: 16px; height: 16px; border: 1px solid #8aa; background: #fff; border-radius: 2px; display: grid; place-items: center; font-size: 11px; color: #2f6db5; }
.cl-cbx.on { cursor: pointer; }
.cl-pin { margin-top: 8px; font-size: 12px; padding: 5px 8px; background: #f0f0f0; border: 1px solid #c4c4c4; border-radius: 4px; color: #1b1b1b; cursor: pointer; }
.cl-pin:hover { border-color: var(--acc); }
.cl-sig { display: flex; align-items: center; gap: 6px; }
.cl-check { display: flex; align-items: center; gap: 5px; font-size: 14px; }
.cl-hz { width: 52px; padding: 3px 5px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; }
.cl-u { font-size: 13px; }

/* chart — the reused GraphPanel must fill the whole cell (no empty void below) */
.cl-chart { flex: 1; min-height: 220px; border: 1px solid #c4c4c4; border-radius: 4px; overflow: hidden; position: relative; display: flex; }
.cl-chart :deep(.gpanel) { flex: 1; height: 100%; min-height: 0; border: none; border-radius: 0; }

/* tab rail — same fixed-height budget as .cl-br (no scrolling), so it must stay
   compact enough that Color never gets pushed past the row cap. */
.cl-rail { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
.cl-rtab { padding: 4px 10px; text-align: center; font-size: 13px; border: none; border-radius: 4px; background: transparent; color: #1b1b1b; cursor: pointer; }
.cl-rtab:hover { background: #eef2f7; }
.cl-rtab.on { background: #cfe4f7; font-weight: 600; }
.cl-color { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; padding: 5px 10px; background: #e2e200; border-radius: 4px; font-size: 13px; flex-shrink: 0; }
.cl-sw { width: 22px; height: 13px; border: 1px solid #999; }

/* driver tab (WinISD layout) — compact: this pane has a fixed height budget (no
   scrolling, matching WinISD), so spacing here is deliberately tighter than the
   rest of the skin. */
.cl-driver { font-size: 13px; position: relative; height: 100%; }
.cl-drow { display: grid; grid-template-columns: 1fr 1fr auto; gap: 4px 16px; align-items: end; }
.cl-fld label { display: block; font-size: 12px; margin-bottom: 2px; color: #333; }
/* Fields keep their natural WinISD width — never stretch-fit to the grid column
   (design rule: .claude/context/ui-rules.md "No stretch-fit fields"). Brand/Model
   are the one WinISD exception that does fill its column. */
.cl-fld input, .cl-fld select { padding: 3px 7px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; background: #fff; }
.cl-drow .cl-fld input { width: 100%; }
.cl-place select { width: 140px; }
.cl-unit input { width: 130px; }
.cl-fld input[readonly], .cl-fld input:disabled, .cl-fld select:disabled { background: #f0f0f0; color: #555; }
.cl-edit { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 8px; background: #f0f0f0; border: 1px solid #c4c4c4; border-radius: 4px; cursor: pointer; height: 27px; }
.cl-edit:hover { border-color: var(--acc); }
.cl-whatif { display: inline-block; margin: 2px 0 4px; padding: 0; background: none; border: none; color: var(--acc2); font-size: 11px; cursor: pointer; text-decoration: underline; }
.cl-whatif:hover { color: var(--acc); }
.cl-cols { display: grid; grid-template-columns: 1.05fr .95fr; gap: 4px 16px; margin-top: 4px; }
.cl-subhdr { background: #e7e7e7; text-align: center; font-size: 13px; padding: 3px 0; border-radius: 2px; margin: 6px 0 5px; color: #333; }
.cl-place { display: grid; grid-template-columns: 1.35fr .65fr; gap: 4px 12px; align-items: start; }
.cl-glyph { display: grid; place-items: center; padding-top: 2px; }
.cl-glyph svg { width: 44px; height: 76px; }
.cl-radio { display: flex; align-items: center; gap: 6px; margin: 3px 0; font-size: 12px; }
.cl-radio em { color: #999; font-style: italic; font-size: 11px; }
.cl-unit { display: flex; align-items: center; gap: 6px; }
.cl-unit span { color: #333; font-size: 12px; white-space: nowrap; }
.cl-note { color: #888; font-style: italic; font-size: 11px; margin-top: 4px; }
.cl-dim { opacity: .6; }
.cl-todo { color: #666; font-style: italic; padding: 10px 2px; }

/* Signal tab */
.cl-cols .row { margin: 5px 0; }

/* Advanced tab — horizontal field groups, matching WinISD's env-params row layout */
.cl-adv-row { display: flex; gap: 22px; }
.cl-adv-env input, .cl-adv-row .cl-unit input { width: 120px; }
.cl-arrow { color: var(--mut); font-size: 13px; margin: 6px 0; }
.cl-adv-checks { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.cl-check { display: flex; align-items: center; gap: 7px; font-size: 13px; }

/* Project tab */
.cl-project .row { max-width: 500px; }
.cl-project .row label { flex: none; width: 90px; }
.cl-project .row input { flex: 1; }
.cl-desc { width: 100%; min-height: 140px; padding: 6px 8px; border: 1px solid #c4c4c4; border-radius: 2px; font: inherit; resize: vertical; }
</style>
