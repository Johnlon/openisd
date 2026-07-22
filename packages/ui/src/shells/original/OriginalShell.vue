<script setup lang="ts">
/**
 * Original shell — a faithful wholesale port of the `mock/` WinISD 0.7.0.950
 * recreation (mock/index.html + mock/style.css), wired to the shared store + engine.
 *
 * Fidelity rule: the markup, class names, layout and chrome match the mock region by
 * region. The ONE sanctioned divergence is that the mock's fake state/physics are
 * replaced by the shared store + engine — the static graph SVG becomes the shared
 * GraphPanel, every `.calculated` literal becomes a live engine value, and every
 * `.entered` field is v-model-bound to the store.
 *
 * Box-type scope: the engine solver (packages/engine/src/circuit.ts) models four types
 * (sealed, vented, pr, bandpass4). 6th-order bandpass and ABC are ported as UI (diagram +
 * chamber/vent fields) but have no engine model yet, so they show an explicit "response
 * model pending" state instead of a fabricated curve. When the engine gains those
 * branches, add them to `SUPPORTED_BOX` and the pending state clears.
 */
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  state, driver, driverRaw, driverShort, pinCompare,
  syncedP, curvesData, maxData, driverErrors,
  isModified, markProjectSaved, resetProjectToGround,
  isDriverWhatIfActive, whatIfJSON, restoreDriverWhatIf,
  formatInUnit as fmtU,
} from '../../store.js';
import UnitToggle from '../../components/UnitToggle.vue';
import type { DriverRaw } from '@openisd/engine';
import type { BoxType } from '@openisd/engine';
import { RHO, C,
         prVas as calcPrVas, prFs as calcPrFs, prFsWithMass as calcPrFsMass, prQms as calcPrQms,
         driveVoltage, soundVelocity } from '@openisd/engine';
import { TABS, buildPlotData } from '../../utils/series.js';
import { createToneGenerator, type ToneGenerator } from '../../utils/toneGenerator.js';
import { useDesignIO } from '../../composables/useDesignIO.js';
import GraphPanel from '../../components/GraphPanel.vue';
import SkinPicker from '../../components/SkinPicker.vue';
import NumInput from '../../components/NumInput.vue';
import ExportMenu from '../../components/ExportMenu.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import { precision as fieldDp, END_CORRECTION_OPTIONS } from '../../fields/fieldRegistry.js';
import OgFilters from './OgFilters.vue';
import OgTune from './OgTune.vue';
import OgNewProject from './OgNewProject.vue';
import DriverEditorModal from '../../components/DriverEditorModal.vue';
import OptionsModal from '../../components/OptionsModal.vue';

const { saveProject, exportWdr, importFile, about } = useDesignIO();

// WinISD's yellow-green plot line — the Original skin's default trace colour + Color swatch.
// The current design's trace colour. The Color button cycles it through a small
// palette (WinISD's yellow-green first) and it feeds the shared GraphPanel's
// primaryColor live — self-contained to this skin (no store/shared-component change).
// The mock's own palette (mock/script.js `colorPalette`) — kept identical for fidelity.
const TRACE_PALETTE = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];
const traceIdx = ref(0);
const WINISD_TRACE = computed(() => TRACE_PALETTE[traceIdx.value]);
function cycleColor() { traceIdx.value = (traceIdx.value + 1) % TRACE_PALETTE.length; }

function fmt(n: number | null | undefined, dp: number): string {
  return n != null && isFinite(n) ? n.toFixed(dp) : '—';
}
// fmtU (calculated-value-in-selected-unit) is the shared store.formatInUnit, imported above.

// ---- Box types -----------------------------------------------------------------
type OgBox = 'sealed' | 'vented' | 'pr' | 'bandpass4' | 'bandpass6' | 'abc';
const BOX_OPTIONS: { id: OgBox; label: string }[] = [
  { id: 'sealed',    label: 'Closed' },
  { id: 'vented',    label: 'Vented' },
  { id: 'pr',        label: 'Passive Radiator' },
  { id: 'bandpass4', label: '4th Order Bandpass' },
  { id: 'bandpass6', label: '6th Order Bandpass' },
  { id: 'abc',       label: 'ABC (Aperiodic Bi-Chamber)' },
];
const SUPPORTED_BOX = new Set<OgBox>(['sealed', 'vented', 'pr', 'bandpass4']);
const DUAL_CHAMBER = new Set<OgBox>(['bandpass4', 'bandpass6', 'abc']);

// selectedBox is the Box tab's source of truth: it can hold values (bandpass6/abc) the
// engine BoxType cannot yet represent. Supported selections mirror into the shared store;
// unsupported ones leave state.box on its last valid value and raise `pending`.
const selectedBox = ref<OgBox>(state.box);
watch(selectedBox, (b) => { if (SUPPORTED_BOX.has(b)) state.box = b as BoxType; });
// Follow any EXTERNAL change to the store's box — e.g. a design loaded via App.vue's
// hashchange path (`state.box = o.box`) — even while a pending type is selected. Fires only
// on a real store change; the watcher above only writes state.box when it differs, so the
// two never ping-pong. Fixes the desync where a loaded, curve-producing box was hidden
// behind a stale pending view.
watch(() => state.box, (b) => { if (selectedBox.value !== b) selectedBox.value = b; });

const pending = computed(() => !SUPPORTED_BOX.has(selectedBox.value));
const isDual = computed(() => DUAL_CHAMBER.has(selectedBox.value));
const boxLabel = computed(() => BOX_OPTIONS.find(o => o.id === selectedBox.value)?.label ?? 'Box');
// The 3rd nav tab (id 'enclosure') tracks the box type, WinISD-style.
const enclosureNavLabel = computed(() =>
  selectedBox.value === 'pr' ? 'Passive Radiator'
    : selectedBox.value === 'sealed' ? 'Closed'
      : boxLabel.value);
// A Closed box has no vents/PR — its enclosure tab would only duplicate the Box tab's
// Volume, so it's dropped (matching the Classic skin's sealed-box behaviour).
const showEnclosureTab = computed(() => selectedBox.value !== 'sealed');

// ---- Live engine-derived readouts (never faked literals) -----------------------
// Sealed/PR rear-chamber resonance: Fc = Fs·√(1 + Vas/Vb).
const rearResonance = computed<number | null>(() => {
  const d = driver.value;
  if (!d || !(state.P.Vb > 0)) return null;
  return d.Fs * Math.sqrt(1 + d.Vas / state.P.Vb);
});
// Vent geometry (vented / bandpass4): cross-sectional area and Helmholtz tuning.
const ventArea = computed(() => Math.PI * (state.P.ventD / 2) ** 2);           // m²
function helmholtzFb(volume: number): number | null {
  if (!(volume > 0) || !(ventArea.value > 0)) return null;
  const Sp = ventArea.value;
  const Leff = state.P.ventL + state.P.endCorrection * state.P.ventD;
  const Map = RHO * Leff / Sp, Cab = volume / (RHO * C * C);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}
// Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber
// tunes on its own front volume Vf. Same closed form the engine's circuit uses.
const ventFb = computed<number | null>(() => helmholtzFb(state.P.Vb));
const frontTuning = computed<number | null>(() => helmholtzFb(state.P.Vf));
// First port (organ-pipe) resonance of the vent tube itself — the open-open duct fundamental
// c/(2·L), a standing wave in the vent, DISTINCT from the box Helmholtz tuning ventFb. Uses the
// PHYSICAL vent length (NOT the end-corrected Leff) to match WinISD exactly: its 86.87 Hz =
// 343.68/(2·1.978 m physical length). End correction applies to the tuning Fb, not this. §portterminology.
const portPipeResonance = computed<number | null>(() => {
  return state.P.ventL > 0 ? C / (2 * state.P.ventL) : null;
});
// Passive-radiator derived params (from the stored PR T/S bag).
const prVas = computed(() => calcPrVas(state.P.prCms, state.P.prSd));
const prFs = computed(() => calcPrFs(state.P.prMmd, state.P.prCms));
const prFsMass = computed(() => calcPrFsMass(state.P.prMmd, state.P.prMadd, state.P.prCms));
const prQms = computed(() => calcPrQms(state.P.prMmd, state.P.prCms, state.P.prRms));

// ---- Chart selector ------------------------------------------------------------
// The mock's full chart menu; each maps to a real engine curve id (TABS) or null.
// Null items stay listed (fidelity) but draw no fabricated curve — the graph shows a
// clean "not available" state, honest about what the engine can and can't compute.
type ChartItem = { label: string; tab: string | null; sep?: boolean };
const CHART_ITEMS: ChartItem[] = [
  { label: 'Transfer function magnitude', tab: 'SPL' },
  { label: 'Transfer function phase', tab: 'Phase' },
  { label: 'Group Delay', tab: 'GD' },
  { label: 'Maximum Power', tab: 'MaxPwr' },
  { label: 'Maximum SPL', tab: 'MaxSPL' },
  { label: 'Amplifier apparent load power (VA)', tab: null },
  { label: 'SPL', tab: 'SPL' },
  { label: 'Cone excursion', tab: 'Excursion', sep: true },
  { label: 'Impedance', tab: 'Zmag' },
  { label: 'Impedance phase', tab: 'Zph' },
  { label: 'Transfer function magnitude (PR)', tab: null, sep: true },
  { label: 'Transfer function phase (PR)', tab: null },
  { label: 'Cone excursion (PR)', tab: 'Excursion' },
  { label: 'Rear port - Air velocity', tab: 'Port', sep: true },
  { label: 'Rear port - Gain', tab: null },
  { label: 'Front port - Air velocity', tab: 'Port' },
  { label: 'Front port - Gain', tab: null },
  { label: 'Intrachamber Port - Air velocity', tab: null },
  { label: 'Transfer function magnitude (EQ/Filter)', tab: null, sep: true },
  { label: 'Transfer function phase (EQ/Filter)', tab: null },
  { label: 'Group Delay (EQ/Filter)', tab: null },
];
const chartTab = computed({
  get: () => state.ui.originalChartTab ?? 'SPL',
  set: (v: string) => { state.ui.originalChartTab = v; },
});
// The currently-chosen chart label (persisted separately so a "not available" pick sticks).
const chartLabel = computed({
  get: () => state.ui.originalChartLabel ?? 'SPL',
  set: (v: string) => { state.ui.originalChartLabel = v; },
});
const chartMeta = computed(() => TABS.find(t => t.id === chartTab.value));
const chartUnavailable = computed(() => {
  const item = CHART_ITEMS.find(i => i.label === chartLabel.value);
  return item != null && item.tab == null;
});
function selectChart(item: ChartItem) {
  chartLabel.value = item.label;
  if (item.tab) chartTab.value = item.tab;
  closeDropdown();
}

// ---- Toolbar dropdown menus (folder / saveas / info / chart) -------------------
const openDd = ref<string | null>(null);
function toggleDropdown(id: string) { openDd.value = openDd.value === id ? null : id; }
function closeDropdown() { openDd.value = null; }
function onDocClick() { closeDropdown(); }
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

// toolbar file input (Open…)
const fileInput = ref<HTMLInputElement | null>(null);
function openClick() { fileInput.value!.click(); }
function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) importFile(f);
  input.value = '';
}

// ---- Cursor readout (top-right) — real interpolation of the selected curve ------
const cursorHz = computed(() => state.cursorLocked ? state.pinnedF : (state.cursorF ?? state.pinnedF));
const currentDesign = computed(() => ({
  driver: driver.value, box: state.box, P: syncedP.value,
  curves: curvesData.value, maxCurves: maxData.value, name: 'Current', color: WINISD_TRACE.value,
}));
const cursorVal = computed<number | null>(() => {
  const f = cursorHz.value;
  if (pending.value || chartUnavailable.value || f == null) return null;
  const p = buildPlotData(chartTab.value, state.P.fmin, state.P.fmax, currentDesign.value, state.compare, driverErrors.value,
    { bare: true, primaryColor: WINISD_TRACE.value }).value;
  if (!p) return null;
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

// ---- Tab rail (persisted) ------------------------------------------------------
type TabId = 'box' | 'driver' | 'enclosure' | 'filters' | 'signal' | 'advanced' | 'project';
const activeTab = computed<TabId>({
  get: () => (state.ui.originalProjectTab as TabId) ?? 'box',
  set: (v: TabId) => { state.ui.originalProjectTab = v; },
});
// If the enclosure tab is dropped (Closed box) while it's active, fall back to the Box tab.
watch(showEnclosureTab, (show) => { if (!show && activeTab.value === 'enclosure') activeTab.value = 'box'; });

// ---- Projects list -------------------------------------------------------------
function removeCompare(i: number) { state.compare.splice(i, 1); }

// ---- Resizable / collapsible layout --------------------------------------------
// Left panel width + bottom section height are splitter-dragged; both panels also
// collapse outright, and the chart can maximise over the whole main area (the toolbar
// stays, so the chart type remains switchable while maximised). All five prefs live in
// state.ui → persisted locally across refresh, stripped from share links (persist.ts).
const mainEl = ref<HTMLElement | null>(null);
const navCollapsed = computed({ get: () => state.ui.originalNavCollapsed ?? false, set: (v: boolean) => { state.ui.originalNavCollapsed = v; } });
const bottomCollapsed = computed({ get: () => state.ui.originalBottomCollapsed ?? false, set: (v: boolean) => { state.ui.originalBottomCollapsed = v; } });
const chartMax = computed({ get: () => state.ui.originalChartMax ?? false, set: (v: boolean) => { state.ui.originalChartMax = v; } });
const mainStyle = computed(() => chartMax.value ? {} : {
  gridTemplateColumns: (navCollapsed.value ? '0px' : (state.ui.originalNavW ?? 250) + 'px') + ' 7px 1fr',
  gridTemplateRows: '1fr 7px ' + (bottomCollapsed.value ? '0px' : (state.ui.originalBottomH ?? 290) + 'px'),
});
function startSplitDrag(e: PointerEvent, apply: (rect: DOMRect, ev: PointerEvent) => void): void {
  const el = e.currentTarget as HTMLElement;
  const rect = mainEl.value!.getBoundingClientRect();
  el.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => apply(rect, ev);
  const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  e.preventDefault();
}
function onNavSplitDown(e: PointerEvent): void {
  if (navCollapsed.value) return;
  startSplitDrag(e, (rect, ev) => { state.ui.originalNavW = Math.min(520, Math.max(140, ev.clientX - rect.left)); });
}
function onBottomSplitDown(e: PointerEvent): void {
  if (bottomCollapsed.value) return;
  startSplitDrag(e, (rect, ev) => { state.ui.originalBottomH = Math.min(rect.height - 160, Math.max(120, rect.bottom - ev.clientY)); });
}

// ---- Driver identity + placement ----------------------------------------------
const brand = computed(() => driverRaw.value.brand || '');
const model = computed(() => driverRaw.value.model || driverShort(driverRaw.value));

// ---- Signal Generator (real audio-out tone) ------------------------------------
const genOn = ref(false);
const genHz = ref(1000);
let tone: ToneGenerator | null = null;
function toggleGenerate() { tone ??= createToneGenerator(); if (genOn.value) tone.start(genHz.value); else tone.stop(); }
watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
onUnmounted(() => tone?.stop());

// ---- Signal tab: drive voltage = √(Pin × Re) per driver ------------------------
// Drive voltage ↔ system power are two views of the same energy: V = √(P·Re), P = V²/Re.
// WinISD lets you edit EITHER (each recomputes the other); Pin is the stored source of truth.
const driveV = computed<number>({
  get: () => driveVoltage(state.P.Pin ?? 1, driver.value?.Re || 8),
  set: (v) => { state.P.Pin = (v * v) / (driver.value?.Re || 8); },
});

// ---- Advanced tab: environment (not modelled by the engine yet — honest static
// defaults + one live derivation). The 5 checkboxes are inert placeholders, as in the
// Classic skin: shown for parity, clearly not wired to the sweep. -------------------
const advTemp = ref(293.15);
const advHumidity = ref(30.0);
const advPressure = ref(101325.0);
const advSoundVelocity = computed(() => soundVelocity(advTemp.value));
const advChecks = reactive({ vc: false, flat: false, tl: false, rg: false, xmax: false });

// ---- Placement (Signal path multipliers already in the store) ------------------
// Standard vs Iso-Barik: only Standard is modelled; the radio is shown for parity.
const placement = ref<'standard' | 'iso'>('standard');

// ---- Box losses (real: Ql/Qa/Qp) + docked/modal editors ------------------------
const boxLossesOpen = ref(false);
const newProjectOpen = ref(false);
const optionsOpen = ref(false);

// Tune (inline What-If) and Edit (full editor modal) reuse the shared driver editors.
// Both need the driver-source snapshot seeded first, exactly as the Classic skin does.
function startTune() { if (!state.driverSource) state.driverSource = { ...driverRaw.value } as DriverRaw; state.editDriver = true; }
function startEdit() { if (!state.driverSource) state.driverSource = { ...driverRaw.value } as DriverRaw; state.editDriverInfo = true; }

// R1 refresh fidelity — preserve an open Tune (what-if) + its uncommitted buffer across a
// reload. Original-scoped: only this shell reads/writes these state.ui fields, so Modern and
// Classic refresh behaviour is unchanged (they never set originalTuneOpen). These live in
// state.ui, so they persist to localStorage (refresh) but stateToUrl strips these two fields
// specifically — an open editor's uncommitted buffer is personal working state, excluded from
// share links (skin + active tab/chart ARE shared — see stateToUrl's own comment).
watch([isDriverWhatIfActive, whatIfJSON], ([active, json]) => {
  state.ui.originalTuneOpen = active;
  state.ui.originalWhatIf = active ? json : null;
});
// App.vue applies persisted state.ui AFTER this child mounts, so react when originalTuneOpen
// lands: re-create the overlay from the saved buffer and re-open the Tune panel.
watch(() => state.ui.originalTuneOpen, (open) => {
  if (open && !isDriverWhatIfActive.value && state.ui.originalWhatIf) {
    restoreDriverWhatIf(state.ui.originalWhatIf);
    state.editDriver = true;
  }
}, { immediate: true });

// Same for the Driver Editor modal — it edits the committed design live (no separate buffer),
// so preserving it across refresh is just persisting the open flag and reopening. Original-
// scoped (Modern/Classic never set originalEditorOpen).
watch(() => state.editDriverInfo, (open) => { state.ui.originalEditorOpen = open; });
watch(() => state.ui.originalEditorOpen, (open) => { if (open) state.editDriverInfo = true; }, { immediate: true });

</script>

<template>
  <div class="original-root">
    <!-- ================= Title bar ================= -->
    <div class="titlebar">
      <div class="tb-left"><span class="app-icon"></span><span>OpenISD — WinISD Original Mode<template v-if="state.project.name"> — {{ state.project.name }}</template></span></div>
      <div class="win-controls"><span>&#8211;</span><span>&#9633;</span><span class="close-btn">&#10005;</span></div>
    </div>

    <!-- ================= Toolbar ================= -->
    <div class="toolbar">
      <div class="tb-icons">
        <div class="tb-btn has-menu" title="Open project" style="position:relative" @click.stop="toggleDropdown('folder-dropdown')">
          <ToolbarIcon name="open" />
          <span class="caret" style="position:absolute;bottom:2px;right:2px;">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'folder-dropdown' }" @click.stop>
            <div class="menu-item" title="Import a .wdr driver or .json design." @click="openClick(); closeDropdown()">Open...</div>
            <hr>
            <div class="menu-item">{{ driverShort(driverRaw) }}</div>
          </div>
        </div>
        <div class="tb-btn" title="New project — choose box type + starting volume, then a driver." @click="newProjectOpen = true">
          <ToolbarIcon name="new" />
        </div>
        <div class="tb-btn" title="Save — write the design as an OpenISD .json project to the file you picked (or pick one now)." @click="saveProject">
          <ToolbarIcon name="save" />
        </div>
        <ExportMenu class="tb-btn" title="Save As / Export — OpenISD project, WinISD project, driver file, or a share link.">
          <ToolbarIcon name="saveAs" />
        </ExportMenu>
        <div class="tb-sep"></div>
        <div class="tb-btn" title="Manage Drivers — browse the library." @click="state.browseOpen = true">
          <ToolbarIcon name="drivers" />
        </div>
        <div class="tb-btn" title="Options" @click="optionsOpen = true">
          <ToolbarIcon name="options" />
        </div>
        <div class="tb-btn has-menu" title="Info" style="position:relative" @click.stop="toggleDropdown('info-dropdown')">
          <ToolbarIcon name="info" />
          <span class="caret" style="position:absolute;bottom:2px;right:2px;">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'info-dropdown' }" @click.stop>
            <div class="menu-item" @click="about(); closeDropdown()">About OpenISD</div>
          </div>
        </div>
        <div class="tb-sep"></div>
        <div class="chart-select" @click.stop="toggleDropdown('chart-dropdown')" title="Choose which curve the graph shows">
          <ToolbarIcon name="chart" />
          <span class="chart-name">{{ chartLabel }}</span>
          <span class="caret">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'chart-dropdown' }" @click.stop>
            <template v-for="item in CHART_ITEMS" :key="item.label">
              <hr v-if="item.sep">
              <div class="menu-item" :class="{ current: item.label === chartLabel }" @click="selectChart(item)">{{ item.label }}</div>
            </template>
          </div>
        </div>
      </div>
      <div class="cursor-readout">
        <span class="ro-hz">{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</span>
        <span class="ro-val">{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '— ' + (chartMeta?.unit ?? 'dB') }}</span>
        <SkinPicker />
      </div>
    </div>

    <!-- ================= Main: 2×2 quadrants + splitters ================= -->
    <div ref="mainEl" class="main" :class="{ 'chart-max': chartMax, 'nav-collapsed': navCollapsed, 'bottom-collapsed': bottomCollapsed }" :style="mainStyle">
      <!-- top-left quadrant -->
      <div class="quad-topleft">
        <div class="quad-projects-wrap">
          <div class="panel-title">Projects</div>
          <div class="projects-list">
            <div class="project-row selected" :title="'Current design — ' + driverShort(driverRaw)">
              <span class="row-remove-spacer"></span>
              <input type="checkbox" checked disabled>
              <span>{{ driverShort(driverRaw) }}</span>
            </div>
            <div v-for="(d, i) in state.compare" :key="i" class="project-row"
                 :class="{ 'trace-hidden': d.visible === false }"
                 :title="'Comparison overlay — ✕ to remove, untick to hide its trace: ' + d.name">
              <button class="row-remove" title="Remove this comparison overlay" @click="removeCompare(i)">✕</button>
              <input type="checkbox" :checked="d.visible !== false" @change="d.visible = ($event.target as HTMLInputElement).checked"
                     title="Show/hide this overlay's trace on the graph">
              <span>{{ d.name }}</span>
            </div>
          </div>
          <button class="link-btn" style="margin-top:6px" title="Clone the current design as a snapshot and overlay it on the graph for comparison" @click="pinCompare">＋ Clone/Compare</button>
        </div>

        <div class="quad-signalgen-wrap">
          <div class="panel-title">Signal Generator</div>
          <div class="signal-gen-row" title="Play a real sine tone out of the audio output for testing speakers.">
            <label><input type="checkbox" v-model="genOn" @change="toggleGenerate"> Generate</label>
            <input v-expo-step type="number" min="20" max="20000" step="1" v-model.number="genHz"> <span class="unit">Hz</span>
          </div>
        </div>
      </div>

      <!-- vertical splitter: drag to resize the left panel; toggle collapses it -->
      <div class="split-v" title="Drag to resize the left panel" @pointerdown="onNavSplitDown" @dblclick="navCollapsed = !navCollapsed">
        <button class="split-toggle" :title="navCollapsed ? 'Expand the left panel (Projects / Signal Generator)' : 'Collapse the left panel to give the graph more width'"
                @pointerdown.stop @click="navCollapsed = !navCollapsed">{{ navCollapsed ? '›' : '‹' }}</button>
      </div>

      <!-- top-right quadrant: graph -->
      <div class="graph-area">
        <button class="chart-max-btn" :title="chartMax ? 'Restore the normal layout (bring back the side and bottom panels)' : 'Maximise the chart over the whole page — the toolbar stays, so the chart type can still be changed'"
                @click="chartMax = !chartMax">{{ chartMax ? '⤡' : '⛶' }}</button>
        <div class="graph-wrap">
          <GraphPanel v-if="!pending && !chartUnavailable" :tabId="chartTab" :bare="true" :primaryColor="WINISD_TRACE" />
          <div v-else class="graph-empty">
            <template v-if="pending">
              <div class="graph-empty-h">{{ boxLabel }}</div>
              <p>Response model pending — this enclosure type isn't modelled by the engine yet, so no curve is drawn.</p>
            </template>
            <template v-else>
              <div class="graph-empty-h">{{ chartLabel }}</div>
              <p>This chart isn't available in the engine yet.</p>
            </template>
          </div>
        </div>
      </div>

      <!-- horizontal splitter: drag to resize the bottom section; toggle collapses it -->
      <div class="split-h" title="Drag to resize the bottom section" @pointerdown="onBottomSplitDown" @dblclick="bottomCollapsed = !bottomCollapsed">
        <button class="split-toggle" :title="bottomCollapsed ? 'Expand the bottom section (project tabs)' : 'Collapse the bottom section to give the graph more height'"
                @pointerdown.stop @click="bottomCollapsed = !bottomCollapsed">{{ bottomCollapsed ? '˄' : '˅' }}</button>
      </div>

      <!-- bottom-left quadrant: tab rail -->
      <div class="quad-bottomleft">
        <div class="panel-title">Project</div>
        <ul class="project-nav">
          <li :class="{ active: activeTab === 'box' }" @click="activeTab = 'box'">Box</li>
          <li :class="{ active: activeTab === 'driver' }" @click="activeTab = 'driver'">Driver</li>
          <li v-if="showEnclosureTab" :class="{ active: activeTab === 'enclosure' }" @click="activeTab = 'enclosure'">{{ enclosureNavLabel }}</li>
          <li :class="{ active: activeTab === 'filters' }" @click="activeTab = 'filters'">Filters</li>
          <li :class="{ active: activeTab === 'signal' }" @click="activeTab = 'signal'">Signal</li>
          <li :class="{ active: activeTab === 'advanced' }" @click="activeTab = 'advanced'">Advanced</li>
          <li :class="{ active: activeTab === 'project' }" @click="activeTab = 'project'">Project</li>
        </ul>
        <div class="color-btn" :style="{ background: WINISD_TRACE }" title="Click to cycle the current design's curve colour" @click="cycleColor">Color</div>
      </div>

      <!-- bottom-right quadrant: 7 tabs -->
      <div class="content-panel">
        <div class="parstate-legend">
          <div class="unsaved-indicator">
            <span v-if="isModified" class="unsaved-label" title="This project has unsaved changes."><span class="unsaved-dot"></span>Unsaved changes</span>
            <button class="save-btn" :class="{ dirty: isModified }"
                    title="Save Changes — adopt the current design as the saved (ground) state." @click="markProjectSaved">Save Changes</button>
            <button class="save-btn"
                    title="Reset state — discard all unsaved changes and return to the last saved version." @click="resetProjectToGround">Reset state</button>
            <button class="save-btn" title="Export the driver as a WinISD .wdr file." @click="exportWdr">Export .wdr</button>
          </div>
          <div class="parstate-swatches">
            <span><span class="swatch green"></span>Entered</span>
            <span><span class="swatch blue"></span>Calculated</span>
            <span><span class="swatch black"></span>Not available</span>
          </div>
        </div>

        <!-- ===== Box tab ===== -->
        <section v-show="activeTab === 'box'" class="tab-section" :class="{ active: activeTab === 'box' }">
          <div class="field-row">
            <div class="field" style="gap:8px;"><label style="width:auto;">Box Type</label>
              <select id="og-box-type" v-model="selectedBox" style="width:240px">
                <option v-for="o in BOX_OPTIONS" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </div>
          </div>

          <div class="box-layout">
            <div v-if="!isDual" class="box-fields-col">
              <div class="section-header">Rear chamber</div>
              <div class="field-row">
                <div class="field entered"><label>Volume</label><NumInput v-model="state.P.Vb" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div>
              </div>
              <div class="field-row">
                <div class="field"><label>{{ selectedBox === 'sealed' ? 'Fsc' : 'Fh' }}</label><input class="calculated greyed" :value="fmtU(rearResonance, 'rearResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="rearResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
              </div>
              <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
            </div>

            <template v-else>
              <div class="box-fields-col">
                <div class="section-header">Rear chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput v-model="state.P.Vb" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row"><div class="field"><label>{{ selectedBox === 'bandpass4' ? 'Frc' : 'Tuning freq' }}</label><input class="calculated greyed" :value="fmtU(rearResonance, 'rearResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="rearResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div></div>
                <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
              </div>
              <div class="box-fields-col">
                <div class="section-header">Front chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput v-model="state.P.Vf" field="Vf" group="volume" base="L" :precision="fieldDp('Vf')" /><UnitToggle field="Vf" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row"><div class="field"><label>Tuning freq</label><input class="calculated greyed" :value="fmtU(frontTuning, 'frontTuning', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="frontTuning" group="freq" base="Hz" unit-class="unit unit-cyc" /></div></div>
              </div>
            </template>

            <div class="box-fields-spacer" v-if="!isDual"></div>
            <div class="box-diagram-col">
              <svg v-show="selectedBox === 'sealed'" id="og-box-diagram-sealed" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="190" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'vented'" id="og-box-diagram-vented" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="150" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="100" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="100" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,70 L130,90 L130,130 L160,150" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="100" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'pr'" id="og-box-diagram-pr" viewBox="0 0 200 300" height="120">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="60" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="130" x2="160" y2="170" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="240" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,60 L130,75 L130,115 L160,130" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="85" width="20" height="20" fill="#0F4761"/>
                <path d="M160,170 L130,185 L130,225 L160,240" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass4'" id="og-box-diagram-bandpass4" viewBox="0 0 200 300" height="130">
                <polyline points="160,200 160,40 40,40 40,260 160,260 160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass6'" id="og-box-diagram-bandpass6" viewBox="0 0 200 300" height="130">
                <line x1="40" y1="40" x2="160" y2="40" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="260" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="40" x2="40" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="100" x2="40" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="70" x2="80" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="40" y1="100" x2="80" y2="100" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'abc'" id="og-box-diagram-abc" viewBox="0 0 200 300" height="130">
                <path d="M 100,20 L 100,140 M 75,140 L 125,140 M 100,180 L 100,280 M 75,180 L 125,180" fill="none" stroke="#0F4761" stroke-width="4"/>
                <path d="M 100,20 L 40,20 L 40,70 L 80,70" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 80,100 L 40,100 L 40,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 100,20 L 160,20 L 160,60" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 160,130 L 160,210 L 120,210" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 120,240 L 160,240 L 160,280 L 100,280" fill="none" stroke="#0F4761" stroke-width="4" stroke-linejoin="miter"/>
                <path d="M 160,60 L 130,75 L 130,115 L 160,130 Z" fill="#A0B8C6" stroke="#0F4761" stroke-width="3" stroke-linejoin="round"/>
                <rect x="115" y="80" width="15" height="30" fill="#0F4761"/>
                <rect x="100" y="88" width="15" height="14" fill="#0F4761"/>
              </svg>
            </div>
          </div>
          <p v-if="selectedBox === 'abc'" class="hint" style="margin-top:8px;">ABC's driver mounts on the outer baffle, firing straight into the room — unlike 4th/6th order bandpass, where the driver is fully enclosed and fires only into the two internal chambers.</p>
          <p v-if="pending" class="hint" style="margin-top:8px; color:#7a5b1a;"><b>Response model pending.</b> The engine doesn't model this enclosure type yet — the diagram and chamber volumes are editable, but no curve is computed.</p>
        </section>

        <!-- ===== Driver tab ===== -->
        <section v-show="activeTab === 'driver'" class="tab-section" :class="{ active: activeTab === 'driver' }">
          <div class="field-row driver-id-row">
            <div class="field tight"><label>Brand</label><input type="text" style="width:130px" :value="brand" readonly></div>
            <div class="field tight"><label>Model</label><input type="text" style="width:140px" :value="model" readonly></div>
            <button class="edit-btn" title="Swap in a different driver for this project." @click="state.browseOpen = true">Select Driver</button>
            <button class="edit-btn" title="Full editor for this driver in the current project." @click="startEdit">&#9998; Edit</button>
            <button class="edit-btn" title="Reactive minimal editor: tweak headline T/S params and watch the graph." @click="startTune">&#9835; Tune</button>
          </div>
          <div class="two-col" style="margin-top:10px;">
            <div style="--label-w:150px;">
              <div class="section-header">Placement</div>
              <div class="field-row">
                <div class="field"><label>Num. of drivers</label>
                  <select v-model.number="state.P.nDrivers"><option v-for="n in 8" :key="n" :value="n">{{ n }}</option></select>
                  <span>driver(s)</span>
                </div>
              </div>
              <div class="radio-group field-row">
                <label><input type="radio" name="og-placement" value="standard" v-model="placement"> Standard</label>
                <label><input type="radio" name="og-placement" value="iso" v-model="placement" disabled> Iso-Barik <em style="color:#999">(not modelled)</em></label>
              </div>
              <div class="field-row">
                <div class="field"><label>Voice coil connection</label>
                  <select v-model="state.P.wiring"><option value="parallel">Parallel</option><option value="series">Series</option></select>
                </div>
              </div>
            </div>
            <div style="--label-w:172px;">
              <div class="section-header">Advanced options</div>
              <div class="field-row"><div class="field entered"><label>Voice coil temp rise</label><NumInput v-model="state.P.vcTempRise" field="vcTempRise" group="tempDiff" base="K" :precision="fieldDp('vcTempRise')" /><UnitToggle field="vcTempRise" group="tempDiff" base="K" unit-class="unit" /></div></div>
              <div class="field-row"><div class="field entered"><label>Voice coil resistance TC</label><NumInput v-model="state.P.alfaVC" field="alfaVC" group="tempCoeff" base="perMilliK" :precision="fieldDp('AlfaVC')" /><UnitToggle field="alfaVC" group="tempCoeff" base="perMilliK" unit-class="unit" /></div></div>
              <div class="field-row"><div class="field entered"><label>Added mass to cone</label><NumInput v-model="state.P.driverAddedMass" field="driverAddedMass" group="mass" base="g" :precision="fieldDp('driverAddedMass')" /><UnitToggle field="driverAddedMass" group="mass" base="g" unit-class="unit" /></div></div>
              <p class="hint">Temp rise × resistance TC model voice-coil power compression; added mass raises Mms (lowers Fs). WinISD parity.</p>
            </div>
          </div>
        </section>

        <!-- ===== Enclosure / Vents tab ===== -->
        <section v-show="activeTab === 'enclosure'" class="tab-section" :class="{ active: activeTab === 'enclosure' }">
          <!-- vented -->
          <div v-if="selectedBox === 'vented'" style="--label-w:120px;">
            <div class="section-header">Vents</div>
            <div class="two-col">
              <div>
                <div class="field-row">
                  <div class="field"><label>Number of Vents</label><select><option>1</option><option>2</option></select></div>
                  <div class="field"><label>Shape</label><svg width="22" height="22"><circle cx="11" cy="11" r="9" fill="none" stroke="#1868d1" stroke-width="2"/></svg> round</div>
                </div>
                <div class="field-row">
                  <div class="field entered"><label>Vent diameter</label><NumInput v-model="state.P.ventD" field="ventD" group="length" base="cm" :precision="fieldDp('ventD')" /><UnitToggle field="ventD" group="length" base="cm" unit-class="unit unit-cyc" /></div>
                  <div class="field entered"><label>Vent length</label><NumInput v-model="state.P.ventL" field="ventL" group="length" base="cm" :precision="fieldDp('ventL')" /><UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" /></div>
                </div>
                <div class="field-row">
                  <div class="field entered"><label>End Correction</label>
                    <select v-model.number="state.P.endCorrection" style="width:190px">
                      <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <div class="field-row">
                  <div class="field"><label>Cross area</label><input class="calculated greyed" :value="fmtU(ventArea, 'ventArea', 'area', 'm2', fieldDp('ventCrossArea'))" readonly><UnitToggle field="ventArea" group="area" base="m2" unit-class="unit" /></div>
                </div>
                <div class="field-row">
                  <div class="field"><label>1st port resonance</label><input class="calculated greyed" :value="fmtU(portPipeResonance, 'portResonance', 'freq', 'Hz', fieldDp('portResonance'))" readonly><UnitToggle field="portResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
            </div>
          </div>

          <!-- passive radiator -->
          <div v-else-if="selectedBox === 'pr'">
            <div class="two-col">
              <div style="--label-w:44px;">
                <div class="section-header">Passive radiator parameters</div>
                <div class="field-row">
                  <div class="field"><label>Vas</label><input class="calculated greyed" :value="fmtU(prVas != null ? prVas / 1000 : null, 'prVas', 'volume', 'L', fieldDp('prVas'))" readonly><UnitToggle field="prVas" group="volume" base="L" unit-class="unit unit-cyc" /></div>
                  <div class="field"><label>Qms</label><input class="calculated greyed" :value="fmt(prQms, fieldDp('prQms'))" readonly></div>
                </div>
                <div class="field-row">
                  <div class="field"><label>Fs</label><input class="calculated greyed" :value="fmtU(prFs, 'prFs', 'freq', 'Hz', fieldDp('prFs'))" readonly><UnitToggle field="prFs" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                  <div class="field entered"><label>Sd</label><NumInput v-model="state.P.prSd" field="prSd" group="area" base="cm2" :precision="fieldDp('prSd')" /><UnitToggle field="prSd" group="area" base="cm2" unit-class="unit unit-cyc" /></div>
                </div>
                <div class="field-row">
                  <div class="field entered"><label>Xmax</label><NumInput v-model="state.P.prXmax" field="prXmax" group="length" base="mm" :precision="fieldDp('prXmax')" /><UnitToggle field="prXmax" group="length" base="mm" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
              <div style="--label-w:150px;">
                <div class="section-header">User options</div>
                <div class="field-row"><div class="field entered"><label>Num. of PRs:</label><NumInput v-model="state.P.prNum" :scale="1" :precision="fieldDp('prNum')" /></div></div>
                <div class="field-row"><div class="field entered"><label>Added mass to cone:</label><NumInput v-model="state.P.prMadd" field="prMadd" group="mass" base="g" :precision="fieldDp('prMadd')" /><UnitToggle field="prMadd" group="mass" base="g" unit-class="unit" /></div></div>
                <div class="field-row"><div class="field"><label>Fs (with added mass):</label><input class="calculated greyed" :value="fmtU(prFsMass, 'prFsMass', 'freq', 'Hz', fieldDp('prFsMass'))" readonly><UnitToggle field="prFsMass" group="freq" base="Hz" unit-class="unit" /></div></div>
              </div>
            </div>
          </div>

          <!-- bandpass4: single front vent (real) -->
          <div v-else-if="selectedBox === 'bandpass4'">
            <div class="section-header">Vents</div>
            <div class="vent-groups">
              <div class="vent-col">
                <div class="vent-col-title">Front chamber</div>
                <div class="field-row"><div class="field"><label>Number of Vents</label><select><option>1</option><option>2</option></select></div></div>
                <div class="field-row"><div class="field entered"><label>Diameter</label><NumInput v-model="state.P.ventD" field="ventD" group="length" base="cm" :precision="fieldDp('ventD')" /><UnitToggle field="ventD" group="length" base="cm" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row"><div class="field entered"><label>Length</label><NumInput v-model="state.P.ventL" field="ventL" group="length" base="cm" :precision="fieldDp('ventL')" /><UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row"><div class="field"><label>Resonance</label><input class="calculated greyed" :value="fmtU(ventFb, 'ventFb', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="ventFb" group="freq" base="Hz" unit-class="unit" /></div></div>
              </div>
            </div>
          </div>

          <!-- closed box: no vents -->
          <div v-else-if="selectedBox === 'sealed'">
            <div class="section-header">Rear chamber</div>
            <div class="field-row">
              <div class="field entered"><label>Volume</label><NumInput v-model="state.P.Vb" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div>
              <div class="field"><label>Fh</label><input class="calculated greyed" :value="fmtU(rearResonance, 'rearResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="rearResonance" group="freq" base="Hz" unit-class="unit" /></div>
            </div>
            <p class="hint">Closed enclosure — no vents or passive radiator configured.</p>
          </div>

          <!-- bandpass6 / abc: vents shown, pending (no engine model) -->
          <div v-else>
            <div class="section-header">Vents</div>
            <p class="hint" style="margin-bottom:8px; color:#7a5b1a;"><b>Response model pending.</b> These vent fields are shown for parity but are not yet wired to the engine for this enclosure type.</p>
            <div class="vent-groups">
              <div class="vent-col">
                <div class="vent-col-title">Rear chamber</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="8.00" disabled><span class="unit">cm</span></div></div>
              </div>
              <div class="vent-col">
                <div class="vent-col-title">Front chamber</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="9.00" disabled><span class="unit">cm</span></div></div>
              </div>
              <div v-if="selectedBox === 'abc'" class="vent-col">
                <div class="vent-col-title">Intrachamber</div>
                <div class="vent-col-hint">Connects the chambers — not open to the outside.</div>
                <div class="field-row"><div class="field"><label>Diameter</label><input type="text" class="greyed" value="6.00" disabled><span class="unit">cm</span></div></div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== Filters tab — mock-styled OgFilters, wired to the same state.P.filters ===== -->
        <section v-show="activeTab === 'filters'" class="tab-section" :class="{ active: activeTab === 'filters' }">
          <OgFilters />
        </section>

        <!-- ===== Signal tab ===== -->
        <section v-show="activeTab === 'signal'" class="tab-section" :class="{ active: activeTab === 'signal' }">
          <div class="two-col">
            <div style="--label-w:60px;">
              <div class="section-header">Listening place</div>
              <div class="field-row"><div class="field"><label>Distance</label><input type="text" class="greyed" value="1.000" disabled><span class="unit">m</span></div></div>
              <div class="field-row"><div class="field"><label>Angle</label><input type="text" class="greyed" value="0.0000" disabled><span class="unit">rad</span></div></div>
              <p class="hint">Listening distance/angle are not modelled yet.</p>
            </div>
            <div style="--label-w:186px;">
              <div class="section-header">Signal source</div>
              <div class="field-row"><div class="field entered"><label>System input power</label><NumInput v-model="state.P.Pin" :scale="1" :precision="fieldDp('Pin')" /><span class="unit">W</span></div></div>
              <div class="field-row"><div class="field entered"><label>Driver input voltage (each)</label><NumInput v-model="driveV" :scale="1" :precision="fieldDp('driveV')" /><span class="unit">V</span></div></div>
              <div class="field-row"><div class="field entered"><label>Series resistance</label><NumInput v-model="state.P.Rs" :scale="1" :precision="fieldDp('Rs')" /><span class="unit">ohm</span></div></div>
            </div>
          </div>
        </section>

        <!-- ===== Advanced tab ===== -->
        <section v-show="activeTab === 'advanced'" class="tab-section" :class="{ active: activeTab === 'advanced' }">
          <div class="two-col">
            <div style="--label-w:118px;">
              <div class="field-row"><div class="field entered"><label>Temperature</label><NumInput v-model="advTemp" field="advTemp" group="temp" base="K" :precision="2" /><UnitToggle field="advTemp" group="temp" base="K" unit-class="unit unit-cyc" /></div></div>
              <div class="field-row"><div class="field entered"><label>Relative humidity</label><input v-expo-step type="number" v-model.number="advHumidity"><span class="unit">%</span></div></div>
              <div class="field-row"><div class="field entered"><label>Air pressure</label><NumInput v-model="advPressure" field="advPressure" group="pressure" base="Pa" :precision="1" /><UnitToggle field="advPressure" group="pressure" base="Pa" unit-class="unit unit-cyc" /></div></div>
              <p style="margin:4px 0;">&#8594;</p>
              <div class="field-row"><div class="field"><label>Sound velocity</label><input class="calculated greyed" :value="fmt(advSoundVelocity, fieldDp('advSoundVelocity'))" readonly><span class="unit">m/s</span></div></div>
              <div class="field-row"><div class="field"><label>Air density</label><input class="calculated greyed" :value="RHO.toFixed(fieldDp('advAirDensity'))" readonly><span class="unit">kg/m³</span></div></div>
            </div>
            <div class="checkbox-col">
              <label><input type="checkbox" v-model="advChecks.vc"> Simulate voice coil inductance</label>
              <label><input type="checkbox" v-model="advChecks.flat"> Force flat response</label>
              <label><input type="checkbox" v-model="advChecks.tl"> Use "transmission line"-model for port simulation</label>
              <label><input type="checkbox" v-model="advChecks.rg"> Rg is at driver side</label>
              <label><input type="checkbox" v-model="advChecks.xmax"> SPL graph is Xmax limited</label>
              <p class="hint">Environment &amp; these options are not modelled by the sweep yet.</p>
            </div>
          </div>
        </section>

        <!-- ===== Project tab ===== -->
        <section v-show="activeTab === 'project'" class="tab-section" :class="{ active: activeTab === 'project' }">
          <div class="field-row"><div class="field"><label>Name</label><input type="text" style="width:200px" v-model="state.project.name"></div></div>
          <div class="field-row"><div class="field"><label>Creator</label><input type="text" style="width:200px" v-model="state.project.creator"></div></div>
          <div class="field-row"><div class="field"><label>Created</label><input type="text" style="width:120px" v-model="state.project.created"></div></div>
          <div class="field-row"><div class="field"><label>Modified</label><input type="text" style="width:120px" v-model="state.project.modified"></div></div>
          <label>Description</label>
          <textarea class="description" rows="6" v-model="state.project.description"></textarea>
        </section>
      </div>
    </div>

    <!-- ===== Box losses modal (real: Ql / Qa / Qp) ===== -->
    <div class="overlay" :class="{ open: boxLossesOpen }" @click.self="boxLossesOpen = false">
      <div class="modal narrow">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Box losses</span></div>
          <div class="win-controls"><span class="close-btn" @click="boxLossesOpen = false">&#10005;</span></div>
        </div>
        <div class="modal-body">
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Leakage Ql</label><NumInput v-model="state.P.Ql" :scale="1" :precision="fieldDp('Ql')" /></div></div>
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Absorption Qa</label><NumInput v-model="state.P.Qa" :scale="1" :precision="fieldDp('Qa')" /></div></div>
          <div class="field-row" v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'"><div class="field entered" style="--label-w:130px"><label>Port Qp</label><NumInput v-model="state.P.Qp" :scale="1" :precision="fieldDp('Qp')" /></div></div>
          <p class="hint">100 = no stuffing · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100.</p>
        </div>
        <div class="modal-footer">
          <span class="hint">Changes apply live to the graph.</span>
          <div class="footer-buttons"><button class="ok-btn" @click="boxLossesOpen = false">OK</button></div>
        </div>
      </div>
    </div>

    <!-- ===== Tune (mock-styled docked What-If) + full Driver editor (shared, for now) ===== -->
    <OgTune v-if="state.editDriver" />
    <DriverEditorModal v-if="state.editDriverInfo" @close="state.editDriverInfo = false" />
    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />
    <OgNewProject v-if="newProjectOpen" @close="newProjectOpen = false" />

    <input ref="fileInput" type="file" accept=".wdr,.json" style="display:none" @change="onFile">
  </div>
</template>

<style scoped>
/* Ported wholesale from mock/style.css — same class names, layout and chrome, so the
   Original skin renders identically to the mock. The only additions are the WinISD-light
   palette + --chart-* custom properties (so the shared GraphPanel/canvas render light with
   no fork) and `:deep(input)` rules so the shared NumInput's inner <input> picks up the
   mock's `.field` field styling. */
.original-root *, .original-root *::before, .original-root *::after { box-sizing: border-box; }
.original-root {
  /* Light-theme palette overrides — like .classic-root. Without these, reused
     components + the global `button { color: var(--fg) }` reset inherit the app's
     dark-theme --fg (near-white) and render invisibly on the skin's light fills. */
  --bg:#f2f2f2; --panel:#f7f7f7; --panel2:#ececec; --line:#bbb;
  --fg:#1a1a1a; --mut:#555; --acc:#1868d1; --acc2:#b8790f; --good:#1b7d1b; --bad:#b02a2a;
  --chart-bg:#ffffff; --chart-grid:#dde3ea; --chart-text:#5a6b7b;
  --chart-cross:#00000055; --chart-band:rgba(0,0,0,0.05); --chart-band-line:rgba(0,0,0,0.3);
  --readout-bg:rgba(248,250,252,0.92);
  display:flex; flex-direction:column; width:100%; height:100vh; background:#f2f2f2;
  overflow:hidden; color:#1a1a1a; font-family:"Segoe UI", Tahoma, Arial, sans-serif; font-size:14px;
}
.original-root button, .original-root select, .original-root input, .original-root textarea { font-family:inherit; font-size:14px; }

/* ---------- Title bar ---------- */
.titlebar { display:flex; align-items:center; justify-content:space-between; background:#e9e9e9; border-bottom:1px solid #bbb; padding:6px 10px; font-size:15px; }
.titlebar .tb-left { display:flex; align-items:center; gap:8px; }
.app-icon { width:20px; height:20px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #888, #333 70%); display:inline-block; }
.titlebar .win-controls { display:flex; gap:14px; color:#555; font-size:15px; }
.titlebar .win-controls span { cursor:pointer; padding:2px 6px; }
.titlebar .win-controls span:hover { background:#dcdcdc; }
.titlebar .win-controls .close-btn:hover { background:#e64545; color:#fff; }

/* ---------- Toolbar ---------- */
.toolbar { display:flex; align-items:center; justify-content:space-between; background:#eee; border-bottom:1px solid #bbb; padding:4px 12px; }
.tb-icons { display:flex; align-items:center; gap:6px; }
.tb-btn { display:flex; align-items:center; justify-content:center; width:34px; height:30px; background:#f7f7f7; border:1px solid #bbb; border-radius:3px; cursor:pointer; position:relative; }
.tb-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.tb-btn.disabled { opacity:.4; cursor:default; }
.tb-btn.disabled:hover { background:#f7f7f7; border-color:#bbb; }
.tb-sep { width:1px; align-self:stretch; background:#ccc; margin:0 4px; }
.tb-btn svg { display:block; }
.caret { font-size:10px; margin-left:2px; color:#555; }
.chart-select { display:flex; align-items:center; gap:6px; border:1px solid #bbb; border-radius:3px; background:#fff; padding:4px 8px; cursor:pointer; position:relative; user-select:none; }
.chart-select:hover { border-color:#7fb3ff; }
.chart-select .chart-name { font-weight:600; }
.cursor-readout { line-height:1; color:#222; font-size:14px; cursor:default; display:flex; flex-direction:row; align-items:center; gap:12px; white-space:nowrap; }
.cursor-readout .ro-hz, .cursor-readout .ro-val { font-variant-numeric:tabular-nums; }
.cursor-readout .ro-val { min-width:76px; text-align:right; }
.cursor-readout :deep(.skin-picker) { margin-top:0; }

/* dropdown menus */
.dropdown-menu { display:none; position:absolute; top:34px; left:0; background:#fdfdfd; border:1px solid #999; box-shadow:2px 3px 8px rgba(0,0,0,.25); z-index:50; min-width:260px; padding:4px 0; max-height:calc(100vh - 90px); overflow-y:auto; }
.dropdown-menu.open { display:block; }
.dropdown-menu .menu-item { padding:6px 14px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; }
.dropdown-menu .menu-item:hover { background:#dbeaff; }
.dropdown-menu .menu-item.current::before { content:"\25CF"; font-size:8px; color:#222; width:10px; display:inline-block; }
.dropdown-menu .menu-item:not(.current)::before { content:""; width:10px; display:inline-block; }
.dropdown-menu hr { border:none; border-top:1px solid #ddd; margin:4px 0; }

/* ---------- Main: 2x2 quadrants + draggable splitters ---------- */
/* Track sizes come from the inline mainStyle (state.ui.originalNavW/originalBottomH,
   0px when a panel is collapsed); these template values are only the no-JS fallback. */
.main { display:grid; grid-template-columns:250px 7px 1fr; grid-template-rows:1fr 7px 290px;
  grid-template-areas:"nav vsplit graph" "hsplit hsplit hsplit" "rail . content";
  flex:1 1 auto; min-height:0; overflow:hidden; }
.quad-topleft { grid-area:nav; background:#f7f7f7; display:flex; flex-direction:column; padding:10px; gap:10px; overflow-y:auto; overflow-x:hidden; min-height:0; min-width:0; }
/* splitters — the drag handles between the panels; each carries a collapse toggle */
/* The collapse toggle sits at the splitter's START edge (top / left), away from the
   middle where a resize drag naturally grabs — a centred toggle would swallow the drag. */
.split-v { grid-area:vsplit; cursor:col-resize; background:#e6e6e6; border-left:1px solid #ccc; border-right:1px solid #ccc; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding-top:10px; touch-action:none; }
.split-h { grid-area:hsplit; cursor:row-resize; background:#e6e6e6; border-top:1px solid #ccc; border-bottom:1px solid #ccc; display:flex; align-items:center; justify-content:flex-start; padding-left:10px; touch-action:none; }
.split-v:hover, .split-h:hover { background:#cfe0f5; }
.split-toggle { border:none; background:#bbb; color:#333; border-radius:2px; cursor:pointer; font-size:9px; line-height:1; padding:0; display:grid; place-items:center; }
.split-v .split-toggle { width:7px; height:46px; }
.split-h .split-toggle { height:7px; width:46px; }
.split-toggle:hover { background:#7fb3ff; color:#fff; }
/* collapsed panels: the grid track is 0px (mainStyle); hide the content so padding
   doesn't leave a sliver. The splitter (with its expand toggle) stays visible. */
.main.nav-collapsed .quad-topleft, .main.nav-collapsed .quad-bottomleft { display:none; }
.main.bottom-collapsed .quad-bottomleft, .main.bottom-collapsed .content-panel { display:none; }
/* chart maximised: only the graph area renders; the toolbar above is untouched so the
   chart type can still be changed while maximised. */
.main.chart-max { grid-template-columns:1fr; grid-template-rows:1fr; grid-template-areas:"graph"; }
.main.chart-max .quad-topleft, .main.chart-max .quad-bottomleft, .main.chart-max .content-panel,
.main.chart-max .split-v, .main.chart-max .split-h { display:none; }
.chart-max-btn { position:absolute; top:14px; right:20px; z-index:5; width:26px; height:24px;
  background:#f7f7f7; border:1px solid #999; border-radius:3px; cursor:pointer; font-size:13px;
  line-height:1; display:grid; place-items:center; opacity:.75; }
.chart-max-btn:hover { opacity:1; background:#dbeaff; border-color:#7fb3ff; }
/* overflow:visible + a stacking context ABOVE the content panel lets the active
   tab extend past the column edge and paint over the panel's left spine, so it
   reads as one continuous shape with the panel (the break-through notch). */
.quad-bottomleft { grid-area:rail; background:#e2e2e2; display:flex; flex-direction:column; padding:8px 0 8px 8px; min-height:0; min-width:0; overflow:visible; position:relative; z-index:3; }
.quad-bottomleft .panel-title, .quad-bottomleft .color-btn { margin-right:8px; flex:none; }
.panel-title { color:#7d9fc9; font-weight:600; margin-bottom:2px; }
.quad-projects-wrap { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
.quad-signalgen-wrap { flex:none; }
.projects-list { flex:1 1 auto; min-height:60px; border:1px solid #bbb; background:#fff; overflow-y:auto; }
.project-row { display:flex; align-items:center; gap:6px; padding:5px 6px; cursor:pointer; border-bottom:1px solid #eee; }
.project-row:hover { background:#eef4ff; }
.project-row.selected { background:#1868d1; color:#fff; }
.project-row input[type=checkbox] { accent-color:#1868d1; }
.project-row span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.project-row.trace-hidden span { opacity:.45; text-decoration:line-through; }
/* ✕ remove sits LEFT of the name (visible at rest — a right-side hover-reveal was too
   easy to miss); the current-design row carries a same-width spacer so names align. */
.row-remove { flex:none; width:16px; border:none; background:none; color:#b02a2a; cursor:pointer; padding:0; font-size:12px; line-height:1; opacity:.55; }
.project-row:hover .row-remove { opacity:1; }
.row-remove:hover { color:#fff; background:#e64545; border-radius:3px; }
.row-remove-spacer { flex:none; width:16px; }
.signal-gen-row { display:flex; align-items:center; gap:8px; }
.signal-gen-row input[type=number] { width:70px; }
.project-nav { list-style:none; margin:0; padding:2px 0 0; position:relative; flex:none; }
/* Book-of-tabs: inactive tabs stop at the panel's left spine; the active tab
   shares the panel's fill and breaks 2px through the spine so it reads as a
   physical notch of the panel. The panel's #888 left border is the unifying
   vertical line the tabs hang off. */
.project-nav li { position:relative; background:#e4e4e4; border:1px solid #888; border-right:none; border-radius:7px 0 0 7px; padding:5px 8px 5px 12px; line-height:1.3; margin:0 0 -1px 0; cursor:pointer; z-index:1; box-shadow:inset -6px 0 6px -6px rgba(0,0,0,.12); }
.project-nav li:hover:not(.active) { background:#dbeaff; }
/* Active tab flares OUT into the panel with concave fillets (top-right + bottom-
   right), like a notebook tab, rather than convex corners poking in. The fillets
   are pseudo-elements: a rounded transparent box whose box-shadow spreads the
   panel fill around the curve, carving the concave. */
.project-nav li.active { background:#f7f7f7; font-weight:600; border-radius:7px 0 0 7px; margin-right:-2px; padding-right:14px; z-index:2; box-shadow:none; }
.project-nav li.active::before,
.project-nav li.active::after {
  content:""; position:absolute; right:-1px; width:8px; height:8px; background:transparent;
}
.project-nav li.active::before { top:-8px; border-bottom-right-radius:8px; box-shadow:3px 3px 0 3px #f7f7f7; }
.project-nav li.active::after  { bottom:-8px; border-top-right-radius:8px; box-shadow:3px -3px 0 3px #f7f7f7; }
.color-btn { margin-top:auto; border:1px solid #999; padding:8px; text-align:center; cursor:pointer; font-weight:600; }
.color-btn:hover { filter:brightness(1.05); }
.graph-area { grid-area:graph; position:relative; flex:1 1 auto; min-width:0; min-height:0; padding:8px 14px; display:flex; flex-direction:column; }
.graph-wrap { flex:1 1 auto; min-height:0; border:1px solid #999; background:#fff; position:relative; display:flex; }
.graph-wrap :deep(.gpanel) { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
.graph-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; color:#777; gap:6px; }
.graph-empty-h { font-size:16px; font-weight:600; color:#333; }

/* ---------- Content panel ---------- */
.content-panel { grid-area:content; background:#f7f7f7; border:1px solid #888; border-radius:0 6px 6px 0; padding:10px 16px; overflow:hidden; display:flex; flex-direction:column; min-height:0; min-width:0; position:relative; z-index:0; }
.tab-section { display:none; }
.tab-section.active { display:block; flex:1 1 auto; min-height:0; overflow-y:auto; }
.section-header { background:#e2e2e2; border:1px solid #ccc; padding:4px 10px; font-weight:600; margin-bottom:8px; }
.two-col { display:flex; gap:24px; align-items:flex-start; justify-content:flex-start; }
.two-col > div { flex:0 1 auto; min-width:0; }
.box-layout { display:flex; gap:24px; align-items:flex-start; }
.box-fields-col { flex:none; width:194px; --label-w:62px; }
.box-layout .box-diagram-col { flex:none; width:130px; display:flex; align-items:center; justify-content:center; }
.box-fields-spacer { flex:none; width:194px; }
.vent-groups { display:flex; gap:20px; }
.vent-col { flex:1; min-width:0; }
.vent-col-title { font-weight:600; color:#444; margin-bottom:4px; }
.vent-col-hint { color:#888; font-size:11px; font-style:italic; margin-bottom:4px; }
.vent-col .field label { width:110px; }
.field-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; justify-content:flex-start; }
.field { display:flex; align-items:center; gap:6px; justify-content:flex-start; }
.field label { color:#333; display:inline-block; width:var(--label-w, 150px); text-align:left; }
.field input[type=text], .field input[type=number], .field select,
.field :deep(input) { border:1px solid #999; padding:4px 6px; border-radius:2px; background:#fff; width:90px; }
.field.tight label { width:auto; margin-right:2px; }
.driver-id-row { align-items:center; gap:10px; }
.field input.greyed { background:#e9e9e9; color:#777; }
.field input.calculated { color:#1868d1; border-color:#1868d1; }
.field.entered :deep(input), .field.entered input { color:#1b7d1b; border-color:#1b7d1b; }
.field .unit { color:#555; min-width:3.5em; }
textarea.comment, textarea.description { width:100%; border:1px solid #999; border-radius:2px; padding:6px; resize:vertical; }
.radio-group { display:flex; align-items:center; gap:14px; }
.radio-group label { display:flex; align-items:center; gap:4px; }
.edit-btn, .link-btn, .action-btn { background:#f0f0f0; border:1px solid #999; border-radius:3px; padding:4px 10px; cursor:pointer; }
.edit-btn:hover, .link-btn:hover, .action-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.link-btn { background:none; border:none; color:#1868d1; text-decoration:underline; padding:2px 0; }
.hint { color:#888; font-size:12px; font-style:italic; }
.checkbox-col { display:flex; flex-direction:column; gap:8px; }
.checkbox-col label { display:flex; align-items:center; gap:6px; }

/* filters tab fills the panel */
.tab-section.active :deep(.fpanel), .tab-section.active :deep(.filters) { min-height:0; }

/* unit-cycling label */
.unit-cyc { cursor:pointer; text-decoration:underline dotted; text-underline-offset:2px; }
.unit-cyc:hover { color:#1868d1; }

/* ---------- parstate legend + save bar ---------- */
.parstate-legend { flex:none; display:flex; gap:14px; align-items:center; font-size:12px; color:#444; justify-content:space-between; margin-bottom:8px; }
.parstate-swatches { display:flex; gap:14px; align-items:center; }
.parstate-legend .swatch { width:11px; height:11px; display:inline-block; margin-right:4px; border:1px solid #777; }
.parstate-legend .swatch.green { background:#1b7d1b; }
.parstate-legend .swatch.blue { background:#1868d1; }
.parstate-legend .swatch.black { background:#111; }
.unsaved-indicator { display:flex; align-items:center; gap:8px; }
/* OpenISD-only actions (not a WinISD feature) — kept deliberately small and muted
   so they don't dominate the panel like a native WinISD control would. */
.save-btn { border:1px solid #ccc; background:#f4f4f4; color:#666; font-weight:400; border-radius:3px; padding:1px 7px; cursor:pointer; font-size:11px; }
.save-btn:hover:not(:disabled) { background:#e9e9e9; color:#333; border-color:#aaa; }
.save-btn:disabled { opacity:.45; cursor:default; }
.save-btn.dirty { border-color:#d9a441; background:#fff3e0; color:#8a5a00; font-weight:600; }
.save-btn.dirty:hover:not(:disabled) { background:#ffe4b0; }
.unsaved-label { display:flex; align-items:center; gap:6px; color:#8a5a00; font-weight:600; font-size:12px; }
.unsaved-dot { width:8px; height:8px; border-radius:50%; background:#e0a800; display:inline-block; animation:unsaved-pulse 1.6s ease-in-out infinite; }
@keyframes unsaved-pulse { 0%, 100% { opacity:1; } 50% { opacity:.35; } }

/* ---------- Modal overlay ---------- */
.overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.18); z-index:100; align-items:flex-start; justify-content:center; }
.overlay.open { display:flex; }
.modal { margin-top:8vh; background:#f7f7f7; border:1px solid #888; box-shadow:3px 6px 18px rgba(0,0,0,.35); width:620px; max-width:92vw; }
.modal.narrow { width:460px; }
.modal-titlebar { display:flex; align-items:center; justify-content:space-between; background:#e9e9e9; border-bottom:1px solid #bbb; padding:8px 12px; font-size:15px; }
.modal-titlebar .tb-left { display:flex; align-items:center; gap:8px; }
.modal-titlebar .win-controls { display:flex; gap:12px; color:#555; }
.modal-titlebar .win-controls span { cursor:pointer; padding:1px 6px; }
.modal-titlebar .win-controls .close-btn:hover { background:#e64545; color:#fff; }
.modal-body { padding:16px 20px; max-height:65vh; overflow:auto; }
.modal-footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #ccc; padding:10px 20px; background:#eee; }
.footer-buttons { display:flex; gap:8px; }
.footer-buttons button { border:1px solid #999; background:#f0f0f0; border-radius:3px; padding:6px 14px; cursor:pointer; }
.footer-buttons button:hover { background:#dbeaff; border-color:#7fb3ff; }
.footer-buttons button.ok-btn { color:#1b7d1b; }
</style>
