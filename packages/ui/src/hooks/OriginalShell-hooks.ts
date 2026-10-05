/**
 * OriginalShell — the ONE hook behind `OriginalShell.vue` (1-to-1: one component, one hook).
 *
 * Architecture rule (human): the Vue layer is stripped of all logic. Every ref, computed,
 * watcher, lifecycle registration and store/domain write a shell needs lives BEHIND this hook,
 * where it is a plain composable that can be unit-tested against a real `OpenISDProject`
 * without a DOM. The component's `<script setup>` is a hook call plus its child-component
 * imports — nothing else touches `appState`, `presentationState` or the domain.
 *
 * The Box-tab and Signal-tab field wiring (`createSealedReadouts`/`createBoxVolume`/
 * `createSelectedBox`/`createDriveSignal`), the cell dq readout, the chart labels and the tab
 * rail's `TabId` are shared with `MobileShell.vue` and live in their own skin-neutral modules —
 * see `boxFields.ts`, `driveSignal.ts`, `../logic/cellDataQuality.ts`, `@openisd/design/chart` and
 * `../logic/tabId.ts`. This file JIT-composes them here with the shell's own `project` /
 * `selectedBox` / `projectChanged`.
 */
import type {ComputedRef, Ref} from 'vue';
import {computed, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue';
import {
    addProject,
    allIssues,
    boxTypeIsSimulatable,
    copyProjectName,
    curvesData,
    driverName,
    duplicateFocusedProject,
    envDefaults,
    focusedProject,
    focusProject,
    isModified,
    markProjectSaved,
    maxData,
    openProjects,
    projectChanged,
    projectDisplayName,
    projectHasUnsavedChanges,
    removeProject,
    resetProjectToGround,
    syncedP,
} from '../logic/appState.js';
import {cycleTraceColor, presentationState, setSkinOverride, traceColor} from '../logic/presentationState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {VentMember} from '../logic/ventGroup.js';
import {createVentReadouts, FB_TARGET_TIP, FH_TARGET_TIP, VENT_GEOMETRY_TIP} from './ventReadouts.js';
import {formatDateStamp, parseDateStamp} from '../logic/dateDisplay.js';
import {createPassiveRadiatorActions} from './passiveRadiatorActions.js';
import {buildPlotData, FrequencyAxis, interpolatedY, TAB_META} from '@openisd/design/chart';
import {ChartSelection, type ChartItem} from './chartSelection.js';
import {chartColumnsFit, CHARTS_HIGH_OPTIONS, ORIGINAL_CHARTS_HIGH} from './chartGrid.js';
import {offeredChartsHigh, useChartStack} from './chartStack.js';
import {createToneGenerator, type ToneGenerator} from '../logic/toneGenerator.js';
import {useApp} from '../logic/app.js';
import {useEscToClose} from '../logic/useEscToClose.js';
import {injectSplashModal} from './SplashModal-hooks.js';
import {ARRAY_WIRING_OPTIONS, BOX_TYPE_OPTIONS, END_CORRECTION_OPTIONS, formatFixed, formatFixedOrDash, NumberField, ReadoutFormat, VENT_SHAPE_OPTIONS, WinisdDeviation} from '@openisd/design/fields';
import {inputChecked, inputFrom, inputValue, listeningElement, selectedOption, selectValue} from '../logic/domEvents.js';
import {SealedAlignmentEditor} from './SealedAlignment-hooks.js';
import {VentedAlignmentEditor} from './VentedAlignment-hooks.js';
import {OriginalFilters} from './OriginalFilters-hooks.js';
import type {Calculated, Clearable, Entered, OpenISDProject, Readable, Writable} from '@openisd/design';
import {dqOfCell, type DqReadout} from '../logic/cellDataQuality.js';
import {isTabId, type TabId} from '../logic/tabId.js';
import {createBoxVolume, createChamberFields, createSealedReadouts, createSelectedBox} from './boxFields.js';
import {createDriveSignal} from './driveSignal.js';
import {createErrorSwitches} from './errorSwitches.js';
import {storedProjectRows, type StoredProjectRow} from './storedProjectRows.js';
import type {ChartId, EnvDefaults, EnvironmentEngine} from '@openisd/design/engine';
import {isTraceVisible, setTraceVisible} from '../logic/traceVisibility.js';
import {useCompareOverlays} from './compareOverlays.js';

export type AirField = 'temperature' | 'humidity' | 'pressure';

const AIR_FIELD_LIMITS: Readonly<Record<AirField, { min: number; max: number; label: string }>> = {
  temperature: { min: 0, max: 400, label: 'Temperature' },
  humidity: { min: 0, max: 100, label: 'Relative humidity' },
  pressure: { min: 1000, max: 200000, label: 'Air pressure' },
};

export function airFieldDataQuality(field: AirField, value: number | null): readonly string[] {
  if (value == null) return [];
  const limit = AIR_FIELD_LIMITS[field];
  return Number.isFinite(value) && value >= limit.min && value <= limit.max
    ? []
    : [`${limit.label} is outside the sane range (${limit.min}–${limit.max})`];
}

/** WinISD's own `YYYYMMDD` date format — duplicated from the domain's `dateStamp` rather than
 *  imported, since `domain/index.ts` exports only class/interface types. */
export function dateStamp(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** A project loaded from before `OpenISDProject.empty` stamped these itself: fills whichever of
 *  `created`/`modified`/`creator` is still blank. `creator` only fills when `username` is known —
 *  never a hardcoded fallback. Returns whether anything changed, so the caller knows whether to
 *  mark the project saved. */
export function fillBlankMeta(p: OpenISDProject, username: string | null, today: string): boolean {
  let changed = false;
  if (!p.created.value) { p.created.set(today); changed = true; }
  if (!p.modified.value) { p.modified.set(today); changed = true; }
  if (!p.creator.value && username) { p.creator.set(username); changed = true; }
  return changed;
}

// ---- Advanced tab: environment ------------------------------------------------
// The app default flows through whenever the project has no value of its own. The FIELD then
// presents as a CALCULATED value (blue, `calculated`) — never as green "entered" and never as
// blank; typing a value turns it green "entered", and deleting it drops the stored value back
// to that calculated default. The `*Stored` flags drive the two presentations.
export interface EnvironmentAirDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
  envDefaults: () => EnvDefaults;
  environment: EnvironmentEngine;
}

type EnvField = Readable<number | null> & Entered & Calculated & Writable<number> & Clearable;

export function createEnvironmentAir({ project, projectChanged: changed, envDefaults, environment }: EnvironmentAirDeps) {
  function storedOf(field: () => EnvField) {
    return computed<boolean>(() => { void changed.value; void project.value; return field().entered; });
  }
  function dqOf(airField: AirField, field: () => EnvField) {
    return computed<DqReadout>(() => {
      void changed.value;
      const f = field();
      return { dq: airFieldDataQuality(airField, f.value), dqState: f.provenance };
    });
  }
  function entryOf(field: () => EnvField) {
    return computed<number | null>({
      get: () => { void changed.value; void project.value; return field().value; },
      set: (v: number | null) => { if (typeof v === 'number' && Number.isFinite(v)) field().set(v); else field().clear(); },
    });
  }
  const temp = () => project.value.envTempK;
  const humidity = () => project.value.envHumidityPct;
  const pressure = () => project.value.envPressurePa;
  const advTemp = entryOf(temp);
  const advHumidity = entryOf(humidity);
  const advPressure = entryOf(pressure);
  function resetAirToAppDefaults(): void {
    const defaults = envDefaults();
    temp().set(defaults.tempK);
    humidity().set(defaults.humidityPct);
    pressure().set(defaults.pressurePa);
  }
  /** The air the sweep is actually running in — one call, both readouts. */
  const advAir = computed(() => {
    void project.value;
    void changed.value;
    return environment.solve({
      tempK: advTemp.value ?? undefined, humidityPct: advHumidity.value ?? undefined, pressurePa: advPressure.value ?? undefined,
    }).values;
  });
  return {
    envTempStored: storedOf(temp), envHumidityStored: storedOf(humidity), envPressureStored: storedOf(pressure),
    envTempDq: dqOf('temperature', temp), envHumidityDq: dqOf('humidity', humidity), envPressureDq: dqOf('pressure', pressure),
    advTemp, advHumidity, advPressure,
    resetAirToAppDefaults, advAir,
  };
}

// ---- The shell's one hook -----------------------------------------------------
export function useOriginalShell(options?: { sealedReadouts?: typeof createSealedReadouts }) {
  const sealedReadouts = options?.sealedReadouts ?? createSealedReadouts;

  // The delegate-free reactivity adapter (docs/design/REACTIVITY.md): touching `project.value`
  // inside a computed/watch registers a dependency that invalidates on every focused-project
  // mutation (ledger QO54). `project` also re-derives on every focus change (switching tabs),
  // sourced from `appState.ts`'s own focus-aware `live` bridge.
  const project = useFocusedProject();

  const { engine, designIO, selection, myPassiveRadiators, bundledPassiveRadiators } = useApp();
  const { saveProject, saveAllProjects, importFile } = designIO;
  // The Info menu's "About OpenISD" opens the splash — the one place that text lives.
  const { show: about } = injectSplashModal();
  // The Info menu's manual, persisted skin switch — the auto-by-viewport half lives in
  // `App.vue`'s `activeSkin` (`presentationState.narrowViewport`), which this override beats.
  function switchToMobile(): void { setSkinOverride('mobile'); }
  const { projectRepo } = useApp();
  const { editProjectDriver } = selection;

  const N_DRIVERS_OPTIONS = NumberField.DRIVER_NDRIVERS.countOptions();
  const VENT_COUNT_OPTIONS = NumberField.VENT_COUNT.countOptions();
  const PR_COUNT_OPTIONS = NumberField.PR_NUM.countOptions();

  // The focused project's own trace/legend colour — a project attribute saved in its project
  // file (`OpenISDProject.traceColor`), not a page-level index: it must follow the project
  // across focus switches, not reshuffle when the sidebar's focus target changes.
  const WINISD_TRACE = computed(() => { void projectChanged.value; return traceColor(project.value); });
  function cycleColor() { cycleTraceColor(project.value); }

  // Chart top bar's Reset button — clears the shared sweep range and every chart's Y-axis zoom.
  // Both are global view state (`presentationState.ts`), not project data.
  function resetChartView() {
    presentationState.yRanges = {};
    presentationState.sweepRange = {min: 10, max: 20000};
  }

  function fmt(n: number | null | undefined, dp: number): string {
    return formatFixedOrDash(n ?? null, dp);
  }

  // ---- Box types — the registry's own list (`box_Type`), not a copy ------------------
  // Whether the circuit models this type is the DOMAIN's answer, asked through logic/.
  // Delegated to the unit-tested `createSelectedBox` (`boxFields.ts`).
  const { selectedBox, pending, isDual, boxLabel, showEnclosureTab } =
    createSelectedBox({ focusedProject, projectChanged, isSimulatable: boxTypeIsSimulatable });
  const enclosureNavLabel = computed(() =>
    selectedBox.value === 'box-passive-radiator' ? 'Passive Radiator'
      : selectedBox.value === 'sealed' ? 'Closed'
        : boxLabel.value);

  // ---- Live engine-derived readouts (never faked literals) -----------------------
  const {
    rearResonance, rearQtc, boxResonance,
    prAddedMassDq, prTuningDq, prSystemTuningDq, prResonanceMassDq, prFsMass_hz, prNaturalFh,
  } = sealedReadouts({ project, selectedBox, projectChanged });
  const sealedAlignmentEditor = new SealedAlignmentEditor(project, projectChanged, engine.sealed, engine.driver);
  const originalFilters = new OriginalFilters(project, projectChanged, engine.filters);
  const sealedAlignmentOpen = sealedAlignmentEditor.open;
  const sealedAlignmentOptions = sealedAlignmentEditor.options;
  const sealedAlignmentSelected = sealedAlignmentEditor.selectedOption;
  const sealedAlignmentVolume_m3 = sealedAlignmentEditor.volume_m3;
  const sealedAlignmentEbp = sealedAlignmentEditor.ebp;
  const sealedAlignmentSuitability = sealedAlignmentEditor.ebpSuitability;
  const sealedAlignmentSuitabilityLabel = sealedAlignmentEditor.ebpSuitabilityLabel;

  // Same class the mobile skin drives (VentedAlignment-hooks.ts) — one implementation, both
  // shells' pickers.
  const ventedAlignmentEditor = new VentedAlignmentEditor(project, projectChanged, engine.driver);
  const ventedAlignmentOpen = ventedAlignmentEditor.open;
  const ventedAlignmentOptions = ventedAlignmentEditor.options;
  const ventedAlignmentSelected = ventedAlignmentEditor.selectedAlignment;
  const ventedAlignmentVolume_L = ventedAlignmentEditor.volume_L;
  const ventedAlignmentTuning_hz = ventedAlignmentEditor.tuning_hz;
  const ventedAlignmentEbp = ventedAlignmentEditor.ebp;
  const ventedAlignmentSuitability = ventedAlignmentEditor.ebpSuitability;
  const ventedAlignmentSuitabilityLabel = ventedAlignmentEditor.ebpSuitabilityLabel;

  // Box-type-generic rear-chamber volume (WinISD "Vb") — the Box tab's single "Volume" field
  // dispatches through the unit-tested `createBoxVolume` (`boxFields.ts`).
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged });
  // Front-chamber volume (WinISD "Vf"), rear-chamber tuning (WinISD "Frc") and the box-level
  // losses: which field each box type has is the box's own knowledge (`Box.frontVolumeOf`,
  // `rearTuningOf`, `lossesOf`); this reads and writes whatever it hands back.
  const { frontVolume_m3, setFrontVolume_m3, frcHz, setFrcHz } = createChamberFields({ project, selectedBox, projectChanged });
  const boxQl = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Ql.value ?? null; });
  function setBoxQl(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Ql.set(v); }
  const boxQa = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Qa.value ?? null; });
  function setBoxQa(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Qa.set(v); }
  const boxQp = computed<number | null>(() => { void projectChanged.value; return focusedProject()?.box.lossesOf(selectedBox.value)?.Qp?.value ?? null; });
  function setBoxQp(v: number): void { project.value.box.lossesOf(selectedBox.value)?.Qp?.set(v); }
  async function confirmDiscard(): Promise<boolean> {
    return globalThis.confirm('Discard all unsaved changes and return to the last saved version?');
  }
  // Delegated to the unit-tested `createVentReadouts` above — needs `advAir`, so the call sits
  // just after `createEnvironmentAir` below, but the destructured names read the same everywhere
  // this file used to declare them inline.

  // ---- Chart selector ------------------------------------------------------------
  // Clicking a menu label shows that chart alone and closes the menu; its checkbox opens or
  // closes that chart in the stack and leaves the menu open.
  const chartSelection = new ChartSelection(focusedProject, projectChanged, engine.box);
  const { openCharts, chartItems, chartLabel } = chartSelection;
  function toggleChart(id: ChartId): void { chartSelection.toggle(id); }
  function selectChart(item: ChartItem) {
    chartSelection.showOnly(item.tab);
    closeDropdown();
  }
  /** The chart the toolbar readout reads: the top of the stack. */
  const readoutChart = computed(() => openCharts.value[0]);
  const chartMeta = computed(() => TAB_META[readoutChart.value]);
  /** The unit the user has rotated each field to; every readout's label and number read it. */
  const unitTokens = computed<Record<string, string>>(() => presentationState.ui.unitTokens ?? {});
  /** The charts stacked to the chart area's height, chosen in the chart bar; more add columns. */
  const chartsHigh = computed<number>({
    get: () => offeredChartsHigh(presentationState.ui.originalChartsHigh, ORIGINAL_CHARTS_HIGH),
    set: (v: number) => { presentationState.ui.originalChartsHigh = v; },
  });
  const { el: chartStackEl, style: chartStackStyle } =
    useChartStack(computed(() => openCharts.value.length), chartsHigh, chartColumnsFit);

  // ---- Toolbar dropdown menus (folder / saveas / info / chart) -------------------
  const openDd = ref<string | null>(null);
  function toggleDropdown(id: string) { openDd.value = openDd.value === id ? null : id; }
  function closeDropdown() { openDd.value = null; }
  function onDocClick() { closeDropdown(); }

  // ---- Toolbar version — the build (scripts/version-info.mjs) writes build-info.json. The
  // on-disk file is the single source of truth; no version on fetch failure.
  const version = ref('');
  async function fetchVersion(): Promise<void> {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}build-info.json`, { cache: 'no-store' });
      if (!r.ok) return;
      // Narrow via the `in` operator, never a cast — the repository bans casts. `r.json()` is
      // typed `any`, so it is taken as `unknown` and proved to be an object here.
      const info: unknown = await r.json();
      if (info && typeof info === 'object' && 'version' in info && typeof info.version === 'string') {
        version.value = info.version;
      }
    } catch { /* network offline — show no version rather than fail the app */ }
  }
  onMounted(() => { void fetchVersion(); });

  // Fire the fixup fill the FIRST time a project is available — at mount when one is already
  // open, or when one arrives LATER on a project-less boot (an auto-restored save, a File →
  // Open, a .wdr import or the New Project wizard). A blank created/modified/creator gets
  // today's date and this machine's owner, exactly as it did when the shell always mounted
  // with a project; the shell can now mount without one, so the fill has to follow the project.
  let metaFilled = false;
  watch(() => focusedProject(), (p) => {
    if (p && !metaFilled) {
      metaFilled = true;
      if (fillBlankMeta(p, presentationState.ui.username ?? null, dateStamp(new Date()))) {
        markProjectSaved();
      }
    }
  }, { immediate: true });

  // ---- Document-level click: any click outside a menu closes the open dropdown ----
  onMounted(() => document.addEventListener('click', onDocClick));
  onUnmounted(() => document.removeEventListener('click', onDocClick));

  // toolbar file input (Open…)
  const fileInput = ref<HTMLInputElement | null>(null);
  const openDialogOpen = ref(false);
  const storedProjects = ref<StoredProjectRow[]>([]);
  function openClick() {
    storedProjects.value = storedProjectRows(projectRepo.listStoredProjects(), presentationState.ui.unitTokens ?? {});
    openDialogOpen.value = true;
  }
  function openFromDisk() {
    openDialogOpen.value = false;
    void designIO.openFromDisk(() => fileInput.value?.click());
  }
  function openStoredProject(id: string) {
    const result = projectRepo.loadStoredProject(id);
    if (Array.isArray(result)) {
      alert('Could not open the saved project: ' + result.join('; '));
      return;
    }
    addProject(result);
    openDialogOpen.value = false;
  }
  function onFile(e: Event) {
    const input = inputFrom(e);
    if (input === null) return;
    const f = input.files?.[0];
    if (f) importFile(f);
    input.value = '';
  }

  // ---- Cursor readout (top-right) — real interpolation of the selected curve ------
  // Cursor fields are PROJECT-scoped (QO130/QO168) — read through `project.value.*`, and
  // `projectChanged` must be read too or the readout freezes (see `createSealedReadouts`,
  // `boxFields.ts`).
  const cursorHz = computed(() => {
    void projectChanged.value;
    // The readout is part of the toolbar, which renders without a project — no project means
    // no cursor state to read (and `project.value` would throw through `requireFocusedProject`).
    if (!focusedProject()) return null;
    const p = project.value;
    return p.cursorLocked.value ? p.pinnedF.value : (p.cursorF.value ?? p.pinnedF.value);
  });
  const fmin = computed(() => curvesData.value?.fs[0] ?? 10);
  const fmax = computed(() => curvesData.value?.fs[curvesData.value.fs.length - 1] ?? 1000);

  const isHzInputFocused = ref(false);
  const hzInputText = ref('');

  /** The cursor frequency with its unit, in the rotated unit; a dash and the unit when there is none. */
  const cursorHzText = computed(() => {
    const label = ReadoutFormat.CURSOR_FREQUENCY_HZ.unitLabel(unitTokens.value);
    return cursorHz.value != null
      ? ReadoutFormat.CURSOR_FREQUENCY_HZ.text(cursorHz.value, '', unitTokens.value) + ' ' + label
      : '— ' + label;
  });
  watch(cursorHz, (newF) => {
    if (!isHzInputFocused.value) {
      hzInputText.value = newF != null ? formatFixed(newF, 2) : '';
    }
  }, { immediate: true });

  function onHzInputFocus() {
    isHzInputFocused.value = true;
    hzInputText.value = cursorHz.value != null ? formatFixed(cursorHz.value, 2) : '';
  }

  function onHzInputBlur() {
    isHzInputFocused.value = false;
    commitHzInput();
  }

  function commitHzInput() {
    const f = new FrequencyAxis(fmin.value, fmax.value).clampTyped(parseFloat(hzInputText.value));
    const p = project.value;
    p.pinnedF.set(f);
    p.cursorF.set(f);
    p.cursorLocked.set(f != null);
  }

  function spinHz(dir: number, factor = 1.02) {
    const f = new FrequencyAxis(fmin.value, fmax.value).step({ current: cursorHz.value, dir, factor });
    const p = project.value;
    p.pinnedF.set(f);
    p.cursorF.set(f);
    p.cursorLocked.set(true);
    hzInputText.value = formatFixed(f, 2);
  }

  function onHzKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      inputFrom(e)?.blur();
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
    driver: project.value.driver.specs.sweepDriver(), box: project.value.box.boxType.value, P: syncedP.value,
    curves: curvesData.value, maxCurves: maxData.value ?? undefined, name: projectDisplayName(project.value),
    color: WINISD_TRACE.value, visible: isTraceVisible(project.value),
    sortIndex: openProjects().indexOf(project.value),
  }));
  const cursorVal = computed<number | null>(() => {
    // The readout is part of the toolbar, which renders without a project — show a dash
    // rather than try to build plot data from a project that does not exist.
    if (!focusedProject()) return null;
    const f = cursorHz.value;
    if (pending.value || f == null) return null;
    const p = buildPlotData(engine, readoutChart.value, syncedP.value.fmin, syncedP.value.fmax, currentDesign.value, overlays.value, allIssues.value,
      { bare: true, primaryColor: WINISD_TRACE.value }).value;
    if (!p) return null;
    const s = p.series.find(x => x.current) ?? p.series.find(x => !x.phantom);
    if (!s || !s.xs.length) return null;
    return interpolatedY(s.xs, s.ys, f);
  });

  // ---- Tab rail (persisted) ------------------------------------------------------
  const activeTab = computed<TabId>({
    get: () => { const t = presentationState.ui.originalProjectTab; return isTabId(t) ? t : 'box'; },
    set: (v: TabId) => { presentationState.ui.originalProjectTab = v; },
  });
  watch(showEnclosureTab, (show) => { if (!show && activeTab.value === 'enclosure') activeTab.value = 'box'; });

  // ---- Projects list -------------------------------------------------------------
  const projectList = computed(() => openProjects());
  /** Some open project, focused or not, has unsaved edits — Save all has work to do. */
  const anyUnsaved = computed(() => projectList.value.some(projectHasUnsavedChanges));

  function selectProject(p: OpenISDProject) {
    const idx = projectList.value.indexOf(p);
    if (idx >= 0) focusProject(idx);
  }

  const overlays = useCompareOverlays(engine.simulation, project);

  /** "+ Copy" — duplicate the focused project's committed design into a new, independent tab. */
  function copyCurrentProject() {
    const taken = projectList.value.map(projectDisplayName);
    duplicateFocusedProject(copyProjectName(taken));
  }

  // ---- Closing a project ---------------------------------------------------------
  const closeChallenge = shallowRef<OpenISDProject | null>(null);
  useEscToClose(() => closeChallenge.value !== null, () => { closeChallenge.value = null; });

  function requestCloseProject(p: OpenISDProject | null) {
    if (!p) return;
    if (isModified.value) { closeChallenge.value = p; return; }
    closeProject(p);
  }

  async function saveThenClose(p: OpenISDProject) {
    closeChallenge.value = null;
    const saved = await saveProject();
    if (saved === false) return;    // the user backed out of the file dialog — keep the project
    closeProject(p);
  }

  function closeProject(p: OpenISDProject) {
    closeChallenge.value = null;
    const idx = projectList.value.indexOf(p);
    if (idx >= 0) removeProject(idx);
  }

  // ---- Resizable / collapsible layout --------------------------------------------
  const mainEl = ref<HTMLElement | null>(null);
  const DEFAULT_BOTTOM_H = 206;
  const navCollapsed = computed({ get: () => presentationState.ui.originalNavCollapsed ?? false, set: (v: boolean) => { presentationState.ui.originalNavCollapsed = v; } });
  const bottomCollapsed = computed({ get: () => presentationState.ui.originalBottomCollapsed ?? false, set: (v: boolean) => { presentationState.ui.originalBottomCollapsed = v; } });
  const chartMax = computed({ get: () => presentationState.ui.originalChartMax ?? false, set: (v: boolean) => { presentationState.ui.originalChartMax = v; } });
  const mainStyle = computed(() => chartMax.value ? {} : {
    gridTemplateColumns: (navCollapsed.value ? '0px' : (presentationState.ui.originalNavW ?? 175) + 'px') + ' 7px 1fr',
    gridTemplateRows: '1fr 7px ' + (bottomCollapsed.value ? '0px' : (presentationState.ui.originalBottomH ?? DEFAULT_BOTTOM_H) + 'px'),
  });
  function startSplitDrag(e: PointerEvent, apply: (rect: DOMRect, ev: PointerEvent) => void): void {
    const el = listeningElement(e);
    if (!el) return;
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
  const model = computed(() => { void projectChanged.value; return project.value.driver.model.value || driverName.value; });

  // The Project tab's text fields bind here. Each `SimpleField<string>` on `OpenISDProject` is not
  // itself `v-model`-able, so this is a thin get/set bridge onto `.value`/`.set()` — reading
  // `projectChanged` in the getter re-derives it on every focused-project mutation.
  function metaField(read: () => string, write: (v: string) => void) {
    return computed<string>({
      get: () => { void projectChanged.value; return read(); },
      set: write,
    });
  }
  const projectName = metaField(() => project.value.name.value, (v) => project.value.name.set(v));
  const projectCreator = metaField(() => project.value.creator.value, (v) => project.value.creator.set(v));
  const projectCreated = metaField(
    () => formatDateStamp(project.value.created.value), (v) => project.value.created.set(parseDateStamp(v)));
  const projectModified = metaField(
    () => formatDateStamp(project.value.modified.value), (v) => project.value.modified.set(parseDateStamp(v)));
  const projectDescription = metaField(() => project.value.description.value, (v) => project.value.description.set(v));

  // ---- Signal Generator (real audio-out tone) ------------------------------------
  const genOn = ref(false);
  const genHz = ref(1000);
  let tone: ToneGenerator | null = null;
  function toggleGenerate() { tone ??= createToneGenerator(); if (genOn.value) tone.start(genHz.value); else tone.stop(); }
  watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
  onUnmounted(() => tone?.stop());

  // ---- Signal tab: drive voltage = √(Pin × Re) per driver, plus series resistance ------------
  // Delegated to the unit-tested `createDriveSignal` (`driveSignal.ts`).
  const { driveV, reconcileDriveV, powerLocked, rsOhm } = createDriveSignal({ project, projectChanged });

  // ---- Advanced tab: environment ------------------------------------------------
  // Delegated to the unit-tested `createEnvironmentAir` above.
  const {
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure,
    resetAirToAppDefaults, advAir,
  } = createEnvironmentAir({ project, projectChanged, envDefaults, environment: engine.environment });

  // ---- Enclosure tab: vent (port) readouts ---------------------------------------
  // Delegated to the unit-tested `createVentReadouts` above — needs `advAir`, hence placed here.
  const {
    activeVent, activeTuning, portPipeResonance_hz, fbState, ventLState, fbUnreachable, fbUnreachableMsg,
    frontChamberTuningLabel,
  } = createVentReadouts({ project, projectChanged, selectedBox, air: advAir, vent: engine.vent });

  const placement = ref<'standard' | 'iso'>('standard');

  // ---- Box losses (real: Ql/Qa/Qp) + docked/modal editors ------------------------
  const boxLossesOpen = ref(false);
  const optionsOpen = ref(false);

  // What-if? opens the project's What-if layer. The project's own values stay underneath it,
  // untouched; closing the panel discards the What-if.
  function startWhatIf() {
    project.value.beginWhatIf();
    presentationState.editDriver = true;
  }

  // ---- PR selection header (Enclosure tab, PR box type) --------------------------
  // Delegated to the unit-tested `createPassiveRadiatorActions` above.
  const { prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave } =
    createPassiveRadiatorActions({ project, myPassiveRadiators, bundledPassiveRadiators });
  function startEdit() { editProjectDriver(); }

  // R1 refresh fidelity — RECORD an open What-if? panel / Driver Editor so a reload can restore it.
  // Restoring is the boot's own phase (`logic/boot.ts`), which runs it after the project and
  // the view are in place; a watcher here would fire on whatever order the flags happened to
  // arrive in, which is how a panel came to mount with no project (openisd.app 2026-09-25).
  watch(() => presentationState.editDriver, (active) => {
    presentationState.ui.originalWhatIfOpen = active;
  });

  // Same for the Driver Editor modal — recorded here, restored by the boot.
  watch(() => presentationState.editDriverInfo, (open) => { presentationState.ui.originalEditorOpen = open; });

  /** The shell renders without a project now: true tells the toolbar to grey the project-only
   *  buttons and the placeholders to stand in for the chart, tab pane and project list. */
  const focused = computed(() => focusedProject());
  const projectOpen = computed(() => focusedProject() != null);

  const errorSwitches = createErrorSwitches({project, projectChanged});
  /** The WinISD deviations whose cue sits by the chart picker: shown on an open chart. */
  const chartDeviations = computed(() => projectOpen.value ? WinisdDeviation.ALL.filter(
    d => openCharts.value.some(id => d.cueShownOnChart(errorSwitches.value, id))) : []);
  /** The passive-radiator Npr cue by the radiator count, at any count (`WinisdDeviation` cue rule). */
  const prNprDeviationShown = computed(() => projectOpen.value && WinisdDeviation.PR_NPR_RESONANCE.cueShown(errorSwitches.value));
  /** The per-driver impedance cue by the driver count, at any count. */
  const driverCountDeviationShown = computed(() => projectOpen.value && WinisdDeviation.DRIVER_COUNT.cueShown(errorSwitches.value));
  /** "Simplified ABC intra-port velocity" acts on the open box. */
  const abcVelocityApplies = computed(() => {
    void projectChanged.value;
    return project.value.winisdAbcIntraPortVelocityApplies;
  });

  return {
    version, toggleDropdown, openDd, openClick, closeDropdown, presentationState, isModified,
    openDialogOpen, storedProjects, openFromDisk, openStoredProject, switchToMobile,
    saveProject, saveAllProjects, anyUnsaved, resetProjectToGround, confirmDiscard, about, optionsOpen,
    chartLabel, chartItems, selectChart, toggleChart,
    hzInputText, inputValue, onHzInputFocus, onHzInputBlur, onHzKeydown, onHzWheel,
    startNudge, stopNudge, cursorHz, cursorVal, cursorHzText, unitTokens, chartMeta, inputChecked, selectValue, selectedOption,
    WINISD_TRACE, cycleColor, resetChartView, chartMax,
    mainEl, navCollapsed, bottomCollapsed, mainStyle, onNavSplitDown, onBottomSplitDown,
    projectList, isTraceVisible, setTraceVisible, projectDisplayName, projectHasUnsavedChanges, selectProject, project, focused, projectOpen,
    copyCurrentProject, requestCloseProject, closeChallenge, saveThenClose, closeProject,
    genOn, toggleGenerate, genHz,
    boxLabel, pending, openCharts, chartStackEl, chartStackStyle, chartsHigh, CHARTS_HIGH_OPTIONS, overlays, activeTab,
    showEnclosureTab, enclosureNavLabel,
    selectedBox, BOX_TYPE_OPTIONS, ARRAY_WIRING_OPTIONS, N_DRIVERS_OPTIONS, abcVelocityApplies, errorSwitches, chartDeviations, prNprDeviationShown, driverCountDeviationShown,
     boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3, sealedAlignmentEditor, sealedAlignmentOpen,
     sealedAlignmentOptions, sealedAlignmentSelected, sealedAlignmentVolume_m3, sealedAlignmentEbp,
     sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel, originalFilters,
     ventedAlignmentEditor, ventedAlignmentOpen, ventedAlignmentOptions, ventedAlignmentSelected,
     ventedAlignmentVolume_L, ventedAlignmentTuning_hz, ventedAlignmentEbp, ventedAlignmentSuitability,
     ventedAlignmentSuitabilityLabel,
    fbState, FB_TARGET_TIP, FH_TARGET_TIP, VENT_GEOMETRY_TIP, VentMember,
    boxResonance, rearQtc, prSystemTuningDq,
    fbUnreachable, fbUnreachableMsg, boxLossesOpen, isDual,
    frontVolume_m3, setFrontVolume_m3, frcHz, setFrcHz, rearResonance, frontChamberTuningLabel,
    model, startEdit, startWhatIf, placement,
    activeVent, activeTuning, END_CORRECTION_OPTIONS, VENT_SHAPE_OPTIONS, VENT_COUNT_OPTIONS, PR_COUNT_OPTIONS, ventLState, portPipeResonance_hz,
    prBrowseOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prSaveOpen, prSaveFields, prSaveCanSave, openPRSave, cancelPRSave, confirmPRSave,
    prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz, prNaturalFh,
    dqOfCell: (field: Readable<unknown>) => dqOfCell(field),
    fmt,
    driveV, rsOhm, advTemp, advHumidity, advPressure, advAir,
    envTempDq, envHumidityDq, envPressureDq, resetAirToAppDefaults,
    envTempStored, envHumidityStored, envPressureStored,
    reconcileDriveV,
    powerLocked,
    projectName, projectCreator, projectCreated, projectModified, projectDescription,
    boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp,
    onFile, fileInput,
  };
}
