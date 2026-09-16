/**
 * OriginalShell — the ONE hook behind `OriginalShell.vue` (1-to-1: one component, one hook).
 *
 * Architecture rule (human): the Vue layer is stripped of all logic. Every ref, computed,
 * watcher, lifecycle registration and store/domain write a shell needs lives BEHIND this hook,
 * where it is a plain composable that can be unit-tested against a real `OpenISDProject`
 * without a DOM. The component's `<script setup>` is a hook call plus its child-component
 * imports — nothing else touches `appState`, `presentationState` or the domain.
 *
 * `createSealedReadouts` is the unit-testable core of the Box-tab readouts: JIT-composed here
 * with the shell's own `project` / `selectedBox` / `projectChanged`.
 */
declare const __PLATFORM_USER__: string | undefined;

import { ref, shallowRef, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import {
  driverName,
  curvesData, maxData, allIssues,
  isModified, resetProjectToGround, markProjectSaved,
  openProjects, focusProject, removeProject, addProject, duplicateFocusedProject,
  formatInUnit as fmtU,
  copyProjectName,
  syncedP, projectChanged, definePassiveRadiator, boxTypeIsSimulatable,
  focusedProject,
} from '../logic/appState.js';
import { presentationState } from '../logic/presentationState.js';
import { useFocusedProject } from '../logic/focusedProjectContext.js';
import {
  enterVentField as enterVentFieldOn, clearVentField as clearVentFieldOn,
  ventFieldState as ventFieldStateOn, ventMaxReachableFb as ventMaxReachableFbOn,
  ventTargetUnreachable as ventTargetUnreachableOn,
} from '../logic/useVentGroup.js';
import { airForEnvironment, driveVoltageFor, lossModeOptions, DEFAULT_RE_OHM } from '../logic/environment.js';
import { TAB_META, parseChartTabId, buildPlotData } from '../logic/series.js';
import { createToneGenerator, type ToneGenerator } from '../logic/toneGenerator.js';
import { useApp } from '../logic/app.js';
import { useEscToClose } from '../logic/useEscToClose.js';
import { steppedFrequency, clampedFrequency, interpolatedY } from '../logic/cursorFrequency.js';
import { precision as fieldDp, limits, END_CORRECTION_OPTIONS } from '../logic/fields/fieldRegistry.js';
import { inputChecked, inputFrom, inputValue, listeningElement, selectValue } from '../logic/domEvents.js';
import { createSealedAlignmentEditor } from './SealedAlignment-hooks.js';
import type { OpenISDProject } from '@openisd/design';
import type { StoredProjectListing } from '@openisd/persistence';
import type { BoxType } from '@openisd/design/engine';
import type { Design } from '../types.js';
import type { ChartTabId } from '../types.js';

// ---- Sealed / PR readouts (unit-testable, real domain) ------------------------
// The fix this slice exists for: reading `project.value` ALONE does not invalidate these
// computeds on every project mutation — `changeTicks`-driven `projectChanged` MUST be read too,
// or the readout freezes at the value it had when the shell first mounted (the live-wire spec
// proved 54.81 stale while the domain computed 61.878). Every member below therefore reads
// BOTH `projectChanged` and `project`.
export interface SealedReadoutsDeps {
  project: ComputedRef<OpenISDProject>;
  selectedBox: Ref<BoxType>;
  projectChanged: Ref<number>;
}

export type AirField = 'temperature' | 'humidity' | 'pressure';

const AIR_FIELD_LIMITS: Readonly<Record<AirField, { min: number; max: number; label: string }>> = {
  temperature: { min: 0, max: 400, label: 'Temperature' },
  humidity: { min: 0, max: 100, label: 'Relative humidity' },
  pressure: { min: 1000, max: 200000, label: 'Air pressure' },
};

export function airFieldValueOnBlur(value: number | null, appValue: number): number {
  return value ?? appValue;
}

export function airFieldDataQuality(field: AirField, value: number | null): readonly string[] {
  if (value == null) return [];
  const limit = AIR_FIELD_LIMITS[field];
  return Number.isFinite(value) && value >= limit.min && value <= limit.max
    ? []
    : [`${limit.label} is outside the sane range (${limit.min}–${limit.max})`];
}

export function createSealedReadouts({ project, selectedBox, projectChanged: changed }: SealedReadoutsDeps) {
  // Sealed-box (and PR rear-chamber) resonance + system Q via the selected loss model — the
  // WinISD lossy cubic by default. NOT the impedance-magnitude peak: that scan returns the
  // high-frequency voice-coil-inductance rise (≈20 kHz) as the GLOBAL |Z| maximum for any driver
  // with Le, which is not the system resonance (and yields Qtc=0).
  //
  // These computeds are only read from the Box tab, which the shell gates with `projectOpen`.
  // They require a real project — there is no box and no readout without one.
  const rearResonance = computed<number | null>(() => {
    void changed.value; void project.value;
    return project.value.box.sealed.resonance_hz.value;
  });
  const prFsMass_hz = computed<number | null>(() => {
    void changed.value;
    return project.value.box.passiveRadiator.resonanceWithAddedMass_hz.value;
  });
  // PR solved-pair cells, live: the editable added mass and target tuning (Fp), and the two
  // read-only outputs (system tuning, free-air resonance with mass). Each carries its cell's DQ
  // + state so the generic flagged-field rule applies.
  const prAddedMassCell = computed(() => { void changed.value; return project.value.box.passiveRadiator.addedMass_kg.get(); });
  const prTuningCell = computed(() => { void changed.value; return project.value.box.passiveRadiator.tuning_hz.get(); });
  const prSystemTuning = computed(() => { void changed.value; return project.value.box.passiveRadiator.systemTuning_hz; });
  const prResonanceMass = computed(() => { void changed.value; return project.value.box.passiveRadiator.resonanceWithAddedMass_hz; });
  // box.sealed.resonance_hz / q_tc are the domain's own readouts under the selected loss mode:
  // engine.sealedResonance returns {Fsc, Qtc} together, fed the driver's SOLVED Vas and Qts as
  // sourceLoadedQts(Rs) loads it (winisd-parity-functional.test.ts "Box.Fr" pins that feed) —
  // never an inline Cms·Sd²·ρc² reconstruction and never bare Qts.
  const rearQtc = computed<number | null>(() => {
    void changed.value;
    void project.value;
    if (selectedBox.value !== 'sealed') return null;
    return project.value.box.sealed.q_tc.value;
  });
  // WinISD's "Fh" for a PR box is the PASSIVE RADIATOR system tuning — the box compliance in
  // series with the PR's own, against the PR's moving mass — NOT the sealed Fc above, which
  // ignores the PR entirely. winisd_research/GAPS.md §A3.
  /** The Box pane's rear-chamber readout: the PR system tuning for a PR box, else sealed Fc. */
  const boxResonance = computed<number | null>(() => {
    void changed.value; void project.value;
    return selectedBox.value === 'box-passive-radiator' ? project.value.box.passiveRadiator.systemTuning_hz.value : rearResonance.value;
  });

  return { rearResonance, rearQtc, boxResonance, prAddedMassCell, prTuningCell, prSystemTuning, prResonanceMass, prFsMass_hz };
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
  const { saveProject, importFile, about } = designIO;
  const { projectRepo } = useApp();
  const { editProjectDriver } = selection;

  // Fixed set, not per-render data — hoisted so the template doesn't allocate a fresh array
  // on every re-render.
  const LOSS_MODE_OPTIONS = lossModeOptions();

  // WinISD's yellow-green plot line — the Original skin's default trace colour + Color swatch.
  const TRACE_PALETTE = ['#c9c92e', '#e34b4b', '#3a7bd5', '#2e8b57', '#c23bc2', '#2ec9c9', '#e08a2e'];
  const traceIdx = ref(0);
  const WINISD_TRACE = computed(() => TRACE_PALETTE[traceIdx.value]);
  function cycleColor() { traceIdx.value = (traceIdx.value + 1) % TRACE_PALETTE.length; }

  // Chart top bar's Reset button — clears the shared sweep range and every chart's Y-axis zoom.
  function resetChartView() {
    const p = focusedProject();
    if (p) p.resetCharts();
  }

  function fmt(n: number | null | undefined, dp: number): string {
    return n != null && isFinite(n) ? n.toFixed(dp) : '—';
  }

  // ---- Box types -----------------------------------------------------------------
  const BOX_OPTIONS: { id: BoxType; label: string }[] = [
    { id: 'sealed',    label: 'Closed' },
    { id: 'vented',    label: 'Vented' },
    { id: 'box-passive-radiator', label: 'Passive Radiator' },
    { id: 'bandpass4', label: '4th Order Bandpass' },
    { id: 'bandpass6', label: '6th Order Bandpass' },
    { id: 'abc',       label: 'ABC (Aperiodic Bi-Chamber)' },
  ];
  // Whether the circuit models this type is the DOMAIN's answer, asked through logic/.
  const isSimulatable = boxTypeIsSimulatable;
  // A presentation fact with no domain counterpart: these three draw two chambers.
  const DUAL_CHAMBER = new Set<BoxType>(['bandpass4', 'bandpass6', 'abc']);

  // selectedBox is the Box tab's source of truth: it can hold types the solver refuses. Its
  // initial value comes from the focused project when one is open — the shell renders, with
  // empty placeholders, without one, and `useFocusedProject()` must not be evaluated then.
  const selectedBox = ref<BoxType>(focusedProject()?.box.boxType.get() ?? 'sealed');
  watch(selectedBox, (b) => {
    const p = focusedProject();
    if (isSimulatable(b) && p && p.box.boxType.get() !== b) p.box.boxType.set(b);
  });
  watch(
    () => { void projectChanged.value; return focusedProject()?.box.boxType.get(); },
    (b) => { if (b != null && selectedBox.value !== b) selectedBox.value = b; },
  );

  const pending = computed(() => !isSimulatable(selectedBox.value));
  const isDual = computed(() => DUAL_CHAMBER.has(selectedBox.value));
  const boxLabel = computed(() => BOX_OPTIONS.find(o => o.id === selectedBox.value)?.label ?? 'Box');
  const enclosureNavLabel = computed(() =>
    selectedBox.value === 'box-passive-radiator' ? 'Passive Radiator'
      : selectedBox.value === 'sealed' ? 'Closed'
        : boxLabel.value);
  const showEnclosureTab = computed(() => selectedBox.value !== 'sealed');

  // ---- Live engine-derived readouts (never faked literals) -----------------------
  const {
    rearResonance, rearQtc, boxResonance,
    prAddedMassCell, prTuningCell, prSystemTuning, prResonanceMass, prFsMass_hz,
  } = sealedReadouts({ project, selectedBox, projectChanged });
  const sealedAlignmentEditor = createSealedAlignmentEditor({ project, changed: projectChanged, engine });
  const sealedAlignmentOpen = sealedAlignmentEditor.open;
  const sealedAlignmentOptions = sealedAlignmentEditor.options;
  const sealedAlignmentSelected = sealedAlignmentEditor.selectedOption;
  const sealedAlignmentVolume_L = sealedAlignmentEditor.volume_L;
  const sealedAlignmentEbp = sealedAlignmentEditor.ebp;
  const sealedAlignmentSuitability = sealedAlignmentEditor.ebpSuitability;
  const sealedAlignmentSuitabilityLabel = sealedAlignmentEditor.ebpSuitabilityLabel;

  // Box-type-generic rear-chamber volume (WinISD "Vb") — every box type keeps its own volume
  // field under its own `box.<type>` slice, so the Box tab's single "Volume" field dispatches.
  const boxVolume_m3 = computed<number | null>(() => {
    void projectChanged.value;
    void project.value;
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'sealed': return box.sealed.volume_m3.get();
      case 'vented': return box.vented.volume_m3.get().value;
      case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.get().value;
      case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.get().value;
      case 'abc': return box.abc.chambers.rear.volume_m3.get().value;
      case 'box-passive-radiator': return box.passiveRadiator.volume_m3.get();
      default: return null;
    }
  });
  function setBoxVolume_m3(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'sealed': box.sealed.volume_m3.set(v); break;
      case 'vented': box.vented.volume_m3.set(v); break;
      case 'bandpass4': box.bandpass4.chambers.rear.volume_m3.set(v); break;
      case 'bandpass6': box.bandpass6.chambers.rear.volume_m3.set(v); break;
      case 'abc': box.abc.chambers.rear.volume_m3.set(v); break;
      case 'box-passive-radiator': box.passiveRadiator.volume_m3.set(v); break;
    }
  }
  // Front-chamber volume (WinISD "Vf") — dual-chamber types only (bandpass4/6, abc).
  const frontVolume_m3 = computed<number | null>(() => {
    void projectChanged.value;
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'bandpass4': return box.bandpass4.chambers.front.volume_m3.get().value;
      case 'bandpass6': return box.bandpass6.chambers.front.volume_m3.get().value;
      case 'abc': return box.abc.chambers.front.volume_m3.get().value;
      default: return null;
    }
  });
  function setFrontVolume_m3(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'bandpass4': box.bandpass4.chambers.front.volume_m3.set(v); break;
      case 'bandpass6': box.bandpass6.chambers.front.volume_m3.set(v); break;
      case 'abc': box.abc.chambers.front.volume_m3.set(v); break;
    }
  }
  // Rear-chamber tuning (WinISD "Frc") — bandpass6/abc only.
  const frcHz = computed<number | null>(() => {
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'bandpass6': return box.bandpass6.chambers.rear.tuning_hz.get().value;
      case 'abc': return box.abc.chambers.rear.tuning_hz.get().value;
      default: return null;
    }
  });
  function setFrcHz(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'bandpass6': box.bandpass6.chambers.rear.tuning_hz.set(v); break;
      case 'abc': box.abc.chambers.rear.tuning_hz.set(v); break;
    }
  }
  // Box-level Ql/Qa/Qp (WinISD's Box losses modal) — each box type keeps its own losses window.
  const boxQl = computed<number | null>(() => {
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'sealed': return box.sealed.losses.Ql.get();
      case 'vented': return box.vented.losses.Ql.get();
      case 'bandpass4': return box.bandpass4.chambers.rear.losses.Ql.get();
      case 'box-passive-radiator': return box.passiveRadiator.losses.Ql.get();
      default: return null;
    }
  });
  function setBoxQl(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'sealed': box.sealed.losses.Ql.set(v); break;
      case 'vented': box.vented.losses.Ql.set(v); break;
      case 'bandpass4': box.bandpass4.chambers.rear.losses.Ql.set(v); break;
      case 'box-passive-radiator': box.passiveRadiator.losses.Ql.set(v); break;
    }
  }
  const boxQa = computed<number | null>(() => {
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'sealed': return box.sealed.losses.Qa.get();
      case 'vented': return box.vented.losses.Qa.get();
      case 'bandpass4': return box.bandpass4.chambers.rear.losses.Qa.get();
      case 'box-passive-radiator': return box.passiveRadiator.losses.Qa.get();
      default: return null;
    }
  });
  function setBoxQa(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'sealed': box.sealed.losses.Qa.set(v); break;
      case 'vented': box.vented.losses.Qa.set(v); break;
      case 'bandpass4': box.bandpass4.chambers.rear.losses.Qa.set(v); break;
      case 'box-passive-radiator': box.passiveRadiator.losses.Qa.set(v); break;
    }
  }
  const boxQp = computed<number | null>(() => {
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'vented': return box.vented.losses.Qp.get();
      case 'bandpass4': return box.bandpass4.chambers.front.losses.Qp.get();
      default: return null;
    }
  });
  function setBoxQp(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'vented': box.vented.losses.Qp.set(v); break;
      case 'bandpass4': box.bandpass4.chambers.front.losses.Qp.set(v); break;
    }
  }
  async function confirmDiscard(): Promise<boolean> {
    return globalThis.confirm('Discard all unsaved changes and return to the last saved version?');
  }
  // The Vents tab's port — vented's own vent for a single-chamber box, bandpass4's front vent.
  const activeVent = computed(() => {
    void projectChanged.value;
    void project.value;
    const box = project.value.box;
    return selectedBox.value === 'bandpass4' ? box.bandpass4.vents.front : box.vented.vent;
  });
  // First port (organ-pipe) resonance of the vent tube itself — the open-open duct fundamental
  // c/(2·L). Uses the PHYSICAL vent length (NOT the end-corrected Leff) to match WinISD exactly.
  const portPipeResonance_hz = computed<number | null>(() => {
    void project.value;
    const L = activeVent.value.length_m.get().value;
    if (L == null || L <= 0) return null;
    return advAir.value.c / (2 * L);
  });
  type ReadoutCell = { dq(): readonly string[]; state: 'entered' | 'calculated' | 'not-available' };
  function dqOfCell(cell: ReadoutCell): { dq: readonly string[]; dqState: ReadoutCell['state'] } {
    return { dq: cell.dq(), dqState: cell.state };
  }
  // Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber tunes on
  // its own front volume Vf. The four below are READ-ONLY derived values shown in more than one
  // place (E/C/N badges, warning banners) — genuinely DERIVED state.
  const fbState    = computed<'E' | 'C' | 'N'>(() => { void project.value; return ventFieldStateOn(project.value, 'Fb'); });
  const ventLState = computed<'E' | 'C' | 'N'>(() => { void project.value; return ventFieldStateOn(project.value, 'ventL'); });
  const fbUnreachable = computed(() => { void project.value; return ventTargetUnreachableOn(project.value); });
  const fbCeiling     = computed(() => { void project.value; return ventMaxReachableFbOn(project.value); });
  /** Explains the miss in the user's own terms, on both the Box tab and the Vents tab. */
  const fbUnreachableMsg = computed(() =>
    `Target not reachable: no vent of this diameter in this volume tunes above `
    + `${fbCeiling.value != null ? fbCeiling.value.toFixed(2) : '—'} Hz — the solved length is `
    + `negative, which is not a port you can build. Use a smaller vent diameter, or a larger `
    + `volume, to reach ${(project.value.box.vented.tuning_hz.get().value ?? 0).toFixed(2)} Hz.`);
  /** The front chamber of a bandpass is vented on its OWN volume, so it carries its own symbol. */
  const frontChamberTuningLabel = computed(() =>
    DUAL_CHAMBER.has(selectedBox.value) ? 'Target Tuning Freq (Ffc)' : 'Target Tuning Freq');
  /** The tooltip the QO11 ruling requires: Fb is the target the port solver designs to. */
  const FB_TARGET_TIP = 'The tuning you are designing to. It is an INPUT, not a readout: the '
    + 'port dimensions are calculated from it — the vent length on the enclosure tab is solved '
    + 'to deliver this tuning, and moves whenever you change the vent diameter or the volume.';

  // ---- Chart selector ------------------------------------------------------------
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
  const chartTab = computed<ChartTabId>({
    get: () => parseChartTabId(presentationState.ui.originalChartTab),
    set: (v: ChartTabId) => { presentationState.ui.originalChartTab = v; },
  });
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
    // Chart buttons are a no-op with no project open — there is no curve to choose for.
    if (!focusedProject()) return;
    chartLabel.value = item.label;
    if (item.tab) chartTab.value = item.tab;
    closeDropdown();
  }

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
      // Narrow via the `in` operator, never a cast — the repository bans casts.
      const info: object = await r.json();
      if ('version' in info && typeof info.version === 'string') version.value = info.version;
    } catch { /* network offline — show no version rather than fail the app */ }
  }
  onMounted(() => { void fetchVersion(); });

  // Fire the fixup fill the FIRST time a project is available — at mount when one is already
  // open, or when one arrives LATER on a project-less boot (an auto-restored save, a File →
  // Open, a .wdr import or the New Project wizard). A blank created/modified/creator gets
  // today's date and this machine's owner, exactly as it did when the shell always mounted
  // with a project; the shell can now mount without one, so the fill has to follow the project.
  let metaFilled = false;
  function fillBlankMeta(p: OpenISDProject): void {
    const nowStr = new Date().toISOString().slice(0, 10);
    let changed = false;
    if (!p.created.get()) { p.created.set(nowStr); changed = true; }
    if (!p.modified.get()) { p.modified.set(nowStr); changed = true; }
    if (!p.creator.get()) {
      p.creator.set(typeof __PLATFORM_USER__ !== 'undefined' ? __PLATFORM_USER__ : 'john');
      changed = true;
    }
    if (changed) {
      markProjectSaved();
    }
  }
  watch(() => focusedProject(), (p) => { if (p && !metaFilled) { metaFilled = true; fillBlankMeta(p); } }, { immediate: true });

  // ---- Document-level click: any click outside a menu closes the open dropdown ----
  onMounted(() => document.addEventListener('click', onDocClick));
  onUnmounted(() => document.removeEventListener('click', onDocClick));

  // toolbar file input (Open…)
  const fileInput = ref<HTMLInputElement | null>(null);
  const openDialogOpen = ref(false);
  const storedProjects = ref<StoredProjectListing[]>([]);
  function openClick() {
    storedProjects.value = projectRepo.listStoredProjects();
    openDialogOpen.value = true;
  }
  function openFromDisk() {
    openDialogOpen.value = false;
    fileInput.value?.click();
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
  const cursorHz = computed(() => presentationState.cursorLocked ? presentationState.pinnedF : (presentationState.cursorF ?? presentationState.pinnedF));
  const fmin = computed(() => curvesData.value?.fs[0] ?? 10);
  const fmax = computed(() => curvesData.value?.fs[curvesData.value.fs.length - 1] ?? 1000);

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
    driver: project.value.driver.solverParams, box: project.value.box.boxType.get(), P: syncedP.value,
    curves: curvesData.value, maxCurves: maxData.value ?? undefined, name: 'Current', color: WINISD_TRACE.value,
    visible: isRowVisible(project.value),
  }));
  const cursorVal = computed<number | null>(() => {
    // The readout is part of the toolbar, which renders without a project — show a dash
    // rather than try to build plot data from a project that does not exist.
    if (!focusedProject()) return null;
    const f = cursorHz.value;
    if (pending.value || chartUnavailable.value || f == null) return null;
    const p = buildPlotData(chartTab.value, syncedP.value.fmin, syncedP.value.fmax, currentDesign.value, overlays.value, allIssues.value,
      { bare: true, primaryColor: WINISD_TRACE.value }).value;
    if (!p) return null;
    const s = p.series.find(x => !x.phantom);
    if (!s || !s.xs.length) return null;
    return interpolatedY(s.xs, s.ys, f);
  });

  // ---- Tab rail (persisted) ------------------------------------------------------
  type TabId = 'box' | 'driver' | 'enclosure' | 'filters' | 'signal' | 'advanced' | 'project';
  function isTabId(v: unknown): v is TabId {
    return v === 'box' || v === 'driver' || v === 'enclosure' || v === 'filters' || v === 'signal' || v === 'advanced' || v === 'project';
  }
  const activeTab = computed<TabId>({
    get: () => { const t = presentationState.ui.originalProjectTab; return isTabId(t) ? t : 'box'; },
    set: (v: TabId) => { presentationState.ui.originalProjectTab = v; },
  });
  watch(showEnclosureTab, (show) => { if (!show && activeTab.value === 'enclosure') activeTab.value = 'box'; });

  // ---- Projects list -------------------------------------------------------------
  const projectList = computed(() => openProjects());

  // Graph visibility is UI-only per-project state — a WeakMap here, the same pattern
  // `appState.ts` itself uses for `groundByProject`. `reactive()`, not a bare `WeakMap`: Vue
  // instruments Map/Set/WeakMap operations through `reactive()`, so `.set()` correctly
  // invalidates every `isRowVisible(p)` read in the template.
  const visibleOf = reactive(new WeakMap<OpenISDProject, boolean>());
  function isRowVisible(p: OpenISDProject): boolean { return visibleOf.get(p) ?? true; }
  function setRowVisible(p: OpenISDProject, v: boolean): void { visibleOf.set(p, v); }

  /** Each row's display name — the project's own `name` field, falling back to the driver name. */
  function rowName(p: OpenISDProject): string {
    if (p === project.value) return project.value.name.get() || driverName.value;
    const name = p.name.get();
    if (name) return name;
    const brand = p.driver.brand.get().value ?? '';
    const model2 = p.driver.model.get().value ?? '';
    return [brand, model2].filter(x => x.length > 0).join(' ').trim();
  }

  function selectProject(p: OpenISDProject) {
    const idx = projectList.value.indexOf(p);
    if (idx >= 0) focusProject(idx);
  }

  // Compare-overlay curves for OTHER open projects are NOT computed in this pass: the app's one
  // sweep pipeline only ever sweeps the FOCUSED project (BUG_20260823_compare_overlays...).
  const overlays = computed<Design[]>(() => []);

  /** "+ Copy" — duplicate the focused project's committed design into a new, independent tab. */
  function copyCurrentProject() {
    const taken = projectList.value.map(rowName);
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
  const model = computed(() => { void projectChanged.value; return project.value.driver.model.get().value || driverName.value; });

  // The Project tab's text fields bind here. Each `RawField<string>` on `OpenISDProject` is not
  // itself `v-model`-able, so this is a thin get/set bridge onto `.get()`/`.set()` — reading
  // `projectChanged` in the getter re-derives it on every focused-project mutation.
  function metaField(read: () => string, write: (v: string) => void) {
    return computed<string>({
      get: () => { void projectChanged.value; return read(); },
      set: write,
    });
  }
  const projectName = metaField(() => project.value.name.get(), (v) => project.value.name.set(v));
  const projectCreator = metaField(() => project.value.creator.get(), (v) => project.value.creator.set(v));
  const projectCreated = metaField(() => project.value.created.get(), (v) => project.value.created.set(v));
  const projectModified = metaField(() => project.value.modified.get(), (v) => project.value.modified.set(v));
  const projectDescription = metaField(() => project.value.description.get().value ?? '', (v) => project.value.description.set(v));

  // ---- Signal Generator (real audio-out tone) ------------------------------------
  const genOn = ref(false);
  const genHz = ref(1000);
  let tone: ToneGenerator | null = null;
  function toggleGenerate() { tone ??= createToneGenerator(); if (genOn.value) tone.start(genHz.value); else tone.stop(); }
  watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
  onUnmounted(() => tone?.stop());

  // ---- Signal tab: drive voltage = √(Pin × Re) per driver ------------------------
  const driveV = computed<number>({
    get: () => { void projectChanged.value; void project.value; return driveVoltageFor(project.value.powerDrive_W.value ?? 1, project.value.driver.ts.Re_ohm.value || DEFAULT_RE_OHM); },
    set: (v) => {
      if (v == null) { project.value.powerDrive_W.clear(); return; }
      project.value.powerDrive_W.set((v * v) / (project.value.driver.ts.Re_ohm.value || DEFAULT_RE_OHM));
    },
  });
  // Series resistance — read through `projectChanged` so a typed value sticks.
  const rsOhm = computed<number>({
    get: () => { void projectChanged.value; void project.value; return project.value.Rs_ohm.get(); },
    set: (v) => { project.value.Rs_ohm.set(v ?? 0); },
  });

  // ---- Advanced tab: environment ------------------------------------------------
  // The app default flows through whenever the project has no value of its own. The FIELD then
  // presents as a CALCULATED value (blue, `calculated`) — never as green "entered" and never as
  // blank; typing a value turns it green "entered", and deleting it drops the stored value back
  // to that calculated default. The `*Stored` flags drive the two presentations.
  const envTempStored = computed(() => { void projectChanged.value; void project.value; return project.value.envTempK.value != null; });
  const envHumidityStored = computed(() => { void projectChanged.value; void project.value; return project.value.envHumidityPct.value != null; });
  const envPressureStored = computed(() => { void projectChanged.value; void project.value; return project.value.envPressurePa.value != null; });
  const envTempDq = computed(() => { void projectChanged.value; return airFieldDataQuality('temperature', project.value.envTempK.value); });
  const envHumidityDq = computed(() => { void projectChanged.value; return airFieldDataQuality('humidity', project.value.envHumidityPct.value); });
  const envPressureDq = computed(() => { void projectChanged.value; return airFieldDataQuality('pressure', project.value.envPressurePa.value); });
  const advTemp = computed<number>({
    get: () => { void projectChanged.value; void project.value; return project.value.envTempK.value ?? presentationState.ui.envDefaults.tempK; },
    set: (v: number | null) => { if (typeof v === 'number' && Number.isFinite(v)) project.value.envTempK.set(v); else project.value.envTempK.clear(); },
  });
  const advHumidity = computed<number>({
    get: () => { void projectChanged.value; void project.value; return project.value.envHumidityPct.value ?? presentationState.ui.envDefaults.humidityPct; },
    set: (v: number | null) => {
      if (typeof v === 'number' && Number.isFinite(v)) project.value.envHumidityPct.set(v); else project.value.envHumidityPct.clear();
    },
  });
  const advPressure = computed<number>({
    get: () => { void projectChanged.value; void project.value; return project.value.envPressurePa.value ?? presentationState.ui.envDefaults.pressurePa; },
    set: (v: number | null) => { if (typeof v === 'number' && Number.isFinite(v)) project.value.envPressurePa.set(v); else project.value.envPressurePa.clear(); },
  });
  function commitAirTemp(): void {
    const value = airFieldValueOnBlur(project.value.envTempK.value, presentationState.ui.envDefaults.tempK);
    project.value.envTempK.set(value);
  }
  function commitAirHumidity(): void {
    const value = airFieldValueOnBlur(project.value.envHumidityPct.value, presentationState.ui.envDefaults.humidityPct);
    project.value.envHumidityPct.set(value);
  }
  function commitAirPressure(): void {
    const value = airFieldValueOnBlur(project.value.envPressurePa.value, presentationState.ui.envDefaults.pressurePa);
    project.value.envPressurePa.set(value);
  }
  function resetAirToAppDefaults(): void {
    project.value.envTempK.set(presentationState.ui.envDefaults.tempK);
    project.value.envHumidityPct.set(presentationState.ui.envDefaults.humidityPct);
    project.value.envPressurePa.set(presentationState.ui.envDefaults.pressurePa);
  }
  /** The air the sweep is actually running in — one call, both readouts. */
  const advAir = computed(() => {
    void project.value;
    return airForEnvironment({
      tempK: advTemp.value ?? undefined, humidityPct: advHumidity.value ?? undefined, pressurePa: advPressure.value ?? undefined,
      useWinisdAirModel: project.value.envUseWinisdAirModel.get(),
    });
  });

  const placement = ref<'standard' | 'iso'>('standard');

  // ---- Box losses (real: Ql/Qa/Qp) + docked/modal editors ------------------------
  const boxLossesOpen = ref(false);
  const optionsOpen = ref(false);

  // Tune owns a project-level transient what-if. Ordinary edits remain underneath it and are not
  // affected when the Tune panel is cancelled.
  function startTune() {
    project.value.beginWhatIf();
    presentationState.editDriver = true;
  }

  // ---- PR selection header (Enclosure tab, PR box type) --------------------------
  const prBrowseOpen = ref(false);
  const prEditOpen = ref(false);
  function loadPREntry(uuid: string) {
    const entry = myPassiveRadiators.list().find(e => e.uuid === uuid);
    if (!entry) return;
    project.value.box.passiveRadiator.configurePR(entry.passiveRadiator);
    prBrowseOpen.value = false;
  }
  // Bundled PRs publish only Sd/Cms — the rest of the record states nothing, so the editor
  // opens for the user to supply them.
  async function loadBundledPassiveRadiatorEntry(uuid: string): Promise<void> {
    // The row's id is the record uuid; the repo fetches the record (cached after the first time).
    const pr = await bundledPassiveRadiators.load(uuid);
    project.value.box.passiveRadiator.configurePR(pr);
    prBrowseOpen.value = false;
    prEditOpen.value = true;
  }
  function defineNewPREntry() {
    definePassiveRadiator();
    prBrowseOpen.value = false;
    prEditOpen.value = true;
  }
  function startEdit() { editProjectDriver(); }

  // R1 refresh fidelity — preserve an open Tune / Driver Editor across a reload.
  watch(() => presentationState.editDriver, (active) => {
    presentationState.ui.originalTuneOpen = active;
  });
  watch(() => presentationState.ui.originalTuneOpen, (open) => {
    if (open) presentationState.editDriver = true;
  }, { immediate: true });

  watch(isModified, (val) => {
    if (val) {
      project.value.modified.set(new Date().toISOString().slice(0, 10));
    }
  });

  // Same for the Driver Editor modal — RESTORE ONLY, hence the `!presentationState.editDriverInfo`
  // guard, the same shape the Tune watcher above uses.
  watch(() => presentationState.editDriverInfo, (open) => { presentationState.ui.originalEditorOpen = open; });
  watch(() => presentationState.ui.originalEditorOpen, (open) => {
    if (open && !presentationState.editDriverInfo) editProjectDriver();
  }, { immediate: true });

  /** The shell renders without a project now: true tells the toolbar to grey the project-only
   *  buttons and the placeholders to stand in for the chart, tab pane and project list. */
  const focused = computed(() => focusedProject());
  const projectOpen = computed(() => focusedProject() != null);
  const whatIfActive = computed(() => {
    void projectChanged.value;
    return project.value.isWhatIfActive();
  });

  return {
    version, toggleDropdown, openDd, openClick, closeDropdown, presentationState, isModified,
    openDialogOpen, storedProjects, openFromDisk, openStoredProject,
    saveProject, resetProjectToGround, confirmDiscard, about, optionsOpen,
    chartLabel, CHART_ITEMS, selectChart,
    hzInputText, inputValue, onHzInputFocus, onHzInputBlur, onHzKeydown, onHzWheel,
    startNudge, stopNudge, cursorHz, cursorVal, chartMeta, inputChecked, selectValue,
    WINISD_TRACE, cycleColor, resetChartView, chartMax,
    mainEl, navCollapsed, bottomCollapsed, mainStyle, onNavSplitDown, onBottomSplitDown,
    projectList, isRowVisible, setRowVisible, rowName, selectProject, project, focused, projectOpen, whatIfActive,
    copyCurrentProject, requestCloseProject, closeChallenge, saveThenClose, closeProject,
    genOn, toggleGenerate, genHz, limits,
    boxLabel, pending, chartTab, overlays, chartUnavailable, activeTab,
    showEnclosureTab, enclosureNavLabel,
    selectedBox, BOX_OPTIONS, LOSS_MODE_OPTIONS,
     boxVolume_m3, setBoxVolume_m3, fieldDp, sealedAlignmentEditor, sealedAlignmentOpen,
     sealedAlignmentOptions, sealedAlignmentSelected, sealedAlignmentVolume_L, sealedAlignmentEbp,
     sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel,
    fbState, FB_TARGET_TIP, fmtU, clearVentFieldOn, enterVentFieldOn,
    boxResonance, rearQtc, prSystemTuning,
    fbUnreachable, fbUnreachableMsg, boxLossesOpen, isDual,
    frontVolume_m3, setFrontVolume_m3, frcHz, setFrcHz, rearResonance, frontChamberTuningLabel,
    model, startEdit, startTune, placement,
    activeVent, END_CORRECTION_OPTIONS, ventLState, portPipeResonance_hz,
    prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prAddedMassCell, prTuningCell, prResonanceMass, prFsMass_hz, dqOfCell, fmt,
    driveV, rsOhm, advTemp, advHumidity, advPressure, advAir,
    envTempDq, envHumidityDq, envPressureDq, commitAirTemp, commitAirHumidity, commitAirPressure, resetAirToAppDefaults,
    envTempStored, envHumidityStored, envPressureStored,
    projectName, projectCreator, projectCreated, projectModified, projectDescription,
    boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp,
    onFile, fileInput,
  };
}
