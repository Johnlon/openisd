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
import type {ComputedRef, Ref} from 'vue';
import {computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch} from 'vue';
import {
    addProject,
    allIssues,
    boxTypeIsSimulatable,
    copyProjectName,
    curvesData,
    definePassiveRadiator,
    driverName,
    duplicateFocusedProject,
    envDefaults,
    focusedProject,
    focusProject,
    formatInUnit as fmtU,
    isModified,
    markProjectSaved,
    maxData,
    openProjects,
    projectChanged,
    removeProject,
    resetProjectToGround,
    syncedP,
} from '../logic/appState.js';
import {cycleTraceColor, presentationState, traceColor} from '../logic/presentationState.js';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {
    clearVentField as clearVentFieldOn,
    enterVentField as enterVentFieldOn,
    ventFieldState as ventFieldStateOn,
} from '../logic/useVentGroup.js';
import {airForEnvironment, lossModeOptions, parseLossMode} from '../logic/environment.js';
import {buildPlotData, parseChartTabId, TAB_META} from '../logic/series.js';
import {createToneGenerator, type ToneGenerator} from '../logic/toneGenerator.js';
import {useApp} from '../logic/app.js';
import {useEscToClose} from '../logic/useEscToClose.js';
import {injectSplashModal} from './SplashModal-hooks.js';
import {clampedFrequency, interpolatedY, steppedFrequency} from '../logic/cursorFrequency.js';
import {ARRAY_WIRING_OPTIONS, BOX_TYPE_OPTIONS, END_CORRECTION_OPTIONS, VENT_SHAPE_OPTIONS} from '@openisd/design/fields';
import {countOptions, limits, precision as fieldDp} from '../logic/fields/uiFields.js';
import {inputChecked, inputFrom, inputValue, listeningElement, selectedOption, selectValue} from '../logic/domEvents.js';
import {createSealedAlignmentEditor} from './SealedAlignment-hooks.js';
import {createOgFilters} from './OgFilters-hooks.js';
import type {Calculated, Clearable, Entered, OpenISDProject, Readable, Writable} from '@openisd/design';
import type {ProvenanceLetter} from '../logic/fieldProvenance.js';
import {provenanceOf, provenanceOfEntry, provenanceOfSolved} from '../logic/fieldProvenance.js';
import type {StoredProjectListing} from '@openisd/persistence';
import type {BoxType, Engine, EnvDefaults} from '@openisd/design/engine';
import type {ChartTabId, Design, PlotParams} from '../types.js';

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
  engine: Engine;
}

export type AirField = 'temperature' | 'humidity' | 'pressure';

const AIR_FIELD_LIMITS: Readonly<Record<AirField, { min: number; max: number; label: string }>> = {
  temperature: { min: 0, max: 400, label: 'Temperature' },
  humidity: { min: 0, max: 100, label: 'Relative humidity' },
  pressure: { min: 1000, max: 200000, label: 'Air pressure' },
};

/** What `NumInput` binds for a field's data-quality flags. */
export interface DqReadout {
  readonly dq: readonly string[];
  readonly dqState: ProvenanceLetter;
}

/** The tab rail's closed set — every tab reads a project. Application settings live in the
 *  Options dialog. */
export type TabId = 'box' | 'driver' | 'enclosure' | 'filters' | 'signal' | 'advanced' | 'project';

/** Parse a persisted tab id — the one string→`TabId` boundary. A stored id the app no longer has
 *  must not come back as an active tab. */
export function isTabId(v: unknown): v is TabId {
  return v === 'box' || v === 'driver' || v === 'enclosure' || v === 'filters'
    || v === 'signal' || v === 'advanced' || v === 'project';
}

export function dqOfCell(engine: Engine, field: Readable<unknown> & Entered & Calculated): DqReadout {
  return { dq: field.dq.map(issue => engine.dqIssueText(issue)), dqState: provenanceOf(field) };
}

/** `dqOfCell` for a field that is entered or absent and has no `Calculated`. */
export function dqOfEntry(engine: Engine, field: Readable<unknown> & Entered): DqReadout {
  return { dq: field.dq.map(issue => engine.dqIssueText(issue)), dqState: provenanceOfEntry(field) };
}

/** `dqOfCell` for a field only a solver writes — calculated or absent, no `Entered`. */
export function dqOfSolved(engine: Engine, field: Readable<unknown> & Calculated): DqReadout {
  return { dq: field.dq.map(issue => engine.dqIssueText(issue)), dqState: provenanceOfSolved(field) };
}

export function airFieldDataQuality(field: AirField, value: number | null): readonly string[] {
  if (value == null) return [];
  const limit = AIR_FIELD_LIMITS[field];
  return Number.isFinite(value) && value >= limit.min && value <= limit.max
    ? []
    : [`${limit.label} is outside the sane range (${limit.min}–${limit.max})`];
}

export function createSealedReadouts({ project, selectedBox, projectChanged: changed, engine }: SealedReadoutsDeps) {
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
  // PR solved-pair DQ readouts, live: the editable added mass and target tuning (Fp), and the
  // two read-only outputs (system tuning, free-air resonance with mass). Each is a fresh
  // `DqReadout` per recompute — the field object itself never changes identity, so a computed
  // returning the field would not re-render its dependents.
  const prAddedMassDq = computed(() => { void changed.value; return dqOfCell(engine, project.value.box.passiveRadiator.addedMass_kg); });
  const prTuningDq = computed(() => { void changed.value; return dqOfCell(engine, project.value.box.passiveRadiator.tuning_goal_hz); });
  const prSystemTuningDq = computed(() => { void changed.value; return dqOfCell(engine, project.value.box.passiveRadiator.systemTuning_hz); });
  const prResonanceMassDq = computed(() => { void changed.value; return dqOfCell(engine, project.value.box.passiveRadiator.resonanceWithAddedMass_hz); });
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

  return { rearResonance, rearQtc, boxResonance, prAddedMassDq, prTuningDq, prSystemTuningDq, prResonanceMassDq, prFsMass_hz };
}

// ---- Box-type-generic rear-chamber volume (unit-testable, real domain) --------
// WinISD's single "Vb" field — every box type keeps its own volume field under its own
// `box.<type>` slice, so this dispatches on `selectedBox` to the type currently shown.
export interface BoxVolumeDeps {
  project: ComputedRef<OpenISDProject>;
  selectedBox: Ref<BoxType>;
  projectChanged: Ref<number>;
}

export const BAD_VOLUME_NOTE = 'Bad data: zero or less is not a physical volume. It is kept and saved exactly as entered — clear the field to fix it.';

/** BAD VALUE: a volume that cannot be physical (≤ 0). Zero is a value, not an absence. */
export function isBadVolume(v: number): boolean {
  return !(v > 0);
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

/** The one DQ note a box volume shows: its reason, or '' when there is nothing to say. */
export function volumeDqNote(v: number): string {
  return isBadVolume(v) ? BAD_VOLUME_NOTE : '';
}

export function createBoxVolume({ project, selectedBox, projectChanged: changed }: BoxVolumeDeps) {
  const boxVolume_m3 = computed<number | null>(() => {
    void changed.value;
    void project.value;
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'sealed': return box.sealed.volume_m3.value;
      case 'vented': return box.vented.volume_m3.value;
      case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
      case 'bandpass6': return box.bandpass6.chambers.rear.volume_m3.value;
      case 'abc': return box.abc.chambers.rear.volume_m3.value;
      case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
      default: return null;
    }
  });
  const boxVolumeDqNote = computed<string>(() => {
    const v = boxVolume_m3.value;
    return v == null ? '' : volumeDqNote(v);
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
  return { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 };
}

// ---- Signal tab: drive power P and drive voltage V -------------------------------
// V is never absent. While Re is known, P = V²/Re and the one typed last is entered. Without Re,
// P is blank and locked; its dq says why.
export interface DriveSignalDeps {
  project: ComputedRef<OpenISDProject>;
  projectChanged: Ref<number>;
}

export function createDriveSignal({ project, projectChanged: changed }: DriveSignalDeps) {
  // A deleted V goes back to its default through the domain's clear.
  function commitDriveV(v: number | null): void {
    if (v == null) project.value.driveVoltage_V.clear();
    else project.value.driveVoltage_V.set(v);
  }
  const driveV = computed<number | null>({
    get: () => {
      void changed.value; void project.value;
      return project.value.driveVoltage_V.value;
    },
    set: commitDriveV,
  });
  /** The blur-notify consumer for the drive trio's V cell: NumInput only reports "the cell was
   *  modified since entry", so the commit rule above runs again here. */
  function reconcileDriveV(committed: number | null): void {
    commitDriveV(committed);
  }
  /** P is blank exactly when the driver has no usable Re, and cannot be typed then. */
  const powerLocked = computed<boolean>(() => {
    void changed.value;
    return project.value.powerDrive_W.value === null;
  });
  return { driveV, reconcileDriveV, powerLocked };
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
}

type EnvField = Readable<number | null> & Entered & Calculated & Writable<number> & Clearable;

export function createEnvironmentAir({ project, projectChanged: changed, envDefaults }: EnvironmentAirDeps) {
  function storedOf(field: () => EnvField) {
    return computed<boolean>(() => { void changed.value; void project.value; return field().entered; });
  }
  function dqOf(airField: AirField, field: () => EnvField) {
    return computed<DqReadout>(() => {
      void changed.value;
      const f = field();
      return { dq: airFieldDataQuality(airField, f.value), dqState: provenanceOf(f) };
    });
  }
  function entryOf(field: () => EnvField) {
    return computed<number | null>({
      get: () => { void changed.value; void project.value; return field().value; },
      set: (v: number | null) => { if (typeof v === 'number' && Number.isFinite(v)) field().set(v); else field().clear(); },
    });
  }
  // A cleared cell DROPS its stored value (human ruling 2026-09-13, BUG human): deletion must
  // not re-seed the app default as an entered value. A field that is not entered reads the app
  // default (Options → General → Environment) as its calculated value — never blank, never
  // falsely "entered".
  function commitOf(field: () => EnvField) {
    return (): void => { const f = field(); if (f.value == null) f.clear(); };
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
    return airForEnvironment({
      tempK: advTemp.value ?? undefined, humidityPct: advHumidity.value ?? undefined, pressurePa: advPressure.value ?? undefined,
      useWinisdAirModel: project.value.envUseWinisdAirModel.value,
    });
  });
  return {
    envTempStored: storedOf(temp), envHumidityStored: storedOf(humidity), envPressureStored: storedOf(pressure),
    envTempDq: dqOf('temperature', temp), envHumidityDq: dqOf('humidity', humidity), envPressureDq: dqOf('pressure', pressure),
    advTemp, advHumidity, advPressure,
    commitAirTemp: commitOf(temp), commitAirHumidity: commitOf(humidity), commitAirPressure: commitOf(pressure),
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
  const { saveProject, importFile } = designIO;
  // The Info menu's "About OpenISD" opens the splash — the one place that text lives.
  const { show: about } = injectSplashModal();
  const { projectRepo } = useApp();
  const { editProjectDriver } = selection;

  // Fixed set, not per-render data — hoisted so the template doesn't allocate a fresh array
  // on every re-render.
  const LOSS_MODE_OPTIONS = lossModeOptions();
  // Sealed loss model (S10/QO130) — PROJECT-scoped, reversing QO90.
  const lossMode = computed<string>({
    get: () => { void projectChanged.value; return project.value.lossMode.value.value; },
    set: (v: string) => { project.value.lossMode.set(parseLossMode(v)); },
  });
  const N_DRIVERS_OPTIONS = countOptions('driver_nDrivers');
  const VENT_COUNT_OPTIONS = countOptions('vent_Count');

  // The focused project's own trace/legend colour — a project attribute (`presentationState.ts`,
  // keyed by uuid), not a page-level index: it must follow the project across focus switches,
  // not reshuffle when the sidebar's focus target changes.
  const WINISD_TRACE = computed(() => traceColor(project.value.uuid()));
  function cycleColor() { cycleTraceColor(project.value.uuid()); }

  // Chart top bar's Reset button — clears the shared sweep range and every chart's Y-axis zoom.
  // Both are global view state (`presentationState.ts`), not project data.
  function resetChartView() {
    presentationState.yRanges = {};
    presentationState.sweepRange = {min: 10, max: 20000};
  }

  function fmt(n: number | null | undefined, dp: number): string {
    return n != null && isFinite(n) ? n.toFixed(dp) : '—';
  }

  // ---- Box types — the registry's own list (`box_Type`), not a copy ------------------
  // Whether the circuit models this type is the DOMAIN's answer, asked through logic/.
  const isSimulatable = boxTypeIsSimulatable;
  // A presentation fact with no domain counterpart: these three draw two chambers.
  const DUAL_CHAMBER = new Set<BoxType>(['bandpass4', 'bandpass6', 'abc']);

  // selectedBox is the Box tab's source of truth: it can hold types the solver refuses. Its
  // initial value comes from the focused project when one is open — the shell renders, with
  // empty placeholders, without one, and `useFocusedProject()` must not be evaluated then.
  const selectedBox = ref<BoxType>(focusedProject()?.box.boxType.value ?? 'sealed');
  watch(selectedBox, (b) => {
    const p = focusedProject();
    if (isSimulatable(b) && p && p.box.boxType.value !== b) p.box.boxType.set(b);
  });
  watch(
    () => { void projectChanged.value; return focusedProject()?.box.boxType.value; },
    (b) => { if (b != null && selectedBox.value !== b) selectedBox.value = b; },
  );

  const pending = computed(() => !isSimulatable(selectedBox.value));
  const isDual = computed(() => DUAL_CHAMBER.has(selectedBox.value));
  const boxLabel = computed(() => BOX_TYPE_OPTIONS.find(o => o.value === selectedBox.value)?.label ?? 'Box');
  const enclosureNavLabel = computed(() =>
    selectedBox.value === 'box-passive-radiator' ? 'Passive Radiator'
      : selectedBox.value === 'sealed' ? 'Closed'
        : boxLabel.value);
  const showEnclosureTab = computed(() => selectedBox.value !== 'sealed');

  // ---- Live engine-derived readouts (never faked literals) -----------------------
  const {
    rearResonance, rearQtc, boxResonance,
    prAddedMassDq, prTuningDq, prSystemTuningDq, prResonanceMassDq, prFsMass_hz,
  } = sealedReadouts({ project, selectedBox, projectChanged, engine });
  const sealedAlignmentEditor = createSealedAlignmentEditor({ project, changed: projectChanged, engine });
  const ogFilters = createOgFilters({ project, changed: projectChanged, engine });
  const sealedAlignmentOpen = sealedAlignmentEditor.open;
  const sealedAlignmentOptions = sealedAlignmentEditor.options;
  const sealedAlignmentSelected = sealedAlignmentEditor.selectedOption;
  const sealedAlignmentVolume_L = sealedAlignmentEditor.volume_L;
  const sealedAlignmentEbp = sealedAlignmentEditor.ebp;
  const sealedAlignmentSuitability = sealedAlignmentEditor.ebpSuitability;
  const sealedAlignmentSuitabilityLabel = sealedAlignmentEditor.ebpSuitabilityLabel;

  // Box-type-generic rear-chamber volume (WinISD "Vb") — the Box tab's single "Volume" field
  // dispatches through the unit-tested `createBoxVolume` above.
  const { boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3 } = createBoxVolume({ project, selectedBox, projectChanged });
  // Front-chamber volume (WinISD "Vf") — dual-chamber types only (bandpass4/6, abc).
  const frontVolume_m3 = computed<number | null>(() => {
    void projectChanged.value;
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'bandpass4': return box.bandpass4.chambers.front.volume_m3.value;
      case 'bandpass6': return box.bandpass6.chambers.front.volume_m3.value;
      case 'abc': return box.abc.chambers.front.volume_m3.value;
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
    void projectChanged.value; void project.value;
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'bandpass6': return box.bandpass6.chambers.rear.tuning_goal_hz.value;
      case 'abc': return box.abc.chambers.rear.tuning_goal_hz.value;
      default: return null;
    }
  });
  function setFrcHz(v: number): void {
    const box = project.value.box;
    switch (selectedBox.value) {
      case 'bandpass6': box.bandpass6.chambers.rear.tuning_goal_hz.set(v); break;
      case 'abc': box.abc.chambers.rear.tuning_goal_hz.set(v); break;
    }
  }
  // Box-level Ql/Qa/Qp (WinISD's Box losses modal) — each box type keeps its own losses window.
  const boxQl = computed<number | null>(() => {
    const p = focusedProject();
    if (!p) return null;
    const box = p.box;
    switch (selectedBox.value) {
      case 'sealed': return box.sealed.losses.Ql.value;
      case 'vented': return box.vented.losses.Ql.value;
      case 'bandpass4': return box.bandpass4.chambers.rear.losses.Ql.value;
      case 'box-passive-radiator': return box.passiveRadiator.losses.Ql.value;
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
      case 'sealed': return box.sealed.losses.Qa.value;
      case 'vented': return box.vented.losses.Qa.value;
      case 'bandpass4': return box.bandpass4.chambers.rear.losses.Qa.value;
      case 'box-passive-radiator': return box.passiveRadiator.losses.Qa.value;
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
      case 'vented': return box.vented.losses.Qp.value;
      case 'bandpass4': return box.bandpass4.chambers.front.losses.Qp.value;
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
    const L = activeVent.value.length_m.value;
    if (L == null || L <= 0) return null;
    return advAir.value.c / (2 * L);
  });
  // Single-chamber vented tuning uses Vb (the whole box); the bandpass front chamber tunes on
  // its own front volume Vf. The four below are READ-ONLY derived values shown in more than one
  // place (E/C/N badges, warning banners) — genuinely DERIVED state.
  const fbState    = computed<'E' | 'C' | 'N'>(() => { void projectChanged.value; void project.value; return ventFieldStateOn(project.value, 'Fb'); });
  const ventLState = computed<'E' | 'C' | 'N'>(() => { void projectChanged.value; void project.value; return ventFieldStateOn(project.value, 'ventL'); });
  /** The vent's own dq — a `target-unreachable` mark means the entered tuning has no positive
   *  port length in this volume/area; the solver already wrote `length_m` null. */
  const fbUnreachableIssue = computed(() => {
    void projectChanged.value; void project.value;
    return activeVent.value.length_m.dq.find(issue => issue.kind === 'target-unreachable') ?? null;
  });
  const fbUnreachable = computed(() => fbUnreachableIssue.value !== null);
  /** The vent's own dq sentence — the engine's `dqIssueText` is the one place that turns an
   *  issue into text, so the Box tab and the Vents tab say the same thing. */
  const fbUnreachableMsg = computed(() => {
    const issue = fbUnreachableIssue.value;
    return issue === null ? '' : engine.dqIssueText(issue);
  });
  /** The front chamber of a bandpass is vented on its OWN volume, so it carries its own symbol. */
  const frontChamberTuningLabel = computed(() =>
    DUAL_CHAMBER.has(selectedBox.value) ? 'Target Tuning Freq (Ffc)' : 'Target Tuning Freq');
  /** The tooltip the QO11 ruling requires: Fb is the target the port solver designs to. */
  const FB_TARGET_TIP = 'The tuning you are designing to. It is an INPUT, not a readout: the '
    + 'port dimensions are calculated from it — the vent length on the enclosure tab is solved '
    + 'to deliver this tuning, and moves whenever you change the vent diameter or the volume.';
  /** Cross area is a solved pair with the vent's own shape dimension — diameter round, height
   *  slotted. Width is always an input, never derived. */
  const VENT_GEOMETRY_TIP = 'Cross area is solved from the vent\'s own dimension: diameter for a '
    + 'round vent, height for a slotted one. Width is always an input, never derived. Enter '
    + 'either the dimension or the area and the other is calculated from it.';

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
  // Cursor fields are PROJECT-scoped (QO130/QO168) — read through `project.value.*`, and
  // `projectChanged` must be read too or the readout freezes (see `createSealedReadouts` above).
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
    const p = project.value;
    p.pinnedF.set(f);
    p.cursorF.set(f);
    p.cursorLocked.set(f != null);
  }

  function spinHz(dir: number, factor = 1.02) {
    const f = steppedFrequency({ current: cursorHz.value, dir, factor, fmin: fmin.value, fmax: fmax.value });
    const p = project.value;
    p.pinnedF.set(f);
    p.cursorF.set(f);
    p.cursorLocked.set(true);
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
    driver: project.value.driver.solverParams, box: project.value.box.boxType.value, P: syncedP.value,
    curves: curvesData.value, maxCurves: maxData.value ?? undefined, name: rowName(project.value),
    color: WINISD_TRACE.value, visible: isRowVisible(project.value),
    sortIndex: openProjects().indexOf(project.value),
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

  // Graph visibility is UI-only per-project state — a WeakMap here, the same pattern
  // `appState.ts` itself uses for `groundByProject`. `reactive()` so the template's row
  // class/checkbox bindings invalidate on `.set()`. `visibleRevision` is the DEPENDABLE
  // dependency for the compare-overlay computed: a `reactive()` WeakMap's key operations are
  // not reliably trackable inside a computed (Vue treats WeakMap as a COMMON target, so the
  // computed does not re-evaluate on a `.set()`), while a plain ref always fires.
  const visibleOf = reactive(new WeakMap<OpenISDProject, boolean>());
  const visibleRevision = ref(0);
  function isRowVisible(p: OpenISDProject): boolean { return visibleOf.get(p) ?? true; }
  function setRowVisible(p: OpenISDProject, v: boolean): void { visibleOf.set(p, v); visibleRevision.value++; }

  /** Whether this row's project has unsaved edits — every row, not only the focused one
   *  (John, 2026-09-24: the unsaved mark "only shows for the focused project - it needs to be
   *  always visible"). `projectChanged` ticks for the focused project's edits; a background
   *  project cannot be edited, so its answer only changes on focus, save or open. */
  function rowUnsaved(p: OpenISDProject): boolean {
    void projectChanged.value; void project.value;
    return p.isModified();
  }

  /** Each row's display name — the project's own `name` field, falling back to the driver name. */
  function rowName(p: OpenISDProject): string {
    if (p === project.value) return project.value.name.value || driverName.value;
    const name = p.name.value;
    if (name) return name;
    const brand = p.driver.brand.value;
    const model2 = p.driver.model.value;
    return [brand, model2].filter(x => x.length > 0).join(' ').trim();
  }

  function selectProject(p: OpenISDProject) {
    const idx = projectList.value.indexOf(p);
    if (idx >= 0) focusProject(idx);
  }

// Compare-overlay curves: a Design per OTHER open project, swept on its own frequency range,
// following each row's show/hide checkbox. The focused project is the primary design; every
// other open project contributes a trace (BUG_20260917_nonfocused-project-traces-never-drawn).
// A project the engine cannot sweep (bandpass6/abc, or an incomplete driver) contributes
// nothing — `buildPlotData` would crash on an overlay without curves.
const overlays = computed<Design[]>(() => {
  void projectChanged.value;
  void visibleRevision.value;
  const focused = project.value;
  const projects = openProjects();
  const out: Design[] = [];
  for (const p of projects) {
    if (p === focused) continue;
    const box = p.box.boxType.value;
    if (!boxTypeIsSimulatable(box)) continue;
    const prXmax = box === 'box-passive-radiator'
      ? (p.box.passiveRadiator.radiator.spec.Xmax_m.value ?? undefined)
      : undefined;
    const P: PlotParams = {
      fmin: presentationState.sweepRange.min,
      fmax: presentationState.sweepRange.max,
      splXmaxLimited: p.splGraphIsXmaxLimited.value,
      prXmax,
    };
    const sw = p.sweep({ fmin: P.fmin, fmax: P.fmax });
    const mx = p.maxCurves({ fmin: P.fmin, fmax: P.fmax });
    if (!sw.values || !mx.values) continue;
    out.push({
      driver: p.driver.solverParams,
      box,
      P,
      curves: sw.values,
      maxCurves: mx.values,
      name: rowName(p),
      color: traceColor(p.uuid()),
      visible: isRowVisible(p),
      // Legend/draw order follows the sidebar's project list order, not "current first"
      // (John, 2026-09-24: "Dont change the legend project order - keep it the same as the
      // side bar proj list").
      sortIndex: projects.indexOf(p),
    });
  }
  return out;
});

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
  const projectCreated = metaField(() => project.value.created.value, (v) => project.value.created.set(v));
  const projectModified = metaField(() => project.value.modified.value, (v) => project.value.modified.set(v));
  const projectDescription = metaField(() => project.value.description.value, (v) => project.value.description.set(v));

  // ---- Signal Generator (real audio-out tone) ------------------------------------
  const genOn = ref(false);
  const genHz = ref(1000);
  let tone: ToneGenerator | null = null;
  function toggleGenerate() { tone ??= createToneGenerator(); if (genOn.value) tone.start(genHz.value); else tone.stop(); }
  watch(genHz, v => { if (genOn.value) tone?.setFrequency(v); });
  onUnmounted(() => tone?.stop());

  // ---- Signal tab: drive voltage = √(Pin × Re) per driver ------------------------
  // Delegated to the unit-tested `createDriveSignal` above.
  const { driveV, reconcileDriveV, powerLocked } = createDriveSignal({ project, projectChanged });
  // Series resistance — read through `projectChanged` so a typed value sticks.
  const rsOhm = computed<number>({
    get: () => { void projectChanged.value; void project.value; return project.value.Rs_ohm.value; },
    set: (v) => { project.value.Rs_ohm.set(v ?? 0); },
  });

  // ---- Advanced tab: environment ------------------------------------------------
  // Delegated to the unit-tested `createEnvironmentAir` above.
  const {
    envTempStored, envHumidityStored, envPressureStored, envTempDq, envHumidityDq, envPressureDq,
    advTemp, advHumidity, advPressure, commitAirTemp, commitAirHumidity, commitAirPressure,
    resetAirToAppDefaults, advAir,
  } = createEnvironmentAir({ project, projectChanged, envDefaults });

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

  // R1 refresh fidelity — RECORD an open Tune / Driver Editor so a reload can restore it.
  // Restoring is the boot's own phase (`logic/boot.ts`), which runs it after the project and
  // the view are in place; a watcher here would fire on whatever order the flags happened to
  // arrive in, which is how a panel came to mount with no project (openisd.app 2026-09-25).
  watch(() => presentationState.editDriver, (active) => {
    presentationState.ui.originalTuneOpen = active;
  });

  watch(isModified, (val) => {
    if (val) {
      project.value.modified.set(dateStamp(new Date()));
    }
  });

  // Same for the Driver Editor modal — recorded here, restored by the boot.
  watch(() => presentationState.editDriverInfo, (open) => { presentationState.ui.originalEditorOpen = open; });

  /** The shell renders without a project now: true tells the toolbar to grey the project-only
   *  buttons and the placeholders to stand in for the chart, tab pane and project list. */
  const focused = computed(() => focusedProject());
  const projectOpen = computed(() => focusedProject() != null);
  const whatIfActive = computed(() => {
    void projectChanged.value;
    return project.value.isWhatIfActive();
  });

  const applyWinisdSettings = () => {
    project.value.applyWinisdSettings();
  };

  return {
    version, toggleDropdown, openDd, openClick, closeDropdown, presentationState, isModified,
    openDialogOpen, storedProjects, openFromDisk, openStoredProject,
    saveProject, resetProjectToGround, confirmDiscard, about, optionsOpen,
    chartLabel, CHART_ITEMS, selectChart,
    hzInputText, inputValue, onHzInputFocus, onHzInputBlur, onHzKeydown, onHzWheel,
    startNudge, stopNudge, cursorHz, cursorVal, chartMeta, inputChecked, selectValue, selectedOption,
    WINISD_TRACE, cycleColor, resetChartView, chartMax,
    mainEl, navCollapsed, bottomCollapsed, mainStyle, onNavSplitDown, onBottomSplitDown,
    projectList, isRowVisible, setRowVisible, rowName, rowUnsaved, selectProject, project, focused, projectOpen, whatIfActive,
    copyCurrentProject, requestCloseProject, closeChallenge, saveThenClose, closeProject,
    genOn, toggleGenerate, genHz, limits,
    boxLabel, pending, chartTab, overlays, chartUnavailable, activeTab,
    showEnclosureTab, enclosureNavLabel,
    selectedBox, BOX_TYPE_OPTIONS, LOSS_MODE_OPTIONS, lossMode, ARRAY_WIRING_OPTIONS, N_DRIVERS_OPTIONS, applyWinisdSettings,
     boxVolume_m3, boxVolumeDqNote, setBoxVolume_m3, fieldDp, sealedAlignmentEditor, sealedAlignmentOpen,
     sealedAlignmentOptions, sealedAlignmentSelected, sealedAlignmentVolume_L, sealedAlignmentEbp,
     sealedAlignmentSuitability, sealedAlignmentSuitabilityLabel, ogFilters,
    fbState, FB_TARGET_TIP, VENT_GEOMETRY_TIP, fmtU, clearVentFieldOn, enterVentFieldOn,
    boxResonance, rearQtc, prSystemTuningDq,
    fbUnreachable, fbUnreachableMsg, boxLossesOpen, isDual,
    frontVolume_m3, setFrontVolume_m3, frcHz, setFrcHz, rearResonance, frontChamberTuningLabel,
    model, startEdit, startTune, placement,
    activeVent, END_CORRECTION_OPTIONS, VENT_SHAPE_OPTIONS, VENT_COUNT_OPTIONS, ventLState, portPipeResonance_hz,
    prBrowseOpen, prEditOpen, loadPREntry, loadBundledPassiveRadiatorEntry, defineNewPREntry,
    prAddedMassDq, prTuningDq, prResonanceMassDq, prFsMass_hz,
    dqOfCell: (field: Readable<unknown> & Entered & Calculated) => dqOfCell(engine, field),
    dqOfEntry: (field: Readable<unknown> & Entered) => dqOfEntry(engine, field),
    dqOfSolved: (field: Readable<unknown> & Calculated) => dqOfSolved(engine, field),
    fmt,
    driveV, rsOhm, advTemp, advHumidity, advPressure, advAir,
    envTempDq, envHumidityDq, envPressureDq, commitAirTemp, commitAirHumidity, commitAirPressure, resetAirToAppDefaults,
    envTempStored, envHumidityStored, envPressureStored,
    reconcileDriveV,
    powerLocked,
    projectName, projectCreator, projectCreated, projectModified, projectDescription,
    boxQl, setBoxQl, boxQa, setBoxQa, boxQp, setBoxQp,
    onFile, fileInput,
  };
}
