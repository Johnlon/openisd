<script setup lang="ts">
declare const __PLATFORM_USER__: string | undefined;
/**
 * The shell — a faithful recreation of WinISD 0.7.0.950's window, wired to the store +
 * engine.
 *
 * Fidelity rule: the markup, class names, layout and chrome match WinISD's own screens
 * region by region (docs/winisd_screenshots/*.png). Every `.calculated` readout is a live engine
 * value and every `.entered` field is v-model-bound to the store — nothing on screen is a
 * literal standing in for physics.
 *
 * Box-type scope: the engine solver (packages/engine/src/circuit.ts) models four types
 * (sealed, vented, pr, bandpass4). 6th-order bandpass and ABC are ported as UI (diagram +
 * chamber/vent fields) but have no engine model yet, so they show an explicit "response
 * model pending" state instead of a fabricated curve. When the engine gains those
 * branches, add them to `SUPPORTED_BOX` and the pending state clears.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  state, driverName, persistedDriver,
  syncedP, curvesData, maxData,
  isModified, resetProjectToGround, groundCheckpoint, restoreGroundCheckpoint, markProjectSaved,
  managedProject,
  formatInUnit as fmtU,
  newProject,
} from '../../../logic/appState.js';
import { presentationState } from '../../../logic/presentationState.js';
import { createLiveRef } from '../../../logic/liveProject.js';
import {
  enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn,
  ventFieldState as ventFieldStateOn, ventMaxReachableFb as ventMaxReachableFbOn,
  ventTargetUnreachable as ventTargetUnreachableOn,
} from '../../../logic/useVentGroup.js';
import { toAlignmentKind } from '../../../logic/managedProject.js';

// The delegate-free reactivity adapter (`docs/design/REACTIVITY.md`): touching `live.value`
// inside a computed/watch registers a dependency that invalidates on every `managedProject`
// mutation, which is what makes calling its methods directly — instead of through a store
// wrapper or a flat field bag — reactive (ledger QO54).
const { live } = createLiveRef(managedProject);
import UnitToggle from '../../components/UnitToggle.vue';
import type { BoxType, SweepResult, MaxCurvesResult } from '@openisd/engine';
import type { Design, UiParams, ProjectMeta } from '../../../types.js';
import type { PRLibEntry, BundledPR } from '@openisd/persistence';
import { airForEnvironment, driveVoltageFor, parseLossMode, lossModeOptions, DEFAULT_RE_OHM } from '../../../logic/environment.js';
import { TAB_META, parseChartTabId, buildPlotData, DPAL } from '../../../logic/series.js';
import type { ChartTabId } from '../../../types.js';
import { copyOfName, uniqueName } from '../../../logic/projectFile.js';
import { createToneGenerator, type ToneGenerator } from '../../../logic/toneGenerator.js';
import { useApp } from '../../../logic/app.js';
import { useEscToClose } from '../../../logic/useEscToClose.js';
import { steppedFrequency, clampedFrequency, interpolatedY } from '../../../logic/cursorFrequency.js';
import GraphPanel from '../../components/GraphPanel.vue';
import NumInput from '../../components/NumInput.vue';
import ExportMenu from '../../components/ExportMenu.vue';
import ToolbarIcon from '../../components/ToolbarIcon.vue';
import { precision as fieldDp, limits, END_CORRECTION_OPTIONS } from '../../../logic/fields/fieldRegistry.js';
import OgFilters from './OgFilters.vue';
import OgTune from './OgTune.vue';
import OgNewProject from './OgNewProject.vue';
import PRBrowser from '../../components/PRBrowser.vue';
import PREditModal from '../../components/PREditModal.vue';
import PRDefineModal from '../../components/PRDefineModal.vue';
import OptionsModal from '../../components/OptionsModal.vue';
import AdvancedOptions from '../../components/AdvancedOptions.vue';

// Fixed set, not per-render data — hoisted so the template doesn't allocate a fresh array
// on every re-render.
const LOSS_MODE_OPTIONS = lossModeOptions();

const { designIO, selection } = useApp();
const { saveProject, importFile, about } = designIO;
const { editProjectDriver } = selection;

// WinISD's yellow-green plot line — the Original skin's default trace colour + Color swatch.
// The current design's trace colour. The Color button cycles it through a small
// palette (WinISD's yellow-green first) and it feeds the shared GraphPanel's
// primaryColor live.
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
// Volume, so it's dropped.
const showEnclosureTab = computed(() => selectedBox.value !== 'sealed');

// ---- Live engine-derived readouts (never faked literals) -----------------------
// Sealed-box (and PR rear-chamber) resonance + system Q via the selected loss model — the
// WinISD lossy cubic by default. NOT the impedance-magnitude peak: that scan returns the
// high-frequency voice-coil-inductance rise (≈20 kHz) as the GLOBAL |Z| maximum for any driver
// with Le, which is not the system resonance (and yields Qtc=0). See openspec core-engine
// "Sealed-Box Resonance Loss Models" and winisd_research/SEALED_FSC_MODEL.md.
const sealedRes = computed<{ Fsc: number; Qtc: number } | null>(() => {
  void live.value;
  return managedProject.sealedResonance(
    parseLossMode(presentationState.lossMode), managedProject.seriesResistance_ohm(),
    managedProject.boxQl(), managedProject.boxQa());
});
const rearResonance = computed<number | null>(() => sealedRes.value?.Fsc ?? null);
const rearQtc = computed<number | null>(() => sealedRes.value?.Qtc ?? null);
// WinISD's "Fh" for a PR box is the PASSIVE RADIATOR system tuning — the box compliance in
// series with the PR's own, against the PR's moving mass — NOT the sealed Fc above, which
// ignores the PR entirely. On WinISD's own controlled-trial inputs prTuning() returns 72.25 Hz,
// matching it exactly, where the sealed formula gives 194.87. winisd_research/GAPS.md §A3.
/** The Box pane's rear-chamber readout: the PR system tuning for a PR box, else sealed Fc. */
const boxResonance = computed<number | null>(() => {
  void live.value;
  return selectedBox.value === 'pr' ? managedProject.prSystemTuning_hz() : rearResonance.value;
});
// Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber
// tunes on its own front volume Vf. Same closed form the engine's circuit uses.
//
// No per-field write computeds here (ledger QO60/REACTIVITY.md: "no wrapper is written for
// Vb, or for any of the other eighteen") — every `v-model`/`@change` in the template below
// calls `managedProject`'s own getter/setter, or (for the vent-group fields) the TESTED
// `enterVentFieldOn`/`clearVentFieldOn` from `useVentGroup.js`, directly.
//
// The four below are READ-ONLY derived values shown in more than one place (E/C/N badges,
// warning banners) — genuinely DERIVED state, not a get+set mirror of a single field, so a
// named computed is the right home for them (same shape as `sealedRes`/`boxResonance` above).
const fbState    = computed<'E' | 'C' | 'N'>(() => { void live.value; return ventFieldStateOn(managedProject, 'Fb', state.box); });
const ventLState = computed<'E' | 'C' | 'N'>(() => { void live.value; return ventFieldStateOn(managedProject, 'ventL', state.box); });
// What the port solver can actually deliver. `ventLength()` returns the raw signed root, so a
// target above the L = 0 ceiling comes back as a NEGATIVE length — invisible while the LENGTH
// was the input, user-facing now the TARGET is (GAPS.md §A1). The tooltip on the target field
// promises the port is designed to it; when it cannot be, the pane says so and names the
// highest tuning this volume and vent area can actually reach.
const fbUnreachable = computed(() => { void live.value; return ventTargetUnreachableOn(managedProject, state.box); });
const fbCeiling     = computed(() => { void live.value; return ventMaxReachableFbOn(managedProject, state.box); });
/** Explains the miss in the user's own terms, on both the Box tab and the Vents tab. */
const fbUnreachableMsg = computed(() =>
  `Target not reachable: no vent of this diameter in this volume tunes above `
  + `${fbCeiling.value != null ? fbCeiling.value.toFixed(2) : '—'} Hz — the solved length is `
  + `negative, which is not a port you can build. Use a smaller vent diameter, or a larger `
  + `volume, to reach ${managedProject.boxTuning_Fb_hz().toFixed(2)} Hz.`);
/** The front chamber of a bandpass is vented on its OWN volume, so it carries its own symbol. */
const frontChamberTuningLabel = computed(() =>
  DUAL_CHAMBER.has(selectedBox.value) ? 'Target Tuning Freq (Ffc)' : 'Target Tuning Freq');
/** The tooltip the QO11 ruling requires: Fb is the target the port solver designs to. */
const FB_TARGET_TIP = 'The tuning you are designing to. It is an INPUT, not a readout: the '
  + 'port dimensions are calculated from it — the vent length on the enclosure tab is solved '
  + 'to deliver this tuning, and moves whenever you change the vent diameter or the volume.';
// First port (organ-pipe) resonance of the vent tube itself — the open-open duct fundamental
// c/(2·L), a standing wave in the vent, DISTINCT from the box Helmholtz tuning ventFb. Uses the
// PHYSICAL vent length (NOT the end-corrected Leff) to match WinISD exactly: its 86.87 Hz =
// 343.68/(2·1.978 m physical length). End correction applies to the tuning Fb, not this. §portterminology.

// ---- Chart selector ------------------------------------------------------------
// WinISD's full chart menu; each maps to a real engine curve id (TABS) or null.
// Null items stay listed (fidelity) but draw no fabricated curve — the graph shows a
// clean "not available" state, honest about what the engine can and can't compute.
type ChartItem = { label: string; tab: ChartTabId | null; sep?: boolean };
const CHART_ITEMS: ChartItem[] = [
  { label: 'Transfer function magnitude', tab: 'TFMag' },
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
  { label: 'Transfer function magnitude (EQ/Filter)', tab: 'FltMag', sep: true },
  { label: 'Transfer function phase (EQ/Filter)', tab: 'FltPhase' },
  { label: 'Group Delay (EQ/Filter)', tab: 'FltGD' },
];
// `presentationState.ui` is persisted as plain strings, so the read side goes through the set's one
// string→member boundary: a chart id this build no longer declares falls back to the
// default rather than selecting a chart that cannot be drawn.
const chartTab = computed<ChartTabId>({
  get: () => parseChartTabId(presentationState.ui.originalChartTab),
  set: (v: ChartTabId) => { presentationState.ui.originalChartTab = v; },
});
// The currently-chosen chart label (persisted separately so a "not available" pick sticks).
const chartLabel = computed({
  get: () => presentationState.ui.originalChartLabel ?? 'SPL',
  set: (v: string) => { presentationState.ui.originalChartLabel = v; },
});
const chartMeta = computed(() => TAB_META[chartTab.value]);
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
onMounted(() => {
  document.addEventListener('click', onDocClick);
  const nowStr = new Date().toISOString().slice(0, 10);
  let changed = false;
  if (!state.project.created) { state.project.created = nowStr; changed = true; }
  if (!state.project.modified) { state.project.modified = nowStr; changed = true; }
  if (!state.project.creator) {
    state.project.creator = typeof __PLATFORM_USER__ !== 'undefined' ? __PLATFORM_USER__ : 'john';
    changed = true;
  }
  if (changed) {
    markProjectSaved();
  }
});
onUnmounted(() => document.removeEventListener('click', onDocClick));

// toolbar file input (Open…)
const fileInput = ref<HTMLInputElement | null>(null);
function openClick() { fileInput.value!.click(); }
function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) {
    // Open the file as a project of its own. The project already open keeps its own row
    // and its own contents — opening one project must not fold another into it.
    openNewProject();
    importFile(f);
  }
  input.value = '';
}


// ---- Cursor readout (top-right) — real interpolation of the selected curve ------
const cursorHz = computed(() => presentationState.cursorLocked ? presentationState.pinnedF : (presentationState.cursorF ?? presentationState.pinnedF));
const fmin = computed(() => syncedP.value.fmin ?? 1);
const fmax = computed(() => syncedP.value.fmax ?? 20000);

const isHzInputFocused = ref(false);
const hzInputText = ref('');

watch(cursorHz, (newF) => {
  if (!isHzInputFocused.value) {
    hzInputText.value = newF != null ? newF.toFixed(2) : '';
  }
}, { immediate: true });

function onHzInputFocus() {
  isHzInputFocused.value = true;
  hzInputText.value = cursorHz.value != null ? cursorHz.value.toFixed(2) : '';
}

function onHzInputBlur() {
  isHzInputFocused.value = false;
  commitHzInput();
}

function commitHzInput() {
  const f = clampedFrequency(parseFloat(hzInputText.value), fmin.value, fmax.value);
  presentationState.pinnedF = f;
  presentationState.cursorF = f;
  presentationState.cursorLocked = f != null;
}

function spinHz(dir: number, factor = 1.02) {
  const f = steppedFrequency({ current: cursorHz.value, dir, factor, fmin: fmin.value, fmax: fmax.value });
  presentationState.pinnedF = f;
  presentationState.cursorF = f;
  presentationState.cursorLocked = true;
  hzInputText.value = f.toFixed(2);
}

function onHzKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    (e.target as HTMLInputElement).blur();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    spinHz(1, e.shiftKey ? 1.05 : 1.02);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    spinHz(-1, e.shiftKey ? 1.05 : 1.02);
  }
}

function onHzWheel(e: WheelEvent) {
  const dir = e.deltaY < 0 ? 1 : -1;
  spinHz(dir, e.shiftKey ? 1.05 : 1.02);
}

let holdTimer: ReturnType<typeof setTimeout> | null = null, holdInterval: ReturnType<typeof setInterval> | null = null;
function startNudge(dir: number) {
  spinHz(dir, 1.02);
  holdTimer = setTimeout(() => { holdInterval = setInterval(() => spinHz(dir, 1.02), 60); }, 300);
}
function stopNudge() {
  if (holdTimer) clearTimeout(holdTimer);
  if (holdInterval) clearInterval(holdInterval);
  holdTimer = holdInterval = null;
}
onUnmounted(stopNudge);
const currentDesign = computed(() => ({
  driver: managedProject.toEngineDriver(), box: state.box, P: syncedP.value,
  curves: curvesData.value, maxCurves: maxData.value, name: 'Current', color: WINISD_TRACE.value,
  // Visibility is the project row's own fact — read it, never keep a second copy.
  visible: activeProject.value?.visible !== false,
}));
const cursorVal = computed<number | null>(() => {
  const f = cursorHz.value;
  if (pending.value || chartUnavailable.value || f == null) return null;
  const p = buildPlotData(chartTab.value, syncedP.value.fmin, syncedP.value.fmax, currentDesign.value, overlays.value, managedProject.errors(),
    { bare: true, primaryColor: WINISD_TRACE.value }).value;
  if (!p) return null;
  const s = p.series.find(x => !x.phantom);
  if (!s || !s.xs.length) return null;
  return interpolatedY(s.xs, s.ys, f);
});

// ---- Tab rail (persisted) ------------------------------------------------------
type TabId = 'box' | 'driver' | 'enclosure' | 'filters' | 'signal' | 'advanced' | 'project';
const activeTab = computed<TabId>({
  get: () => (presentationState.ui.originalProjectTab as TabId) ?? 'box',
  set: (v: TabId) => { presentationState.ui.originalProjectTab = v; },
});
// If the enclosure tab is dropped (Closed box) while it's active, fall back to the Box tab.
watch(showEnclosureTab, (show) => { if (!show && activeTab.value === 'enclosure') activeTab.value = 'box'; });

// ---- Projects list -------------------------------------------------------------
/** One tab's worth of open design — a snapshot of everything the editor holds live,
 *  parked here while another tab is active. `driver` is the managed layer's own persisted
 *  TEXT (never an `EngineDriver`/private record — QO73), reloaded via
 *  `managedProject.loadDriverFromPersistedText()` on tab switch. `_ground` is the JSON
 *  checkpoint string `restoreGroundCheckpoint()` accepts. */
interface ProjectRow {
  id: string;
  name: string;
  driver: string | undefined;
  box: BoxType;
  P: UiParams;
  curves: SweepResult | null;
  maxCurves: MaxCurvesResult | null;
  project: ProjectMeta;
  _ground: string;
  isModified: boolean;
  visible: boolean;
  color?: string;
}
const activeProjectId = ref('proj-' + Math.random().toString(36).substring(7));
const openProjects = ref<ProjectRow[]>([]);
const activeProject = computed(() => openProjects.value.find(p => p.id === activeProjectId.value) ?? null);
let isSwapping = false;

onMounted(() => {
  if (openProjects.value.length === 0) {
    openProjects.value = [{
      id: activeProjectId.value,
      name: state.project.name || driverName.value,
      driver: persistedDriver.value,
      box: state.box,
      P: managedProject.toUiParams(),
      curves: curvesData.value,
      maxCurves: maxData.value,
      project: { ...state.project },
      _ground: groundCheckpoint(),
      isModified: isModified.value,
      visible: true,
      color: WINISD_TRACE.value,
    }];
  }
});

// Keep the active item in openProjects completely in sync with the live store active design
watch([() => state.box, live, () => persistedDriver.value, curvesData, maxData, () => state.project, isModified, () => managedProject.isWhatIfActive()], () => {
  if (isSwapping) return;
  if (managedProject.isWhatIfActive()) return;
  const activeItem = openProjects.value.find(p => p.id === activeProjectId.value);
  if (activeItem) {
    activeItem.driver = persistedDriver.value;
    activeItem.box = state.box;
    activeItem.P = managedProject.toUiParams();
    activeItem.curves = curvesData.value;
    activeItem.maxCurves = maxData.value;
    activeItem.name = state.project.name || driverName.value;
    activeItem.project = { ...state.project };
    activeItem._ground = groundCheckpoint();
    activeItem.isModified = isModified.value;
    // NOT visible: that is the row's own fact, set only by its checkbox. Re-deriving it
    // here from a second copy is what made the checkbox spring back on some projects.
  }
}, { deep: true, immediate: true });

// The other open projects, as drawable overlays. A COMPUTED VIEW built for the graph and
// nothing else: no project is written into another project's state to get drawn, and none
// is reconstructed back out of it.
// KNOWN BUG (bugs/BUG_20260823_compare_overlays_pass_persisted_driver_text_where_an_engine_
// driver_object_is_required.md): `p.driver` is persisted TEXT, not the `EngineDriver` object
// `Design.driver` declares — pre-existing, unmasked (not introduced) by giving `ProjectRow`
// a real type in this pass. Left as-is; the fix needs a driver-domain text→EngineDriver parse
// API this file is not licensed to build.
const overlays = computed<Design[]>(() =>
  openProjects.value
    .filter(p => p.id !== activeProjectId.value && p.visible !== false)
    .map(p => ({
      driver: p.driver, box: p.box, P: p.P,
      curves: p.curves, maxCurves: p.maxCurves,
      name: p.name, color: p.color, visible: true,
    })) as unknown as Design[], // BUG_20260823_compare_overlays... — driver is text, not EngineDriver
);

/** Write the live editor state back into the active project's own row. */
function syncActiveRowFromStore() {
  const activeItem = activeProject.value;
  if (!activeItem) return;
  Object.assign(activeItem, {
    driver: persistedDriver.value,
    box: state.box,
    P: managedProject.toUiParams(),
    curves: curvesData.value,
    maxCurves: maxData.value,
    name: state.project.name || driverName.value,
    project: { ...state.project },
    _ground: groundCheckpoint(),
    isModified: isModified.value,
  });
}

function selectProject(p: ProjectRow) {
  if (p.id === activeProjectId.value) return;

  isSwapping = true;

  // 1. Sync current active editor state back to the active project in openProjects
  syncActiveRowFromStore();

  // 2. Load the target project into the active editor
  const targetDesign: ProjectRow = JSON.parse(JSON.stringify(p));
  
  state.box = targetDesign.box;
  managedProject.loadUiParams(targetDesign.P, toAlignmentKind(targetDesign.box));
  if (targetDesign.driver) managedProject.loadDriverFromPersistedText(targetDesign.driver);
  else managedProject.loadEmpty();
  
  const targetProj = targetDesign.project ? targetDesign.project : { name: targetDesign.name || '', creator: '', created: '', modified: '', description: '' };
  Object.assign(state.project, targetProj);

  restoreGroundCheckpoint(targetDesign._ground || JSON.stringify({ box: state.box, P: managedProject.toUiParams(), driver: persistedDriver.value, project: state.project }));
  activeProjectId.value = targetDesign.id;

  isSwapping = false;

  // 3. Immediately set the new active project's states in openProjects to be 100% correct and sync'd
  const newActiveItem = openProjects.value.find(x => x.id === activeProjectId.value);
  if (newActiveItem) {
    newActiveItem.name = state.project.name || driverName.value;
    newActiveItem.isModified = isModified.value;
  }
}

function copyCurrentProject() {
  const currentP = managedProject.toUiParams();

  const copyId = 'proj-' + Math.random().toString(36).substring(7);
  const copyName = uniqueName(copyOfName(state.project.name || driverName.value),
                              openProjects.value.map(p => p.name));

  const d = {
    id: copyId,
    driver: persistedDriver.value,
    box: state.box,
    P: currentP,
    curves: curvesData.value,
    maxCurves: maxData.value,
    name: copyName,
    project: { ...state.project, name: copyName },
    _ground: groundCheckpoint(),
    isModified: true, // copy is unsaved
    color: DPAL[(openProjects.value.length) % DPAL.length],
    visible: true,
  };

  openProjects.value.push(d);
}

/** Open a brand-new, independent project row and make it active. */
function openNewProject() {
  syncActiveRowFromStore();
  const id = 'proj-' + Math.random().toString(36).substring(7);
  openProjects.value.push({
    id,
    name: '',
    driver: persistedDriver.value,
    box: state.box,
    P: managedProject.toUiParams(),
    curves: curvesData.value,
    maxCurves: maxData.value,
    project: { ...state.project },
    _ground: groundCheckpoint(),
    isModified: false,
    color: DPAL[openProjects.value.length % DPAL.length],
    visible: true,
  });
  activeProjectId.value = id;
}

// ---- Closing a project ---------------------------------------------------------
// Any project can be closed, including the first one and the last one — a project you
// cannot close is a trap. Unsaved work is never discarded silently: closing a modified
// project asks, and the ask names all three outcomes rather than making "Cancel" secretly
// mean "throw my work away".
const closeChallenge = ref<ProjectRow | null>(null);
useEscToClose(() => closeChallenge.value !== null, () => { closeChallenge.value = null; });

function requestCloseProject(p: ProjectRow | null) {
  if (!p) return;
  const unsaved = p.id === activeProjectId.value ? isModified.value : p.isModified;
  if (unsaved) { closeChallenge.value = p; return; }
  closeProject(p);
}

async function saveThenClose(p: ProjectRow) {
  closeChallenge.value = null;
  if (p.id !== activeProjectId.value) selectProject(p);   // Save always writes the live design
  const saved = await saveProject();
  if (saved === false) return;    // the user backed out of the file dialog — keep the project
  closeProject(p);
}

function closeProject(p: ProjectRow) {
  closeChallenge.value = null;
  const others = openProjects.value.filter(x => x.id !== p.id);
  if (p.id === activeProjectId.value) {
    if (others.length) {
      selectProject(others[0]);
      openProjects.value = openProjects.value.filter(x => x.id !== p.id);
      return;
    }
    // Closing the last project leaves the app on a fresh empty one rather than on nothing.
    openProjects.value = [];
    newProject();
    activeProjectId.value = 'proj-' + Math.random().toString(36).substring(7);
    openProjects.value = [{
      id: activeProjectId.value,
      name: state.project.name || driverName.value,
      driver: persistedDriver.value,
      box: state.box,
      P: managedProject.toUiParams(),
      curves: curvesData.value,
      maxCurves: maxData.value,
      project: { ...state.project },
      _ground: groundCheckpoint(),
      isModified: false,
      visible: true,
      color: WINISD_TRACE.value,
    }];
    return;
  }
  openProjects.value = others;
}

// ---- Resizable / collapsible layout --------------------------------------------
// Left panel width + bottom section height are splitter-dragged; both panels also
// collapse outright, and the chart can maximise over the whole main area (the toolbar
// stays, so the chart type remains switchable while maximised). All five prefs live in
// presentationState.ui → persisted across refresh and carried by a share link (human ruling
// 2026-08-14: a link is a complete description of the session, stripped of nothing — persist.ts).
const mainEl = ref<HTMLElement | null>(null);
// Fixed natural height for the bottom section. An `auto` row tracked the taller of its two
// cells — and the left rail's tab count (6 tabs for a sealed box, 7 for every other type)
// made that height jump 20px, re-flowing the chart above ("wobble"). It also let the rail's
// 7-tab height pad the content pane with dead space. A constant that clears the fullest rail
// (7 tabs) fixes both: the height no longer depends on the box type or the active tab, and
// it never grows past what the content needs. The user can still drag the splitter to resize.
const DEFAULT_BOTTOM_H = 206;
const navCollapsed = computed({ get: () => presentationState.ui.originalNavCollapsed ?? false, set: (v: boolean) => { presentationState.ui.originalNavCollapsed = v; } });
const bottomCollapsed = computed({ get: () => presentationState.ui.originalBottomCollapsed ?? false, set: (v: boolean) => { presentationState.ui.originalBottomCollapsed = v; } });
const chartMax = computed({ get: () => presentationState.ui.originalChartMax ?? false, set: (v: boolean) => { presentationState.ui.originalChartMax = v; } });
const mainStyle = computed(() => chartMax.value ? {} : {
  gridTemplateColumns: (navCollapsed.value ? '0px' : (presentationState.ui.originalNavW ?? 175) + 'px') + ' 7px 1fr',
  // Bottom row: a fixed natural height (DEFAULT_BOTTOM_H) until the user drags the splitter
  // to an explicit px — never `auto`, which would wobble with the rail's tab count.
  gridTemplateRows: '1fr 7px ' + (bottomCollapsed.value ? '0px' : (presentationState.ui.originalBottomH ?? DEFAULT_BOTTOM_H) + 'px'),
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
  startSplitDrag(e, (rect, ev) => { presentationState.ui.originalNavW = Math.min(520, Math.max(140, ev.clientX - rect.left)); });
}
function onBottomSplitDown(e: PointerEvent): void {
  if (bottomCollapsed.value) return;
  startSplitDrag(e, (rect, ev) => { presentationState.ui.originalBottomH = Math.min(400, Math.max(120, rect.bottom - ev.clientY)); });
}

// ---- Driver identity + placement ----------------------------------------------
const model = computed(() => managedProject.metaCell('model').value || driverName.value);

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
  get: () => { void live.value; return driveVoltageFor(managedProject.inputPower_W() ?? 1, managedProject.toEngineDriver()?.Re || DEFAULT_RE_OHM); },
  set: (v) => { managedProject.setInputPower_W((v * v) / (managedProject.toEngineDriver()?.Re || DEFAULT_RE_OHM)); },
});

// ---- Advanced tab: environment. All three inputs drive the real sweep: ρ and c come from
// temperature, relative humidity and static pressure (engine air.ts), and thence the SPL
// constant K. The "Ignore humidity and air pressure (as WinISD does)" checkbox in the shared
// AdvancedOptions column opts back out of the last two. ------------------------------
// The environment is PER PROJECT (WinISD keeps T/p/phi in the .wpr [Box] section) — these
// read and write straight through to managedProject, so a loaded project's own values show
// immediately rather than being overwritten by the Options → General defaults on mount.
const advTemp = computed<number>({
  get: () => { void live.value; return managedProject.envTempK(); },
  set: (v) => managedProject.setEnvTempK(v),
});
const advHumidity = computed<number>({
  get: () => { void live.value; return managedProject.envHumidityPct(); },
  set: (v) => managedProject.setEnvHumidityPct(v),
});
const advPressure = computed<number>({
  get: () => { void live.value; return managedProject.envPressurePa(); },
  set: (v) => managedProject.setEnvPressurePa(v),
});
/** The air the sweep is actually running in — one call, both readouts. */
const advAir = computed(() => {
  void live.value;
  return airForEnvironment({
    tempK: advTemp.value, humidityPct: advHumidity.value, pressurePa: advPressure.value,
    ignoreHumidityAndPressure: managedProject.envIgnoreHumidityAndPressure(),
  });
});

// ---- Placement (Signal path multipliers already in the store) ------------------
// Standard vs Iso-Barik: only Standard is modelled; the radio is shown for parity.
const placement = ref<'standard' | 'iso'>('standard');

// ---- Box losses (real: Ql/Qa/Qp) + docked/modal editors ------------------------
const boxLossesOpen = ref(false);
const newProjectOpen = ref(false);
const optionsOpen = ref(false);

// Tune (inline What-If) and Edit (full editor modal) both need the driver-source snapshot
// seeded first.
function startTune() { presentationState.editDriver = true; }

// ---- PR selection header (Enclosure tab, PR box type) — mirrors the Driver tab's
// Brand/Model + Select Driver header, but for the passive radiator. The load handlers
// mirror PRPanel.vue's (shared PRBrowser/PRDefineModal components, same store writes).
const prBrowseOpen = ref(false);
const prEditOpen = ref(false);
const prDefineOpen = ref(false);
function loadPREntry(entry: PRLibEntry) {
  managedProject.setPrField('name', entry.name);
  managedProject.setPrField('Sd_m2', entry.prSd);
  managedProject.setPrField('Mmd_kg', entry.prMmd);
  managedProject.setPrField('Cms_m_per_N', entry.prCms);
  managedProject.setPrField('Rms_Ns_per_m', entry.prRms);
  managedProject.setPrField('Xmax_m', entry.prXmax);
  prBrowseOpen.value = false;
}
// Bundled PRs publish only Sd/Cms — blank the unpublished fields and open the editor so
// the user supplies them (mirrors PRPanel.loadBundledPR; never leaves stale values).
function loadBundledPREntry(pr: BundledPR) {
  managedProject.setPrField('name', pr.name);
  if (pr.Sd  != null) managedProject.setPrField('Sd_m2', pr.Sd);
  if (pr.Cms != null) managedProject.setPrField('Cms_m_per_N', pr.Cms);
  managedProject.setPrField('Mmd_kg', 0);
  managedProject.setPrField('Rms_Ns_per_m', 0);
  managedProject.setPrField('Xmax_m', 0);
  prBrowseOpen.value = false;
  prEditOpen.value = true;
}
function defineNewPREntry() { prBrowseOpen.value = false; prDefineOpen.value = true; }
function startEdit() { editProjectDriver(); }

// R1 refresh fidelity — preserve an open Tune (what-if) / Driver Editor across a reload.
// `originalTuneOpen`/`originalEditorOpen` live in presentationState.ui, so they persist to
// localStorage (refresh) AND travel in a share link (human ruling 2026-08-14: a link is a
// complete description of the session, stripped of nothing — persist.ts). The what-if VALUES
// themselves are never carried by either path — see the next comment.
// Only whether the panel is OPEN is remembered. The what-if VALUES are not: a what-if is
// unverified and can never commit, so persisting it would bring an uncommitted value back
// after a refresh looking like a decision the user made. ManagedOpenISDProject owns what-if state and
// nothing else may hold a copy (ARCHITECTURE.md §"Approved state stores").
watch(() => managedProject.isWhatIfActive(), (active) => {
  presentationState.ui.originalTuneOpen = active;
});
// App.vue applies persisted presentationState.ui AFTER this child mounts, so react when originalTuneOpen
// lands: re-open the Tune panel. Opening it starts a FRESH what-if from the committed driver
// (OgTune's own watch does that) — the previous session's scrubbed values are deliberately
// not restored.
watch(() => presentationState.ui.originalTuneOpen, (open) => {
  if (open && !managedProject.isWhatIfActive()) presentationState.editDriver = true;
}, { immediate: true });

watch(isModified, (val) => {
  if (val) {
    state.project.modified = new Date().toISOString().slice(0, 10);
  }
});

// Same for the Driver Editor modal — it edits the committed design live (no separate buffer),
// so preserving it across refresh is just persisting the open flag and reopening.
watch(() => presentationState.editDriverInfo, (open) => { presentationState.ui.originalEditorOpen = open; });
// RESTORE ONLY — hence the `!presentationState.editDriverInfo` guard, the same shape the Tune watcher
// above uses. The line above MIRRORS every ordinary open into `originalEditorOpen`, so
// without the guard this fires on those too and re-points the editor at the PROJECT's
// driver: "Add new Driver" and the My Drivers ✎ both opened correctly and then had their
// subject silently swapped, so OK overwrote the design instead of saving to My Drivers.
watch(() => presentationState.ui.originalEditorOpen, (open) => {
  if (open && !presentationState.editDriverInfo) editProjectDriver();
}, { immediate: true });

</script>

<template>
  <div class="original-root">
    <!-- ================= Toolbar ================= -->
    <div class="toolbar">
      <div class="tb-icons">
        <div class="tb-btn has-menu" title="Open project" style="position:relative" @click.stop="toggleDropdown('folder-dropdown')">
          <ToolbarIcon name="open" />
          <span class="caret" style="position:absolute;bottom:2px;right:2px;">&#9662;</span>
          <div class="dropdown-menu" :class="{ open: openDd === 'folder-dropdown' }" @click.stop>
            <div class="menu-item" title="Import a .wdr driver or .json design." @click="openClick(); closeDropdown()">Open...</div>
          </div>
        </div>
        <div class="tb-btn" title="New project — choose box type + starting volume, then a driver." @click="newProjectOpen = true">
          <ToolbarIcon name="new" />
        </div>
        <div class="tb-btn" :class="{ dirty: isModified }" title="Save — write the design as an OpenISD .json project to the file you picked (or pick one now)." @click="saveProject">
          <ToolbarIcon name="save" />
        </div>
        <div class="tb-btn" :class="{ disabled: !isModified }" :title="isModified ? 'Revert — discard all unsaved changes and return to the last saved version.' : 'Revert — no unsaved changes to discard.'" @click="isModified && resetProjectToGround()">
          <ToolbarIcon name="revert" />
        </div>
        <ExportMenu class="tb-btn" title="Save As / Export — OpenISD project, WinISD project, driver file, or a share link.">
          <ToolbarIcon name="saveAs" />
        </ExportMenu>
        <div class="tb-sep"></div>
        <div class="tb-btn" title="Manage Drivers — browse the library." @click="presentationState.browseOpen = true">
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
        <span class="ro-hz">
          <button class="nudge-btn"
                  @pointerdown="startNudge(-1)"
                  @pointerup="stopNudge"
                  @pointerleave="stopNudge"
                  title="Spin frequency down logarithmically within chart limits (hold to spin)">◄</button>
          <input class="ro-hz-input"
                 type="text"
                 :value="hzInputText"
                 @input="hzInputText = ($event.target as HTMLInputElement).value"
                 @focus="onHzInputFocus"
                 @blur="onHzInputBlur"
                 @keydown="onHzKeydown"
                 @wheel.prevent="onHzWheel"
                 placeholder="—"
                 title="Cursor frequency in Hz (XXXXX.XX). Type or use ArrowUp/ArrowDown/wheel/◄► to spin logarithmically." />
          <button class="nudge-btn"
                  @pointerdown="startNudge(1)"
                  @pointerup="stopNudge"
                  @pointerleave="stopNudge"
                  title="Spin frequency up logarithmically within chart limits (hold to spin)">►</button>
          <span class="ro-hz-unit">Hz</span>
          <span style="display:none">{{ cursorHz != null ? cursorHz.toFixed(2) + ' Hz' : '— Hz' }}</span>
        </span>
        <span class="ro-val">{{ cursorVal != null ? cursorVal.toFixed(3) + ' ' + (chartMeta?.unit ?? '') : '— ' + (chartMeta?.unit ?? 'dB') }}</span>
        <button class="chart-max-btn" :title="chartMax ? 'Restore the normal layout (bring back the side and bottom panels)' : 'Maximise the chart over the whole page — the toolbar stays, so the chart type can still be changed'"
                @click="chartMax = !chartMax">{{ chartMax ? '⤡' : '⛶' }}</button>
        <div class="color-btn chart-color-btn" :style="{ background: WINISD_TRACE }" title="Click to cycle the current design's curve colour" @click="cycleColor">Color</div>
      </div>
    </div>

    <!-- ================= Main: 2×2 quadrants + splitters ================= -->
    <div ref="mainEl" class="main" :class="{ 'chart-max': chartMax, 'nav-collapsed': navCollapsed, 'bottom-collapsed': bottomCollapsed }" :style="mainStyle">
      <!-- top-left quadrant -->
      <div class="quad-topleft">
        <div class="quad-projects-wrap">
          <div class="panel-title">Projects</div>
          <div class="projects-list">
            <div v-if="openProjects.length === 0" class="project-empty-row" style="padding: 12px 10px; color: var(--mut, #888); font-style: italic; font-size: 12px; text-align: center;">
              no project open
            </div>
            <div v-else v-for="p in openProjects" :key="p.id" class="project-row"
                 :class="{ selected: p.id === activeProjectId, 'trace-hidden': p.visible === false, 'is-unsaved': p.isModified }"
                 :title="'Project — ' + p.name + (p.id === activeProjectId ? ' (Active)' : ' (Click to select)')"
                 @click="selectProject(p)">
              <input type="checkbox" :checked="p.visible !== false"
                     @click.stop
                     @change.stop="p.visible = ($event.target as HTMLInputElement).checked"
                     title="Show/hide this project's trace on the graph">
              <span>{{ p.name }}</span>
            </div>
          </div>
          <div class="proj-actions">
            <button class="link-btn" title="Copy this project — adds &quot;Copy of &lt;project&gt;&quot; to the list and overlays its curves on the graph for comparison" @click="copyCurrentProject">＋ Copy</button>
            <button class="link-btn close-btn"
                    title="Close the selected project. Unsaved work is not discarded silently — you are asked first."
                    @click="requestCloseProject(activeProject)">✕ Close</button>
          </div>
        </div>

        <div class="quad-signalgen-wrap">
          <div class="panel-title">Signal Generator</div>
          <div class="signal-gen-row" title="Play a real sine tone out of the audio output for testing speakers.">
            <label><input type="checkbox" v-model="genOn" @change="toggleGenerate"> Generate</label>
            <input v-expo-step type="number" step="1" v-limits="limits('genHz')" v-model.number="genHz"> <span class="unit">Hz</span>
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
        <div class="graph-wrap">
          <GraphPanel v-if="!pending && !chartUnavailable" :tabId="chartTab" :bare="true" :primaryColor="WINISD_TRACE" :overlays="overlays" />
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
      </div>

      <!-- bottom-right quadrant: 7 tabs -->
      <div class="content-panel">
        <div class="content-tabs">

        <!-- ===== Box tab ===== -->
        <section v-show="activeTab === 'box'" class="tab-section" :class="{ active: activeTab === 'box' }">
          <div class="box-tab-row">
          <div class="box-tab-main">
          <div class="field-row" style="flex-wrap: nowrap;">
            <div class="field" style="gap:8px;"><label style="width:auto;">Box Type</label>
              <select id="og-box-type" v-model="selectedBox" style="width:170px">
                <option v-for="o in BOX_OPTIONS" :key="o.id" :value="o.id">{{ o.label }}</option>
              </select>
            </div>
            <div v-if="selectedBox === 'sealed'" class="field" style="gap:8px;"
              title="Sealed resonance (Fsc) and system Q (Qtc) loss model. Lossless = fs·√(1+Vas/Vb). Conventional Lossy folds Ql/Qa into Qtc only, leaving the frequency fixed (Small/Thiele). WinISD Lossy reports the pole of the lossy 3rd-order model, so Fsc rises as Ql falls — this matches WinISD's own readout. Default: WinISD Lossy.">
              <label style="width:auto;">Model</label>
              <select id="lossmode" v-model="presentationState.lossMode" style="width:130px">
                <option v-for="m in LOSS_MODE_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
          </div>

          <div class="box-layout">
            <div v-if="!isDual" class="box-fields-col" style="width: 412px;">
              <div class="section-header">Rear chamber</div>
              <div class="field-row">
                <div class="field entered"><label>Volume</label><NumInput :model-value="live && managedProject.boxVolume_m3()" @update:model-value="v => managedProject.setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div>
              </div>
              <div class="field-row" style="flex-wrap: nowrap;">
                <!-- A vented chamber's tuning is a real design choice (the port is an extra
                     degree of freedom), so WinISD makes it entered and solves the vent LENGTH
                     from it. A sealed chamber has no port, so Fsc is fully determined by Vb
                     and the driver — calculated, nothing to type. Per-chamber, not per-box. -->
                <template v-if="selectedBox === 'vented'">
                  <div v-if="fbState === 'E'" id="og-fb-target-field" class="field entered" :title="FB_TARGET_TIP"><label>Target Tuning Freq</label><NumInput id="og-fb-target" :model-value="live && managedProject.boxTuning_Fb_hz()" @update:model-value="v => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(managedProject, 'Fb', state.box); else enterVentFieldOn(managedProject, 'Fb', v, state.box); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" /><UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                  <div v-else id="og-fb-target-field" class="field" :title="FB_TARGET_TIP"><label>Target Tuning Freq</label><input class="calculated greyed" :value="fmtU(live && managedProject.boxTuning_Fb_hz(), 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                </template>
                <template v-else-if="selectedBox === 'sealed'">
                  <div class="field"><label>Fsc</label><input id="og-box-resonance" class="calculated greyed" :value="fmtU(boxResonance, 'boxResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="boxResonance" group="freq" base="Hz" unit-class="unit unit-cyc" style="min-width: auto;" /></div>
                  <div class="field" style="margin-left: 4px; gap: 4px;"><label style="width: auto; margin-right: 4px;">Qtc</label><input class="calculated greyed" :value="rearQtc != null ? rearQtc.toFixed(3) : ''" readonly></div>
                </template>
                <div v-else class="field"><label>Fh</label><input id="og-box-resonance" class="calculated greyed" :value="fmtU(boxResonance, 'boxResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="boxResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
              </div>
              <p v-if="selectedBox === 'vented' && fbUnreachable" id="og-fb-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
              <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
            </div>

            <template v-else>
              <div class="box-fields-col">
                <div class="section-header">Rear chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput :model-value="live && managedProject.boxVolume_m3()" @update:model-value="v => managedProject.setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row">
                  <div v-if="selectedBox === 'bandpass6' || selectedBox === 'abc'" class="field entered">
                    <label>Tuning freq (Frc)</label>
                    <NumInput :model-value="live && managedProject.frcHz()" @update:model-value="v => managedProject.setFrcHz(v ?? 0)" field="Frc" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Frc" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else class="field">
                    <label>{{ selectedBox === 'bandpass4' ? 'Frc' : 'Tuning freq' }}</label>
                    <input class="calculated greyed" :value="fmtU(rearResonance, 'rearResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="rearResonance" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <div v-if="selectedBox === 'bandpass4'" class="field-row">
                  <div class="field"><label>Qtc</label><input class="calculated greyed" :value="rearQtc != null ? rearQtc.toFixed(3) : ''" readonly></div>
                </div>
                <button class="link-btn" @click="boxLossesOpen = true">Advanced-&gt;</button>
              </div>
              <div class="box-fields-col">
                <div class="section-header">Front chamber</div>
                <div class="field-row"><div class="field entered"><label>Volume</label><NumInput :model-value="live && managedProject.frontVolume_m3()" @update:model-value="v => managedProject.setFrontVolume_m3(v ?? 0)" field="Vf" group="volume" base="L" :precision="fieldDp('Vf')" /><UnitToggle field="Vf" group="volume" base="L" unit-class="unit unit-cyc" /></div></div>
                <div class="field-row">
                  <div v-if="fbState === 'E'" id="og-ffc-target-field" class="field entered" :title="FB_TARGET_TIP">
                    <label>{{ frontChamberTuningLabel }}</label>
                    <NumInput id="og-ffc-target" :model-value="live && managedProject.boxTuning_Fb_hz()" @update:model-value="v => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(managedProject, 'Fb', state.box); else enterVentFieldOn(managedProject, 'Fb', v, state.box); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else id="og-ffc-target-field" class="field" :title="FB_TARGET_TIP">
                    <label>{{ frontChamberTuningLabel }}</label>
                    <input class="calculated greyed" :value="fmtU(live && managedProject.boxTuning_Fb_hz(), 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <p v-if="fbUnreachable" id="og-ffc-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
              </div>
            </template>

          </div>
          </div>
          <div class="box-diagram-col">
              <svg v-show="selectedBox === 'sealed'" id="og-box-diagram-sealed" viewBox="0 30 200 240" height="126">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="190" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,110 L130,130 L130,170 L160,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'vented'" id="og-box-diagram-vented" viewBox="0 30 200 240" height="126">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="70" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="150" x2="160" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="100" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="100" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,70 L130,90 L130,130 L160,150" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="100" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'pr'" id="og-box-diagram-pr" viewBox="0 30 200 240" height="126">
                <polyline points="160,40 40,40 40,260 160,260" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="40" x2="160" y2="60" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="130" x2="160" y2="170" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="240" x2="160" y2="260" stroke="#0F4761" stroke-width="4"/>
                <path d="M160,60 L130,75 L130,115 L160,130" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="110" y="85" width="20" height="20" fill="#0F4761"/>
                <path d="M160,170 L130,185 L130,225 L160,240" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass4'" id="og-box-diagram-bandpass4" viewBox="0 30 200 240" height="126">
                <polyline points="160,200 160,40 40,40 40,260 160,260 160,230" fill="none" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="40" x2="100" y2="110" stroke="#0F4761" stroke-width="4"/>
                <line x1="100" y1="190" x2="100" y2="260" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="200" x2="120" y2="200" stroke="#0F4761" stroke-width="4"/>
                <line x1="160" y1="230" x2="120" y2="230" stroke="#0F4761" stroke-width="4"/>
                <path d="M100,110 L70,130 L70,170 L100,190" fill="#A0B8C6" stroke="#0F4761" stroke-width="3"/>
                <rect x="50" y="140" width="20" height="20" fill="#0F4761"/>
              </svg>
              <svg v-show="selectedBox === 'bandpass6'" id="og-box-diagram-bandpass6" viewBox="0 30 200 240" height="126">
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
              <svg v-show="selectedBox === 'abc'" id="og-box-diagram-abc" viewBox="0 15 200 270" height="126">
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
            <!-- Notes sit BESIDE the diagram, not under the row: stacked below, they grew the
                 pane (and so the whole bottom track, which is auto-sized) whenever a box type
                 with notes was picked, shifting the chart above. -->
            <div class="box-notes-col">
              <p class="hint"><b>Rear chamber</b> is the chamber behind the driver, <b>front chamber</b> the one in front of it. Closed, vented and PR have a rear chamber only.</p>
              <p v-if="selectedBox === 'sealed'" class="hint"><b>Sealed (Fsc):</b> System resonance frequency where the speaker impedance peaks and below which the response rolls off at 12 dB/octave. Solved from the box volume Vb.</p>
              <p v-if="selectedBox === 'vented'" class="hint"><b>Vented (Fb):</b> Helmholtz resonance of the box volume and port. At Fb, port output is maximized and driver cone excursion is minimized.</p>
              <p v-if="selectedBox === 'pr'" class="hint"><b>PR (Fp):</b> Helmholtz-like tuning frequency of the passive radiator and Vb. Lowered by adding mass (Madd) to the radiator cone.</p>
              <p v-if="selectedBox === 'bandpass4'" class="hint"><b>Bandpass 4th order:</b> Uses sealed rear chamber resonance (Frc) for low-end control, and front chamber port tuning (Fb) to bandpass-filter the output.</p>
              <p v-if="selectedBox === 'bandpass6'" class="hint"><b>Bandpass 6th order:</b> Dual-tuned bandpass filter. Front and rear chambers are both tuned to separate port frequencies to shape the passband.</p>
              <p v-if="selectedBox === 'abc'" class="hint">ABC's driver mounts on the outer baffle, firing straight into the room — unlike 4th/6th order bandpass, where the driver is fully enclosed and fires only into the two internal chambers.</p>
              <p v-if="pending" class="hint pending-note"><b>Response model pending.</b> The engine doesn't model this enclosure type yet — the diagram and chamber volumes are editable, but no curve is computed.</p>
            </div>
          </div>
        </section>

        <!-- ===== Driver tab ===== -->
        <section v-show="activeTab === 'driver'" class="tab-section" :class="{ active: activeTab === 'driver' }">
          <div class="field-row driver-id-row">
            <div class="field tight"><label>Brand</label><input type="text" style="width:130px" :value="managedProject.metaCell('brand').value" readonly></div>
            <div class="field tight"><label>Model</label><input type="text" style="width:140px" :value="model" readonly></div>
            <button class="edit-btn" title="Swap in a different driver for this project." @click="presentationState.browseOpen = true">Select Driver</button>
            <button class="edit-btn" title="Full editor for this driver in the current project." @click="startEdit">&#9998; Edit</button>
            <button class="edit-btn" title="Reactive minimal editor: tweak headline T/S params and watch the graph." @click="startTune">&#9835; Tune</button>
          </div>
          <div class="two-col" style="margin-top:10px;">
            <div style="--label-w:150px;">
              <div class="section-header">Placement</div>
              <div class="field-row">
                <div class="field"><label>Num. of drivers</label>
                  <select :value="live && managedProject.driverCount()" @change="e => managedProject.setDriverCount(Number((e.target as HTMLSelectElement).value))"><option v-for="n in 8" :key="n" :value="n">{{ n }}</option></select>
                  <span>driver(s)</span>
                </div>
              </div>
              <div class="radio-group field-row">
                <label><input type="radio" name="og-placement" value="standard" v-model="placement"> Standard</label>
                <label><input type="radio" name="og-placement" value="iso" v-model="placement" disabled> Iso-Barik <em style="color:#999">(not modelled)</em></label>
              </div>
              <div class="field-row">
                <div class="field"><label>Voice coil connection</label>
                  <select :value="live && managedProject.wiring()" @change="e => managedProject.setWiring((e.target as HTMLSelectElement).value as 'series' | 'parallel')"><option value="parallel">Parallel</option><option value="series">Series</option></select>
                </div>
              </div>
            </div>
            <div style="--label-w:172px;">
              <div class="section-header">Advanced options</div>
              <div class="beside-hint">
                <div>
                  <div class="field-row"><div class="field entered"><label>Voice coil temp rise</label><NumInput :model-value="live && managedProject.vcTempRise()" @update:model-value="v => managedProject.setVcTempRise(v ?? 0)" field="vcTempRise" group="tempDiff" base="K" :precision="fieldDp('vcTempRise')" /><UnitToggle field="vcTempRise" group="tempDiff" base="K" unit-class="unit" /></div></div>
                  <div class="field-row"><div class="field entered"><label>Voice coil resistance TC</label><NumInput :model-value="live && managedProject.alfaVC()" @update:model-value="v => managedProject.setAlfaVC(v ?? 0)" field="alfaVC" group="tempCoeff" base="perMilliK" :precision="fieldDp('AlfaVC')" /><UnitToggle field="alfaVC" group="tempCoeff" base="perMilliK" unit-class="unit" /></div></div>
                  <div class="field-row"><div class="field entered"><label>Added mass to cone</label><NumInput :model-value="live && managedProject.driverAddedMass()" @update:model-value="v => managedProject.setDriverAddedMass(v ?? 0)" field="driverAddedMass" group="mass" base="g" :precision="fieldDp('driverAddedMass')" /><UnitToggle field="driverAddedMass" group="mass" base="g" unit-class="unit" /></div></div>
                </div>
                <p class="hint side-hint">Temp rise × resistance TC model voice-coil power compression; added mass raises Mms (lowers Fs). WinISD parity.</p>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== Enclosure / Vents tab ===== -->
        <section v-show="activeTab === 'enclosure'" class="tab-section" :class="{ active: activeTab === 'enclosure' }">
          <!-- vented / bandpass4 -->
          <div v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'">
            <div class="section-header">Vents</div>
            <div class="two-col">
              <!-- Column 1: Config -->
              <div class="vent-config-col">
                <div class="field-row">
                  <div class="field"><label>Number of Vents</label><select><option>1</option><option>2</option></select></div>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Shape</label>
                    <select :value="live && managedProject.activeVentField('shape')" @change="e => managedProject.setActiveVentField('shape', (e.target as HTMLSelectElement).value as 'round' | 'slotted')">
                      <option value="round">round</option>
                      <option value="slotted">slotted</option>
                    </select>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field entered">
                    <label>End Correction</label>
                    <select :value="live && managedProject.activeVentField('endCorrection')" @change="e => managedProject.setActiveVentField('endCorrection', Number((e.target as HTMLSelectElement).value))" style="width:190px">
                      <option v-for="o in END_CORRECTION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Column 2: Dimensions -->
              <div class="vent-dims-col">
                <div v-if="live && managedProject.activeVentField('shape') === 'slotted'">
                  <div class="field-row">
                    <div class="field entered">
                      <label>Slot width</label>
                      <NumInput :model-value="live && managedProject.activeVentField('width_m')" @update:model-value="v => enterVentFieldOn(managedProject, 'ventW', v ?? 0, state.box)" field="ventW" group="length" base="cm" :precision="fieldDp('ventW')" />
                      <UnitToggle field="ventW" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                  <div class="field-row">
                    <div class="field entered">
                      <label>Slot height</label>
                      <NumInput :model-value="live && managedProject.activeVentField('height_m')" @update:model-value="v => enterVentFieldOn(managedProject, 'ventH', v ?? 0, state.box)" field="ventH" group="length" base="cm" :precision="fieldDp('ventH')" />
                      <UnitToggle field="ventH" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                </div>
                <div v-else>
                  <div class="field-row">
                    <div class="field entered">
                      <label>Vent diameter</label>
                      <NumInput :model-value="live && managedProject.activeVentField('diameter_m')" @update:model-value="v => enterVentFieldOn(managedProject, 'ventD', v ?? 0, state.box)" field="ventD" group="length" base="cm" :precision="fieldDp('ventD')" />
                      <UnitToggle field="ventD" group="length" base="cm" unit-class="unit unit-cyc" />
                    </div>
                  </div>
                </div>

                <div class="field-row">
                  <div v-if="ventLState === 'E'" class="field entered">
                    <label>Vent length</label>
                    <NumInput :model-value="live && managedProject.activeVentField('length_m')" @update:model-value="v => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(managedProject, 'ventL', state.box); else enterVentFieldOn(managedProject, 'ventL', v, state.box); }" field="ventL" group="length" base="cm" :precision="fieldDp('ventL')" />
                    <UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else class="field">
                    <label>Vent length</label>
                    <!-- Shown exactly as solved, negative included: a target above the L = 0
                         ceiling has no buildable port, and the honest readout says so instead
                         of a floored length that tunes somewhere else. -->
                    <input id="og-vent-length-ro" class="calculated greyed" :class="{ impossible: (live && managedProject.activeVentField('length_m')) <= 0 }" :value="fmtU(live && managedProject.activeVentField('length_m'), 'ventL', 'length', 'cm', fieldDp('ventL'))" readonly>
                    <UnitToggle field="ventL" group="length" base="cm" unit-class="unit unit-cyc" />
                  </div>
                </div>
              </div>

              <!-- Column 3: the solver's target, then what the geometry yields -->
              <div>
                <!-- The target tuning is the port solver's INPUT, so it belongs on this pane as
                     well as the Box tab — you are sizing a vent, and this is the number it is
                     sized to (human ruling QO11). WinISD shows it only on its Box screen
                     (docs/winisd_screenshots/view_3_ported.png has no tuning field); carrying it here is
                     deliberately ours. Same tuning target, same E/C state and same setter as the
                     Box tab: ONE stored value with two places to see and edit it.
                     It sits in this column, not beside the other config fields, because the
                     pane's height is set by its tallest column: a fourth row in either of the
                     first two overflows the panel for the round or the slotted shape
                     (test/ui/bottom-scroll.browser.spec.ts). Here every shape stays at three. -->
                <div class="field-row">
                  <div v-if="fbState === 'E'" id="og-vent-fb-target-field" class="field entered" :title="FB_TARGET_TIP">
                    <label>Target Tuning Freq</label>
                    <NumInput id="og-vent-fb-target" :model-value="live && managedProject.boxTuning_Fb_hz()" @update:model-value="v => { if (v == null || isNaN(v) || v <= 0) clearVentFieldOn(managedProject, 'Fb', state.box); else enterVentFieldOn(managedProject, 'Fb', v, state.box); }" field="Fb" group="freq" base="Hz" :precision="fieldDp('Fb')" />
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                  <div v-else id="og-vent-fb-target-field" class="field" :title="FB_TARGET_TIP">
                    <label>Target Tuning Freq</label>
                    <input id="og-vent-fb-target" class="calculated greyed" :value="fmtU(live && managedProject.boxTuning_Fb_hz(), 'Fb', 'freq', 'Hz', fieldDp('Fb'))" readonly>
                    <UnitToggle field="Fb" group="freq" base="Hz" unit-class="unit unit-cyc" />
                  </div>
                </div>
                <div class="field-row">
                  <div class="field"><label>Cross area</label><input class="calculated greyed" :value="fmtU(managedProject.ventArea_m2(), 'ventArea', 'area', 'm2', fieldDp('ventCrossArea'))" readonly><UnitToggle field="ventArea" group="area" base="m2" unit-class="unit" /></div>
                </div>
                <div class="field-row">
                  <div class="field"><label>1st port resonance</label><input class="calculated greyed" :value="fmtU(managedProject.portPipeResonance_hz(), 'portResonance', 'freq', 'Hz', fieldDp('portResonance'))" readonly><UnitToggle field="portResonance" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
            </div>
            <p class="hint" style="margin-top: 8px;">The vent length is calculated to meet the target tuning frequency ({{ selectedBox === 'bandpass4' ? 'Ffc' : 'Fb' }}) above — the same value the Box tab shows, editable in either place.</p>
            <p v-if="fbUnreachable" id="og-vent-unreachable" class="hint" style="color:#a11;">{{ fbUnreachableMsg }}</p>
          </div>

          <!-- passive radiator -->
          <div v-else-if="selectedBox === 'pr'">
            <div class="field-row driver-id-row" style="--label-w:36px; margin-bottom:8px;">
              <div class="field tight"><label>PR</label><input type="text" style="width:220px" :value="(live && managedProject.prField('name')) || 'Custom PR'" readonly></div>
              <button class="edit-btn" title="Browse bundled + saved passive radiators — click one to load it into this project." @click="prBrowseOpen = true">Select PR</button>
              <button class="edit-btn" title="Edit this passive radiator's own specs — Sd/Fs/Qms/Vas/Xmax." @click="prEditOpen = true">&#9998; Edit</button>
            </div>
            <PRBrowser v-if="prBrowseOpen" @close="prBrowseOpen = false"
              @load="loadPREntry" @load-bundled="loadBundledPREntry" @define="defineNewPREntry" />
            <PREditModal v-if="prEditOpen" @close="prEditOpen = false" />
            <PRDefineModal v-if="prDefineOpen" @close="prDefineOpen = false" />
            <div class="two-col">
              <div style="--label-w:44px;">
                <div class="section-header">Passive radiator parameters</div>
                <div class="field-row">
                  <div class="field"><label>Vas</label><input class="calculated greyed" :value="fmtU(managedProject.projectCell('prVas').value, 'prVas', 'volume', 'L', fieldDp('prVas'))" readonly><UnitToggle field="prVas" group="volume" base="L" unit-class="unit unit-cyc" /></div>
                  <div class="field"><label>Qms</label><input class="calculated greyed" :value="fmt(managedProject.projectCell('prQms').value, fieldDp('prQms'))" readonly></div>
                </div>
                <div class="field-row">
                  <!-- The RADIATOR's own free-air resonance, 1/(2π√(Mmd·Cms)) — no box in it.
                       WinISD labels this "Fs" on its PR screen (docs/winisd_screenshots/view_3_passive_
                       radiator.png: 30.00 Hz), which collides with the DRIVER's Fs; `Fpr` is
                       this app's symbol for it. Distinct from the SYSTEM tuning on the Box tab
                       (view_2_box.png "Fh": 40.25 Hz on that same project), which is the box
                       compliance in series with the PR's own — two quantities, two readouts. -->
                  <div class="field"><label>Fpr</label><input id="og-pr-fs" class="calculated greyed" :value="fmtU(managedProject.projectCell('prFs').value, 'prFs', 'freq', 'Hz', fieldDp('prFs'))" readonly><UnitToggle field="prFs" group="freq" base="Hz" unit-class="unit unit-cyc" /></div>
                  <div class="field entered"><label>Sd</label><NumInput :model-value="live && managedProject.prField('Sd_m2')" @update:model-value="v => managedProject.setPrField('Sd_m2', v ?? 0)" field="prSd" group="area" base="cm2" :precision="fieldDp('prSd')" /><UnitToggle field="prSd" group="area" base="cm2" unit-class="unit unit-cyc" /></div>
                </div>
                <div class="field-row">
                  <div class="field entered"><label>Xmax</label><NumInput :model-value="live && managedProject.prField('Xmax_m')" @update:model-value="v => managedProject.setPrField('Xmax_m', v ?? 0)" field="prXmax" group="length" base="mm" :precision="fieldDp('prXmax')" /><UnitToggle field="prXmax" group="length" base="mm" unit-class="unit unit-cyc" /></div>
                </div>
              </div>
              <div style="--label-w:150px;">
                <div class="section-header">User options</div>
                <div class="field-row"><div class="field entered"><label>Num. of PRs:</label><NumInput :model-value="live && managedProject.prCount()" @update:model-value="v => managedProject.setPrCount(v ?? 0)" field="prNum" :scale="1" :precision="fieldDp('prNum')" /></div></div>
                <div class="field-row"><div class="field entered"><label>Added mass to cone:</label><NumInput id="og-pr-madd" :model-value="live && managedProject.prAddedMass_kg()" @update:model-value="v => managedProject.setPrAddedMass_kg(v ?? 0)" field="prMadd" group="mass" base="g" :precision="fieldDp('prMadd')" /><UnitToggle field="prMadd" group="mass" base="g" unit-class="unit" /></div></div>
                <div class="field-row"><div class="field"><label>Fpr (with added mass):</label><input id="og-pr-fs-mass" class="calculated greyed" :value="fmtU(managedProject.projectCell('prFsMass').value, 'prFsMass', 'freq', 'Hz', fieldDp('prFsMass'))" readonly><UnitToggle field="prFsMass" group="freq" base="Hz" unit-class="unit" /></div></div>
              </div>
            </div>
          </div>


          <!-- closed box: no vents -->
          <div v-else-if="selectedBox === 'sealed'">
            <div class="section-header">Rear chamber</div>
            <div class="field-row">
              <div class="field entered"><label>Volume</label><NumInput :model-value="live && managedProject.boxVolume_m3()" @update:model-value="v => managedProject.setBoxVolume_m3(v ?? 0)" field="Vb" group="volume" base="L" :precision="fieldDp('Vb')" /><UnitToggle field="Vb" group="volume" base="L" unit-class="unit unit-cyc" /></div>
              <!-- A closed box has no passive radiator, so the PR system tuning is not a
                   quantity it HAS. Its resonance is the sealed Fsc the Box tab already
                   reports, from the same `boxResonance`. Never put a number from another
                   model under this label. -->
              <div class="field"><label>Fsc</label><input id="og-sealed-enclosure-resonance" class="calculated greyed" :value="fmtU(boxResonance, 'boxResonance', 'freq', 'Hz', fieldDp('Fb'))" readonly><UnitToggle field="boxResonance" group="freq" base="Hz" unit-class="unit" /></div>
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

        <!-- ===== Filters tab — OgFilters, wired to the project's filter chain ===== -->
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
              <div class="field-row"><div class="field entered"><label>System input power</label><NumInput :model-value="live && managedProject.inputPower_W()" @update:model-value="v => managedProject.setInputPower_W(v ?? 0)" :scale="1" :precision="fieldDp('Pin')" /><span class="unit">W</span></div></div>
              <div class="field-row"><div class="field entered"><label>Driver input voltage (each)</label><NumInput v-model="driveV" :scale="1" :precision="fieldDp('driveV')" /><span class="unit">V</span></div></div>
              <div class="field-row"><div class="field entered"><label>Series resistance</label><NumInput :model-value="live && managedProject.seriesResistance_ohm()" @update:model-value="v => managedProject.setSeriesResistance_ohm(v ?? 0)" :scale="1" :precision="fieldDp('Rs')" /><span class="unit">ohm</span></div></div>
            </div>
          </div>
        </section>

        <!-- ===== Advanced tab ===== -->
        <section v-show="activeTab === 'advanced'" class="tab-section" :class="{ active: activeTab === 'advanced' }">
          <div class="two-col adv-two-col">
            <div style="--label-w:118px;">
              <div class="field-row"><div class="field entered"><label>Temperature</label><NumInput v-model="advTemp" field="advTemp" group="temp" base="K" :precision="2" /><UnitToggle field="advTemp" group="temp" base="K" unit-class="unit unit-cyc" /></div></div>
              <div class="field-row"><div class="field entered"><label>Relative humidity</label><input v-expo-step type="number" v-limits="limits('advHumidity')" v-model.number="advHumidity"><span class="unit">%</span></div></div>
              <div class="field-row"><div class="field entered"><label>Air pressure</label><NumInput v-model="advPressure" field="advPressure" group="pressure" base="Pa" :precision="1" /><UnitToggle field="advPressure" group="pressure" base="Pa" unit-class="unit unit-cyc" /></div></div>
            </div>
            <p class="env-arrow">&#8594;</p>
            <div style="--label-w:96px;">
              <div class="field-row"><div class="field"><label>Sound velocity</label><input class="calculated greyed" :value="fmt(advAir.c, fieldDp('advSoundVelocity'))" readonly><span class="unit">m/s</span></div></div>
              <div class="field-row"><div class="field"><label>Air density</label><input class="calculated greyed" :value="advAir.rho.toFixed(fieldDp('advAirDensity'))" readonly><span class="unit">kg/m³</span></div></div>
            </div>
            <div class="checkbox-col">
              <AdvancedOptions />
            </div>
            <p class="hint side-hint">Temperature, humidity and pressure set the sound velocity and air density the simulation runs on. WinISD stores all three and uses none — tick the box to match it.</p>
          </div>
        </section>

        <!-- ===== Project tab ===== -->
        <section v-show="activeTab === 'project'" class="tab-section project-tab" :class="{ active: activeTab === 'project' }">
          <div class="two-col">
            <div>
              <div class="field-row"><div class="field"><label>Name</label><input type="text" style="width:200px" v-model="state.project.name"></div></div>
              <div class="field-row"><div class="field"><label>Creator</label><input type="text" style="width:200px" v-model="state.project.creator"></div></div>
              <div class="field-row"><div class="field"><label>Created</label><input type="text" style="width:120px" v-model="state.project.created"></div></div>
              <div class="field-row"><div class="field"><label>Modified</label><input type="text" style="width:120px" v-model="state.project.modified"></div></div>
            </div>
            <div class="description-col">
              <label>Description</label>
              <textarea class="description" rows="6" v-model="state.project.description"></textarea>
            </div>
          </div>
        </section>
        </div>

        <!-- Save rail — stacked on the right edge so the buttons consume no vertical space.
             (The Entered/Calculated swatch legend was removed: not a WinISD element.) -->
        <div class="save-rail">
          <span v-if="isModified" class="unsaved-label" title="This project has unsaved changes."><span class="unsaved-dot"></span>Unsaved changes</span>
        </div>
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
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Leakage Ql</label><NumInput :model-value="live && managedProject.boxQl()" @update:model-value="v => managedProject.setBoxQl(v ?? 0)" :scale="1" :precision="fieldDp('Ql')" /></div></div>
          <div class="field-row"><div class="field entered" style="--label-w:130px"><label>Absorption Qa</label><NumInput :model-value="live && managedProject.boxQa()" @update:model-value="v => managedProject.setBoxQa(v ?? 0)" :scale="1" :precision="fieldDp('Qa')" /></div></div>
          <div class="field-row" v-if="selectedBox === 'vented' || selectedBox === 'bandpass4'"><div class="field entered" style="--label-w:130px"><label>Port Qp</label><NumInput :model-value="live && managedProject.boxQp()" @update:model-value="v => managedProject.setBoxQp(v ?? 0)" :scale="1" :precision="fieldDp('Qp')" /></div></div>
          <p class="hint">100 = no stuffing · 20–50 = light · 5–10 = heavy. WinISD defaults: Ql=10, Qa=100, Qp=100.</p>
        </div>
        <div class="modal-footer">
          <span class="hint">Changes apply live to the graph.</span>
          <div class="footer-buttons"><button class="ok-btn" @click="boxLossesOpen = false">OK</button></div>
        </div>
      </div>
    </div>

    <!-- ===== Close an unsaved project: three named outcomes ===== -->
    <!-- A confirm() cannot express three, so its "Cancel" would have had to secretly mean
         "discard my work". Each button here says what it does to the work. -->
    <div v-if="closeChallenge" class="overlay on">
      <div class="modal narrow">
        <div class="modal-titlebar">
          <div class="tb-left"><span class="app-icon"></span><span>Close project</span></div>
          <div class="win-controls"><span class="close-btn" @click="closeChallenge = null">&#10005;</span></div>
        </div>
        <div class="modal-body">
          <p><b>{{ closeChallenge.name || 'This project' }}</b> has unsaved changes.</p>
          <div class="close-actions">
            <button class="btn" title="Save the project to its file, then close it" @click="saveThenClose(closeChallenge)">Save and close</button>
            <button class="btn" title="Close the project and lose the changes made since it was last saved" @click="closeProject(closeChallenge)">Close without saving</button>
            <button class="btn" title="Leave the project open exactly as it is" @click="closeChallenge = null">Keep it open</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Tune (docked What-If) + full Driver editor ===== -->
    <OgTune v-if="presentationState.editDriver" />
    <OptionsModal v-if="optionsOpen" @close="optionsOpen = false" />
    <OgNewProject v-if="newProjectOpen" @close="newProjectOpen = false" />

    <input ref="fileInput" type="file" accept=".owpr,.wpr,.owdr,.wdr,.json" style="display:none" @change="onFile">
  </div>
</template>

<style scoped>
/* Class names, layout and chrome follow WinISD's own window. The WinISD-light palette and
   the --chart-* custom properties keep the shared GraphPanel/canvas rendering light without
   a fork, and the `:deep(input)` rules give the shared NumInput's inner <input> the same
   `.field` styling as every other field here. */
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

.app-icon { width:20px; height:20px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #888, #333 70%); display:inline-block; }

/* ---------- Toolbar ---------- */
.toolbar { display:flex; align-items:center; justify-content:space-between; background:#eee; border-bottom:1px solid #bbb; padding:4px 12px; }
.tb-icons { display:flex; align-items:center; gap:6px; }
.tb-btn { display:flex; align-items:center; justify-content:center; width:34px; height:30px; background:#f7f7f7; border:1px solid #bbb; border-radius:3px; cursor:pointer; position:relative; }
.tb-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.tb-btn.disabled { opacity:.4; cursor:default; pointer-events:none; }
.tb-btn.disabled:hover { background:#f7f7f7; border-color:#bbb; }
.tb-btn.dirty { border-color:#d9a441; background:#fff3e0; }
.tb-btn.dirty:hover { background:#ffe4b0; border-color:#c9971b; }
.tb-sep { width:1px; align-self:stretch; background:#ccc; margin:0 4px; }
.tb-btn svg { display:block; }
.caret { font-size:10px; margin-left:2px; color:#555; }
.chart-select { display:flex; align-items:center; gap:6px; border:1px solid #bbb; border-radius:3px; background:#fff; padding:4px 8px; cursor:pointer; position:relative; user-select:none; }
.chart-select:hover { border-color:#7fb3ff; }
.chart-select .chart-name { font-weight:600; }
.cursor-readout { line-height:1; color:#222; font-size:14px; cursor:default; display:flex; flex-direction:row; align-items:center; gap:12px; white-space:nowrap; }
.cursor-readout .ro-hz, .cursor-readout .ro-val { font-variant-numeric:tabular-nums; display:inline-flex; align-items:center; }
.ro-hz-input {
  width: 82px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border: 1px solid var(--line, #bbb);
  border-radius: 3px;
  background: var(--panel, #fff);
  color: var(--fg, #222);
}
.ro-hz-input:focus {
  outline: none;
  border-color: var(--acc, #1868d1);
}
.ro-hz .nudge-btn {
  font-size: 10px;
  padding: 1px 4px;
  background: none;
  border: 1px solid var(--line, #bbb);
  border-radius: 3px;
  color: var(--mut, #666);
  cursor: pointer;
  margin: 0 2px;
}
.ro-hz .nudge-btn:hover {
  color: var(--fg, #222);
  border-color: var(--acc, #1868d1);
}
.ro-hz-unit {
  font-size: 12px;
  color: var(--mut, #666);
  margin-left: 3px;
}
.cursor-readout .ro-val { min-width:76px; text-align:right; }

/* dropdown menus */
.dropdown-menu { display:none; position:absolute; top:34px; left:0; background:#fdfdfd; border:1px solid #999; box-shadow:2px 3px 8px rgba(0,0,0,.25); z-index:50; min-width:260px; padding:4px 0; max-height:calc(100vh - 90px); overflow-y:auto; }
.dropdown-menu.open { display:block; }
.dropdown-menu .menu-item { padding:6px 14px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; }
.dropdown-menu .menu-item:hover { background:#dbeaff; }
.dropdown-menu .menu-item.current::before { content:"\25CF"; font-size:8px; color:#222; width:10px; display:inline-block; }
.dropdown-menu .menu-item:not(.current)::before { content:""; width:10px; display:inline-block; }
.dropdown-menu hr { border:none; border-top:1px solid #ddd; margin:4px 0; }
.dropdown-menu .menu-item.has-submenu { position:relative; display:flex; justify-content:space-between; align-items:center; }
.dropdown-menu .submenu { display:none; position:absolute; left:100%; top:0; background:#fdfdfd; border:1px solid #999; box-shadow:2px 3px 8px rgba(0,0,0,.25); padding:4px 0; z-index:100; min-width:200px; }
.dropdown-menu .menu-item.has-submenu:hover .submenu { display:block; }

/* ---------- Main: 2x2 quadrants + draggable splitters ---------- */
/* Track sizes come from the inline mainStyle (presentationState.ui.originalNavW/originalBottomH,
   0px when a panel is collapsed); these template values are only the no-JS fallback. */
.main { display:grid; grid-template-columns:175px 7px 1fr; grid-template-rows:1fr 7px auto;
  grid-template-areas:"nav vsplit graph" "hsplit hsplit hsplit" "rail rail content";
  flex:1 1 auto; min-height:0; overflow:hidden; }
.quad-topleft { grid-area:nav; background:#f7f7f7; display:flex; flex-direction:column; padding:10px; gap:10px; overflow-y:auto; overflow-x:hidden; min-height:0; min-width:0; }
/* splitters — the drag handles between the panels; each carries a collapse toggle */
/* The collapse toggle is a small rounded chevron tab protruding from the splitter,
   near its START edge (top / left) — away from the middle where a resize drag
   naturally grabs (a centred toggle would swallow the drag). */
.split-v { grid-area:vsplit; cursor:col-resize; background:#e6e6e6; border-left:1px solid #ccc; border-right:1px solid #ccc; position:relative; z-index:4; touch-action:none; }
.split-h { grid-area:hsplit; cursor:row-resize; background:#e6e6e6; border-top:1px solid #ccc; border-bottom:1px solid #ccc; position:relative; z-index:4; touch-action:none; }
.split-v:hover, .split-h:hover { background:#cfe0f5; }
.split-toggle { position:absolute; display:grid; place-items:center; background:#f0f0f0; border:1px solid #aaa; color:#555; border-radius:4px; cursor:pointer; font-size:9px; line-height:1; padding:0; }
.split-v .split-toggle { top:8px; left:50%; transform:translateX(-50%); width:15px; height:34px; }
.split-h .split-toggle { left:8px; top:50%; transform:translateY(-50%); height:15px; width:34px; }
.split-toggle:hover { background:#dbeaff; border-color:#7fb3ff; color:#1868d1; }
/* collapsed panels: the grid track is 0px (mainStyle); hide the content so padding
   doesn't leave a sliver. The splitter (with its expand toggle) stays visible. */
.main.nav-collapsed .quad-topleft, .main.nav-collapsed .quad-bottomleft { display:none; }
.main.bottom-collapsed .quad-bottomleft, .main.bottom-collapsed .content-panel { display:none; }
/* chart maximised: only the graph area renders; the toolbar above is untouched so the
   chart type can still be changed while maximised. */
.main.chart-max { grid-template-columns:1fr; grid-template-rows:1fr; grid-template-areas:"graph"; }
.main.chart-max .quad-topleft, .main.chart-max .quad-bottomleft, .main.chart-max .content-panel,
.main.chart-max .split-v, .main.chart-max .split-h { display:none; }
/* Chart maximise/restore lives in the toolbar's right cluster (never over the chart's
   own cursor readout, and still reachable while maximised). */
.chart-max-btn { width:30px; height:28px; background:#f7f7f7; border:1px solid #bbb; border-radius:3px;
  cursor:pointer; font-size:13px; line-height:1; display:grid; place-items:center; }
.chart-max-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
/* overflow:visible + a stacking context ABOVE the content panel lets the active
   tab extend past the column edge and paint over the panel's left spine, so it
   reads as one continuous shape with the panel (the break-through notch). */
.quad-bottomleft {
  grid-area: rail;
  background: #fcfcfc;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 6px;
  border-right: none;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  z-index: 3;
}
.quad-bottomleft .panel-title {
  color: #1a5fa6;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
  margin-right: 0;
}
.panel-title { color:#7d9fc9; font-weight:600; margin-bottom:2px; }
.quad-projects-wrap { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
.quad-signalgen-wrap { flex:none; }
.projects-list { flex:1 1 auto; min-height:60px; border:1px solid #bbb; background:#fff; overflow-y:auto; }
.project-row { display:flex; align-items:center; gap:6px; padding:5px 6px; cursor:pointer; border-bottom:1px solid #eee; }
.project-row:hover { background:#eef4ff; }
.project-row.selected { background:#1868d1; color:#fff; }
.project-row.is-unsaved { background: #fff3b3; border-left: 4px solid #f2994a; padding-left: 3px; }
.project-row.is-unsaved:hover { background: #ffe680; }
.project-row.is-unsaved.selected { background: #1868d1; border-left-color: #ffd07d; }
.project-row input[type=checkbox] { accent-color:#1868d1; }
.project-row span { flex:1; min-width:0; word-break:break-word; overflow-wrap:anywhere; }
.project-row.is-unsaved span { font-style: italic; }
.project-row.trace-hidden span { opacity:.45; text-decoration:line-through; }
/* Action row under the list — stands in for WinISD's right-click project menu. */
.close-actions { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.close-actions .btn { width:100%; }
.proj-actions { display:flex; gap:16px; margin-top:6px; }
.close-btn { color:#b02a2a; }
.close-btn:disabled { color:#999; cursor:default; text-decoration:none; opacity:.6; }
.signal-gen-row { display:flex; align-items:center; gap:8px; }
.signal-gen-row input[type=number] { width:70px; }
.project-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  width: 100%;
}
.project-nav li {
  padding: 3px 8px;
  text-align: center;
  font-size: 13px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #1b1b1b;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  list-style-type: none;
  line-height: 1.25;
}
.project-nav li:hover {
  background: #eef2f7;
}
.project-nav li.active {
  background: #cfe4f7;
  font-weight: 600;
}
.color-btn { border:1px solid #999; text-align:center; cursor:pointer; font-weight:600; }
.color-btn:hover { filter:brightness(1.05); }
/* Docked in the toolbar's cursor-readout, beside the chart-max button. */
.chart-color-btn { padding:3px 12px; font-size:11px; border-radius:3px; color:#fff; text-shadow:0 0 2px rgba(0,0,0,.55); }
.graph-area { grid-area:graph; position:relative; flex:1 1 auto; min-width:0; min-height:0; padding:8px 14px; display:flex; flex-direction:column; }
.graph-wrap { flex:1 1 auto; min-height:0; border:1px solid #999; background:#fff; position:relative; display:flex; }
.graph-wrap :deep(.gpanel) { flex:1; height:100%; min-height:0; border:none; border-radius:0; }
.graph-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:24px; color:#777; gap:6px; }
.graph-empty-h { font-size:16px; font-weight:600; color:#333; }

/* ---------- Content panel ---------- */
.content-panel { grid-area:content; background:#f7f7f7; border:1px solid #888; border-left:none; border-top:none; border-radius:0 6px 6px 0; padding:10px 16px; overflow:hidden; display:flex; flex-direction:row; gap:12px; min-height:0; min-width:0; position:relative; z-index:0; }
.content-tabs { flex:1 1 auto; min-width:0; min-height:0; display:flex; flex-direction:column; }
.save-rail { flex:none; display:flex; flex-direction:column; align-items:stretch; gap:6px; align-self:flex-start; }
.tab-section { display:none; }
/* Real WinISD is a Win32 window: child controls sit at fixed offsets and the client area
   CLIPS when the window shrinks — nothing reflows, nothing overlaps. The pane reproduces
   that by keeping every control at its natural width (the `flex:none` rules below) and
   letting the PANE scroll when the sum no longer fits. `overflow:auto` on both axes is
   what makes the clipped content still reachable, which a Win32 window cannot offer. */
.tab-section.active { display:block; flex:1 1 auto; min-height:0; overflow-x:auto; overflow-y:hidden; }
.section-header { background:#e2e2e2; border:1px solid #ccc; padding:4px 10px; font-weight:600; margin-bottom:8px; }
/* Columns keep their natural width and never shrink below their contents. A shrinking
   column (`flex:0 1 auto` with `min-width:0`) let the next column's origin slide left
   while this one's controls kept their own width, so the two painted on top of each
   other — the exact overlap `original-narrow.browser.spec.ts` locks out. */
.two-col { display:flex; gap:24px; align-items:flex-start; justify-content:flex-start; }
.two-col > div { flex:none; }
.box-layout { display:flex; gap:var(--box-col-gap); align-items:flex-start; }
.box-fields-col { flex:none; width:var(--box-col-w); --label-w:62px; }
/* The field span is fixed at the WIDEST box layout (the dual-chamber types: two field
   columns + the gap), so the diagram column starts at the same x for every box type
   instead of being pushed to the far right whenever the fields need less room. */
.box-tab-row { display:flex; gap:24px; align-items:flex-start; --box-col-w:194px; --box-col-gap:24px; }
.box-tab-row .field-row { margin-bottom: 4px; }
.box-tab-row .section-header { margin-bottom: 4px; padding: 2px 10px; }
.box-tab-main { flex:none; width:calc(var(--box-col-w) * 2 + var(--box-col-gap)); }
/* Width tracks the diagrams' own scale (each SVG height is 0.7 of its drawn size), so the
   column stays snug around the widest cut-through rather than padding it with slack. */
.box-diagram-col { flex:none; width:119px; display:flex; align-items:flex-start; justify-content:center; }
/* Third span, right of the diagram. Text WRAPS rather than overflowing, so unlike the
   fixed-width control columns this one may shrink without reintroducing the overlap. */
.box-notes-col { flex:1 1 240px; min-width:170px; max-width:340px; display:flex; flex-direction:column; gap:8px; }
.box-notes-col .hint { margin:0; }
.pending-note { color:#7a5b1a; }
.vent-groups { display:flex; gap:20px; }
.vent-col { flex:none; }
.vent-col-title { font-weight:600; color:#444; margin-bottom:4px; }
.vent-col-hint { color:#888; font-size:11px; font-style:italic; margin-bottom:4px; }
.vent-col .field label { width:110px; }
.project-tab .field label { width: 70px; }
.vent-config-col .field label {
  width: 130px;
  margin-right: 6px;
}
.vent-dims-col .field label {
  width: 110px;
  margin-right: 6px;
}
.field-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; justify-content:flex-start; }
.field { display:flex; align-items:center; gap:6px; justify-content:flex-start; flex:none; }
.field label { color:#333; display:inline-block; width:var(--label-w, 150px); text-align:left; flex:none; }
.field input[type=text], .field input[type=number], .field select,
.field :deep(input) { border:1px solid #999; padding:4px 6px; border-radius:2px; background:#fff; width:90px; flex:none; }
.field.tight label { width:auto; margin-right:2px; }
.driver-id-row { align-items:center; gap:10px; }
.field input.greyed { background:#e9e9e9; color:#777; }
.field input.calculated { color:#1868d1; border-color:#1868d1; }
/* A solved length of zero or less is not a port that can be built — it reads as the failure it
   is, matching the red unreachable notice below the pane rather than looking like a dimension. */
.field input.calculated.impossible { color:#a11; border-color:#a11; }
.field.entered :deep(input), .field.entered input { color:#1b7d1b; border-color:#1b7d1b; }
.field .unit { color:#555; min-width:3.5em; }
textarea.comment, textarea.description { width:100%; border:1px solid #999; border-radius:2px; padding:6px; resize:vertical; }
.radio-group { display:flex; align-items:center; gap:14px; }
.radio-group label { display:flex; align-items:center; gap:4px; }
.edit-btn, .link-btn, .action-btn { background:#f0f0f0; border:1px solid #999; border-radius:3px; padding:4px 10px; cursor:pointer; }
.edit-btn:hover, .link-btn:hover, .action-btn:hover { background:#dbeaff; border-color:#7fb3ff; }
.link-btn { background:none; border:none; color:#1868d1; text-decoration:underline; padding:2px 0; }
.hint { color:#888; font-size:12px; font-style:italic; }
/* Hints beside (not below) their fields keep the pane shallow so the chart stays tall. */
.beside-hint { display:flex; gap:16px; align-items:flex-start; }
.side-hint { flex:none; width:220px; margin:0; }
.env-arrow { align-self:flex-start; margin:6px 0 0; }
/* > .two-col beats the .two-col > div flex:0 default so the description fills the width */
.two-col > .description-col { flex:1 1 auto; display:flex; flex-direction:column; gap:4px; }
/* Fixed width, not shrink-to-fit: without it the column collapsed under pressure and the
   longest option wrapped to one word per line. */
.checkbox-col { display:flex; flex-direction:column; gap:8px; margin-left:24px; flex:none; width:290px; }
.checkbox-col label { display:flex; align-items:center; gap:6px; }
.checkbox-col label input[type=checkbox] { flex:none; }

.adv-two-col { gap: 10px; }
.adv-two-col .checkbox-col { margin-left: 0; width: 285px; }
.adv-two-col .side-hint { width: 190px; }

/* filters tab fills the panel */
.tab-section.active :deep(.fpanel), .tab-section.active :deep(.filters) { min-height:0; }

/* unit-cycling label */
.unit-cyc { cursor:pointer; text-decoration:underline dotted; text-underline-offset:2px; }
.unit-cyc:hover { color:#1868d1; }

/* ---------- parstate legend + save bar ---------- */
/* OpenISD-only actions (not a WinISD feature) — kept deliberately small and muted
   so they don't dominate the panel like a native WinISD control would. */
.save-btn { border:1px solid #ccc; background:#f4f4f4; color:#666; font-weight:400; border-radius:3px; padding:1px 7px; cursor:pointer; font-size:11px; }
.save-btn:hover:not(:disabled) { background:#e9e9e9; color:#333; border-color:#aaa; }
.save-btn:disabled { opacity:.45; cursor:default; }
.save-btn.dirty { border-color:#d9a441; background:#fff3e0; color:#8a5a00; font-weight:600; }
.save-btn.dirty:hover:not(:disabled) { background:#ffe4b0; }
.unsaved-label { display:flex; align-items:center; justify-content:center; gap:6px; color:#8a5a00; font-weight:600; font-size:11px; }
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

/* Style overrides to make shared modals look native in original Win32 skin */
.original-root :deep(.modal) {
  border-radius: 0;
  border: 1px solid #888;
  background: #f7f7f7;
  box-shadow: 3px 6px 18px rgba(0,0,0,.35);
}
.original-root :deep(.modal h2) {
  background: #e9e9e9;
  border-bottom: 1px solid #bbb;
  padding: 8px 12px;
  font-size: 15px;
  margin: 0;
  font-weight: normal;
  font-family: inherit;
}
.original-root :deep(.de-tabs) {
  border-bottom: none;
}
</style>
