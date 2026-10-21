import { computed, type ComputedRef, ref, type Ref, shallowRef, triggerRef, watch } from 'vue';
// Type-only: the store constructs projects (`newProject()`) and owns the engine instance; this
// hook only names their shapes, so neither import is a layering edge (QO80).
import { type OpenISDDriver, type OpenISDProject, OpenISDPassiveRadiatorStandalone, startingChambersOf, takesChamberTunings, WizardPlan, WizardStep } from '@openisd/design';
import type { BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo } from '@openisd/persistence';
import type { BoxType, EbpSuitability, SealedEngine, VentedAlignment, VentedEngine, Wiring } from '@openisd/design/engine';
import {ARRAY_WIRING_OPTIONS, DEFAULT_NEW_PROJECT_QA, DEFAULT_NEW_PROJECT_VENTED_QL, DEFAULT_SOURCE_RESISTANCE_OHM, DEFAULT_VENTED_ALIGNMENT, NumberField, SEALED_ALIGNMENT_OPTIONS, VENTED_ALIGNMENT_OPTIONS, type SelectorOption} from '@openisd/design/fields';
import {DUAL_CHAMBER} from './boxFields.js';
import {useApp} from '../logic/app.js';
import type {AppState} from '../logic/appState.js';
import { selectedOption } from '../logic/domEvents.js';
import { useRecentActions } from './telemetryContext.js';

/** The two engine areas the wizard consults; the app facade's by default, substitutes in a test. */
export interface OriginalNewProjectEngineAreas {
  readonly sealed: SealedEngine;
  readonly vented: VentedEngine;
}

/** What the passive-radiator step shows: the chosen radiator's name and WinISD's five parameters. */
export interface PassiveRadiatorStepView {
  readonly name: string;
  readonly Vas_m3: number | null;
  readonly Qms: number | null;
  readonly Fs_hz: number | null;
  readonly Sd_m2: number | null;
  readonly Xmax_m: number | null;
}

/** The step's writes, one per field; null clears a parameter. Writing with no radiator chosen
 *  defines a new one first, so the fields can be typed into directly. */
export interface PassiveRadiatorStepEdits {
  setName(v: string): void;
  setVas_m3(v: number | null): void;
  setQms(v: number | null): void;
  setFs_hz(v: number | null): void;
  setSd_m2(v: number | null): void;
  setXmax_m(v: number | null): void;
}

/** Where the passive-radiator step finds radiators: the user's saved ones and the bundled catalogue. */
export interface NewProjectPassiveRadiatorRepos {
  readonly saved: MyPassiveRadiatorRepo;
  readonly bundled: BundledPassiveRadiatorRepo;
}

export interface OriginalNewProjectDeps {
  areas?: OriginalNewProjectEngineAreas;
  passiveRadiators?: NewProjectPassiveRadiatorRepos;
  initialDriver?: OpenISDDriver | null;
  /** The app state the wizard creates its project in; the app facade's by default. */
  appState?: AppState;
}

export interface OriginalNewProjectAPI {
  // Navigation & Step state
  readonly step: Ref<WizardStep>;
  readonly totalSteps: ComputedRef<number>;
  readonly currentStepNumber: ComputedRef<number>;
  readonly stepLabel: ComputedRef<string>;
  /** Which page the wizard is on; the skins draw one page at a time. */
  readonly isDriverStep: ComputedRef<boolean>;
  readonly isCountStep: ComputedRef<boolean>;
  readonly isBoxTypeStep: ComputedRef<boolean>;
  readonly isBoxDetailsStep: ComputedRef<boolean>;
  readonly isProjectInfoStep: ComputedRef<boolean>;
  readonly hadUnsaved: ComputedRef<boolean>;

  // Step 1: Driver Selection
  readonly selectedDriver: Ref<OpenISDDriver | null>;
  readonly selectedDriverName: ComputedRef<string>;
  /** The step-1 preview lines (Fs / Qts / Vas) for the chosen driver; empty with no driver. */
  readonly selectedDriverSpecs: ComputedRef<readonly string[]>;
  selectDriver(driver: OpenISDDriver): void;

  // Step 2: Driver count & placement
  readonly nDrivers: Ref<number>;
  readonly placement: Ref<'standard' | 'iso'>;
  readonly wiring: Ref<Wiring>;
  readonly N_DRIVERS_OPTIONS: readonly SelectorOption<number>[];
  readonly ARRAY_WIRING_OPTIONS: readonly SelectorOption<Wiring>[];

  // Step 3: Box type & starting volume (non-sealed types; a sealed box gets its volume from step 4)
  readonly boxType: Ref<BoxType>;
  readonly BOX_OPTIONS: readonly SelectorOption<BoxType>[];
  /** False for a type OpenISD has not finished; its row is dimmed. */
  readonly IMPLEMENTED_BOX_TYPES: readonly BoxType[];
  /** Starting (rear-chamber) volume, SI. */
  readonly volume_m3: Ref<number>;
  /** Front-chamber volume of a dual-chamber box, SI. */
  readonly frontVolume_m3: Ref<number>;
  readonly isDual: ComputedRef<boolean>;
  /** True when the dual-chamber type takes tunings on this step (bandpass6 and ABC). */
  readonly hasTunings: ComputedRef<boolean>;
  /** Rear-chamber tuning of a bandpass6 or ABC box, Hz. */
  readonly rearTuning_hz: Ref<number>;
  /** Front-chamber tuning of a bandpass6 or ABC box, Hz. */
  readonly frontTuning_hz: Ref<number>;
  readonly isSealed: ComputedRef<boolean>;
  readonly isVented: ComputedRef<boolean>;

  // EBP & Suitability readout (Step 3 & Step 4)
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;

  // Step 4: Sealed Alignment
  readonly SEALED_ALIGNMENT_OPTIONS: readonly SelectorOption<number>[];
  readonly selectedSealedAlignment: ComputedRef<SelectorOption<number> | null>;
  readonly targetQtc: Ref<number>;
  readonly qtc: ComputedRef<number | null>;
  /** The sealed box resonance Fsc (Hz) at the chosen volume; null without a driver. */
  readonly sealedFsc_hz: ComputedRef<number | null>;
  /** The sealed box volume, SI: derived from the chosen alignment, editable on step 4. */
  readonly sealedVolume_m3: Ref<number>;
  selectSealedAlignment(qtc: number): void;
  /** The ≠W cue by the sealed picker shows: the open project's "Sealed picker volume" switch is unticked. */
  readonly sealedPickerDeviationShown: ComputedRef<boolean>;
  setSealedVolume_m3(volume_m3: number): void;

  // Step 4: Vented Alignment — WinISD's five, designed as its wizard does
  // (docs/research/VENTED_ALIGNMENT_FORMULAS.md)
  readonly VENTED_ALIGNMENT_OPTIONS: readonly SelectorOption<VentedAlignment>[];
  readonly selectedVentedAlignment: Ref<VentedAlignment>;
  selectVentedAlignment(alignment: VentedAlignment): void;
  /** The vented box volume on show, SI: the alignment's, until one is typed. */
  readonly ventedVolume_m3: ComputedRef<number>;
  /** The same volume in litres. */
  readonly ventedVolume_L: ComputedRef<number>;
  /** The tuning frequency on show, Hz: the alignment's, until one is typed. */
  readonly ventedTuning_hz: ComputedRef<number>;
  /** Types a vented volume, SI; it replaces the alignment's until another alignment is picked. */
  setVentedVolume_m3(v: number): void;
  /** Types a vented tuning, Hz; it replaces the alignment's until another alignment is picked. */
  setVentedTuning_hz(v: number): void;
  /** Why `ventedVolume_L` is implausible, or null when it is not. The value itself is WinISD's
   *  own answer and is never changed — extrapolated designs are marked, not clamped. */
  readonly ventedVolumeWarning: ComputedRef<string | null>;
  /** Why `ventedTuning_hz` is implausible, or null when it is not. */
  readonly ventedTuningWarning: ComputedRef<string | null>;

  // Step 4: Passive Radiator — WinISD's wizard asks for the radiator (Vas / Qms / Fs / Sd / Xmax)
  readonly isPassiveRadiator: ComputedRef<boolean>;
  /** The chosen radiator as the step shows it; null until one is chosen or defined. */
  readonly passiveRadiatorView: ComputedRef<PassiveRadiatorStepView | null>;
  readonly passiveRadiatorEdits: PassiveRadiatorStepEdits;
  /** The PR picker is open over the step; choosing or defining a radiator closes it. */
  readonly passiveRadiatorBrowseOpen: Ref<boolean>;
  /** Choose a saved radiator by its uuid. */
  loadSavedPassiveRadiator(uuid: string): void;
  /** Choose a bundled radiator by its catalogue id. */
  loadBundledPassiveRadiator(uuid: string): Promise<void>;
  /** Start a radiator that states nothing, for the user to type in. */
  defineNewPassiveRadiator(): void;

  // Step 5: Metadata
  readonly projName: Ref<string>;
  readonly projDescription: Ref<string>;

  /** Every `<select>` in the wizard resolves its choice against its option list through this —
   *  the template never parses a select's string itself (see `field-registry.test.ts and no-handwritten-select-options.test.ts`). */
  readonly selectedOption: typeof selectedOption;

  // Controls & Actions
  readonly canNext: ComputedRef<boolean>;
  readonly canBack: ComputedRef<boolean>;
  readonly canCreate: ComputedRef<boolean>;
  next(): void;
  back(): void;
  createProject(): OpenISDProject | null;
  cancel(): void;
}

/** The vented `Ql` a new project is born with — ONE declaration in `fields/defaults.ts`, shared
 *  with `domain/boxDefaults.ts`'s starting losses. The preview runs before the project exists, so
 *  it reads the same constant; the test pins it to the created project's own value.
 *  Re-exported so the test can pin the sharing without a second import path. */
export const NEW_PROJECT_VENTED_QL = DEFAULT_NEW_PROJECT_VENTED_QL;

/** The losses a new closed box starts with, the ones the preview's Qtc and volume are worked out under. */
const NEW_PROJECT_SEALED_LOSSES = {Ql: DEFAULT_NEW_PROJECT_VENTED_QL, Qa: DEFAULT_NEW_PROJECT_QA};

export function useOgNewProject(deps?: OriginalNewProjectDeps): OriginalNewProjectAPI {
  const { IMPLEMENTED_BOX_TYPES, createProject: createProjectInStore, focusedProject, isModified, newProjectBoxTypeOptions, newProjectDriver } = deps?.appState ?? useApp().appState;
  const eng: OriginalNewProjectEngineAreas = deps?.areas ?? useApp().engine;
  const prRepos: NewProjectPassiveRadiatorRepos = deps?.passiveRadiators
    ?? { saved: useApp().myPassiveRadiators, bundled: useApp().bundledPassiveRadiators };
  const initialDriver = deps?.initialDriver ?? newProjectDriver.value ?? null;
  const recentActions = useRecentActions();

  const step = shallowRef<WizardStep>(WizardStep.DRIVER);
  const selectedDriver = shallowRef<OpenISDDriver | null>(initialDriver);

  const nDrivers = ref(1);
  const placement = ref<'standard' | 'iso'>('standard');
  const wiring = ref<Wiring>('parallel');

  const boxType = ref<BoxType>('sealed');
  const BOX_OPTIONS = newProjectBoxTypeOptions();
  // Starting volume for the non-sealed box types (WinISD's default); a sealed box takes its
  // volume from the alignment on step 4 instead, so the two never overwrite each other.
  const startChambers = startingChambersOf('bandpass4');
  const volume_m3 = ref(startChambers.rearVolume_m3);
  const frontVolume_m3 = ref(startChambers.frontVolume_m3);
  const rearTuning_hz = ref(startingChambersOf('bandpass6').rearTuning_hz ?? startChambers.frontTuning_hz);
  const frontTuning_hz = ref(startChambers.frontTuning_hz);
  // A new dual-chamber type starts from its own chambers; an unchanged type keeps the user's edits.
  watch(boxType, (type) => {
    if (type !== 'bandpass4' && type !== 'bandpass6' && type !== 'abc') return;
    const start = startingChambersOf(type);
    volume_m3.value = start.rearVolume_m3;
    frontVolume_m3.value = start.frontVolume_m3;
    rearTuning_hz.value = start.rearTuning_hz ?? rearTuning_hz.value;
    frontTuning_hz.value = start.frontTuning_hz;
  }, { flush: 'sync' });
  const targetQtc = ref(0.707);
  const sealedVolume_m3 = ref(NumberField.BOX_VB_L.toSI(7));
  const selectedVentedAlignment = ref<VentedAlignment>(DEFAULT_VENTED_ALIGNMENT);

  const projName = ref('');
  const projDescription = ref('');

  const N_DRIVERS_OPTIONS = NumberField.DRIVER_NDRIVERS.countOptions();

  const hadUnsaved = computed(() => isModified.value);

  const isDual = computed(() => DUAL_CHAMBER.has(boxType.value));
  const hasTunings = computed(() => takesChamberTunings(boxType.value));
  const isSealed = computed(() => boxType.value === 'sealed');
  const isVented = computed(() => boxType.value === 'vented');
  const isPassiveRadiator = computed(() => boxType.value === 'box-passive-radiator');
  const plan = computed(() => WizardPlan.of(boxType.value));
  const totalSteps = computed(() => plan.value.total);
  const currentStepNumber = computed(() => plan.value.numberOf(step.value) ?? plan.value.total);
  const stepLabel = computed(() => plan.value.labelOf(step.value));
  const isDriverStep = computed(() => step.value === WizardStep.DRIVER);
  const isCountStep = computed(() => step.value === WizardStep.COUNT);
  const isBoxTypeStep = computed(() => step.value === WizardStep.BOX_TYPE);
  const isBoxDetailsStep = computed(() => step.value === WizardStep.BOX_DETAILS);
  const isProjectInfoStep = computed(() => step.value === WizardStep.PROJECT_INFO);

  const selectedDriverName = computed<string>(() => {
    if (!selectedDriver.value) return 'No driver selected';
    const m = selectedDriver.value.model;
    const b = selectedDriver.value.brand;
    const model = typeof m === 'string' ? m : m?.value ?? '';
    const brand = typeof b === 'string' ? b : b?.value ?? '';
    if (model && brand) return `${brand} ${model}`;
    return model || brand || 'Selected driver';
  });

  const selectedDriverSpecs = computed<readonly string[]>(() => {
    const driver = selectedDriver.value;
    if (!driver) return [];
    const lines: string[] = [];
    const Fs_hz = driver.specs.Fs_hz.value;
    const Qts = driver.specs.Qts.value;
    const Vas_m3 = driver.specs.Vas_m3.value;
    if (Fs_hz != null) lines.push(`Fs: ${Fs_hz} ${NumberField.FS_HZ.unitLabel()}`);
    if (Qts != null) lines.push(`Qts: ${Qts}`);
    if (Vas_m3 != null) lines.push(`Vas: ${NumberField.VAS_M3.format(Vas_m3)} ${NumberField.VAS_M3.unitLabel()}`);
    return lines;
  });

  const ebp = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return driver.ebp();
  });

  const ebpSuitability = computed(() => selectedDriver.value?.ebpSuitability() ?? null);

  const ebpSuitabilityLabel = computed(() => {
    switch (ebpSuitability.value) {
      case 'sealed':
        return 'Sealed preferred';
      case 'vented':
        return 'Vented preferred';
      case 'either':
        return 'Either sealed or vented';
      case null:
        return 'Suitability unavailable';
    }
  });

  const qtc = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return driver.sealedQtc(sealedVolume_m3.value, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_SEALED_LOSSES);
  });

  const sealedFsc_hz = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return driver.sealedFsc(sealedVolume_m3.value, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_SEALED_LOSSES);
  });

  const selectedSealedAlignment = computed(() => {
    return qtc.value != null ? eng.sealed.closestAlignment(qtc.value) : null;
  });

  /** The "Sealed picker volume" switch of the project open behind the wizard; unticked with none open,
   *  as in a new project. */
  const winisdSealedPicker = (): boolean => focusedProject()?.winisdSealedPicker.value ?? false;
  const sealedPickerDeviationShown = computed(() => !winisdSealedPicker());

  /** Re-derive the sealed volume from the current driver and target Qtc; a driver without
   *  Qts/Vas leaves the previous volume standing. */
  function recomputeSealedVolume(driver: OpenISDDriver, target: number): void {
    const winisdPicker = winisdSealedPicker();
    const calculated_m3 = driver.sealedPickerVolume(target, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_SEALED_LOSSES, winisdPicker);
    // Vb is a 2dp field everywhere else in the app — match that here instead of showing the solver's raw float.
    if (calculated_m3 != null) {
      sealedVolume_m3.value = NumberField.BOX_VB_L.toSI(Number(NumberField.BOX_VB_L.format(calculated_m3)));
    }
  }

  function selectDriver(driver: OpenISDDriver): void {
    selectedDriver.value = driver;
    ventedVolumeTyped_m3.value = null;
    ventedTuningTyped_hz.value = null;
    recomputeSealedVolume(driver, targetQtc.value);
    // "Use" in the step-1 driver picker is the step's whole job — done, move on.
    if (step.value === WizardStep.DRIVER) next();
  }

  function selectSealedAlignment(target: number): void {
    targetQtc.value = target;
    if (selectedDriver.value) recomputeSealedVolume(selectedDriver.value, target);
  }

  function setSealedVolume_m3(v: number): void {
    sealedVolume_m3.value = v;
  }

  /** A volume or tuning typed over the alignment's; null while the alignment's own is on show. */
  const ventedVolumeTyped_m3 = ref<number | null>(null);
  const ventedTuningTyped_hz = ref<number | null>(null);

  function selectVentedAlignment(alignment: VentedAlignment): void {
    selectedVentedAlignment.value = alignment;
    ventedVolumeTyped_m3.value = null;
    ventedTuningTyped_hz.value = null;
  }

  function setVentedVolume_m3(v: number): void {
    ventedVolumeTyped_m3.value = v;
  }

  function setVentedTuning_hz(v: number): void {
    ventedTuningTyped_hz.value = v;
  }

  /** WinISD designs the vented box for the driver AS DRIVEN — Qts with the project's series
   *  resistance folded into Qes — not the bare datasheet Qts (`OpenISDDriver.ventedDesign`). */
  const ventedAlignmentResult = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return driver.ventedDesign(selectedVentedAlignment.value, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_VENTED_QL);
  });

  const ventedVolume_m3 = computed(() => ventedVolumeTyped_m3.value ?? ventedAlignmentResult.value?.Vb ?? 0);
  const ventedVolume_L = computed(() => NumberField.BOX_VB_L.toDisplay(ventedVolume_m3.value));
  const ventedTuning_hz = computed(() => ventedTuningTyped_hz.value ?? ventedAlignmentResult.value?.Fb ?? 0);

  // The designed value stays exactly as WinISD designs it; these say when it is implausible.
  // Only meaningful for a vented box — a sealed design has no vented box to judge, and reading
  // the vented preview for one would judge a number the user is not being shown.
  const ventedVolumeWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    if (!ventedAlignmentResult.value) return null;
    const issue = eng.vented.volumeIssue(ventedVolume_m3.value);
    return issue === null ? null : issue.text;
  });

  const ventedTuningWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    if (!ventedAlignmentResult.value) return null;
    const issue = eng.vented.tuningIssue(ventedTuning_hz.value);
    return issue === null ? null : issue.text;
  });

  if (initialDriver) recomputeSealedVolume(initialDriver, targetQtc.value);

  const passiveRadiator = shallowRef<OpenISDPassiveRadiatorStandalone | null>(null);
  const passiveRadiatorBrowseOpen = ref(false);

  function loadSavedPassiveRadiator(uuid: string): void {
    passiveRadiatorBrowseOpen.value = false;
    const entry = prRepos.saved.list().find(e => e.uuid === uuid);
    if (entry) passiveRadiator.value = entry.passiveRadiator;
  }

  async function loadBundledPassiveRadiator(uuid: string): Promise<void> {
    passiveRadiatorBrowseOpen.value = false;
    passiveRadiator.value = await prRepos.bundled.load(uuid);
  }

  function defineNewPassiveRadiator(): void {
    passiveRadiatorBrowseOpen.value = false;
    passiveRadiator.value = OpenISDPassiveRadiatorStandalone.empty();
  }

  const passiveRadiatorView = computed<PassiveRadiatorStepView | null>(() => {
    const pr = passiveRadiator.value;
    if (pr === null) return null;
    const { spec } = pr;
    return {
      name: pr.model.value,
      Vas_m3: spec.Vas_m3.value, Qms: spec.Qms.value, Fs_hz: spec.Fs_hz.value,
      Sd_m2: spec.Sd_m2.value, Xmax_m: spec.Xmax_m.value,
    };
  });

  /** The chosen radiator, defining a blank one first when none is chosen yet. */
  function radiatorToEdit(): OpenISDPassiveRadiatorStandalone {
    if (passiveRadiator.value === null) passiveRadiator.value = OpenISDPassiveRadiatorStandalone.empty();
    return passiveRadiator.value;
  }
  /** Write one parameter of the radiator and redraw the step. */
  function writeSpec(pick: (pr: OpenISDPassiveRadiatorStandalone) => OpenISDPassiveRadiatorStandalone['spec']['Qms'], v: number | null): void {
    const field = pick(radiatorToEdit());
    if (v === null) field.clear(); else field.set(v);
    triggerRef(passiveRadiator);
  }
  const passiveRadiatorEdits: PassiveRadiatorStepEdits = {
    setName: v => { radiatorToEdit().model.set(v); triggerRef(passiveRadiator); },
    setVas_m3: v => writeSpec(pr => pr.spec.Vas_m3, v),
    setQms: v => writeSpec(pr => pr.spec.Qms, v),
    setFs_hz: v => writeSpec(pr => pr.spec.Fs_hz, v),
    setSd_m2: v => writeSpec(pr => pr.spec.Sd_m2, v),
    setXmax_m: v => writeSpec(pr => pr.spec.Xmax_m, v),
  };

  const canNext = computed(() => {
    if (step.value === WizardStep.DRIVER) return selectedDriver.value !== null;
    if (step.value === WizardStep.BOX_DETAILS && isPassiveRadiator.value) return passiveRadiatorView.value !== null;
    return plan.value.next(step.value) !== null;
  });

  const canBack = computed(() => plan.value.back(step.value) !== null);

  const canCreate = computed(() => step.value === WizardStep.PROJECT_INFO && projName.value.trim() !== '');

  function next(): void {
    if (!canNext.value) return;
    const to = plan.value.next(step.value);
    if (to !== null) step.value = to;
  }

  function back(): void {
    const to = plan.value.back(step.value);
    if (to !== null) step.value = to;
  }

  function createProject(): OpenISDProject | null {
    if (!selectedDriver.value) return null;
    // The user's choices, and only those; the builder fills the rest with the type's starting
    // values (`OpenISDBox.applyStartingValues`). The vented design is made against the project's
    // OWN Rg and Ql — the preview's constants are pinned to these by test, so the two never
    // disagree.
    const p = createProjectInStore(selectedDriver.value, (b) => {
      switch (boxType.value) {
        case 'sealed': return b.sealed().volume_m3(sealedVolume_m3.value);
        case 'vented': return ventedVolumeTyped_m3.value === null && ventedTuningTyped_hz.value === null
          ? b.vented().alignment(selectedVentedAlignment.value)
          : b.vented().volume_m3(ventedVolume_m3.value).tuning_goal_hz(ventedTuning_hz.value);
        case 'box-passive-radiator': {
          const pr = b.passiveRadiator().volume_m3(volume_m3.value);
          return passiveRadiator.value === null ? pr : pr.radiator(passiveRadiator.value);
        }
        case 'bandpass4': return b.bandpass4().rearVolume_m3(volume_m3.value).frontVolume_m3(frontVolume_m3.value).frontTuning_hz(frontTuning_hz.value);
        case 'bandpass6': return b.bandpass6().rearVolume_m3(volume_m3.value).frontVolume_m3(frontVolume_m3.value).rearTuning_hz(rearTuning_hz.value).frontTuning_hz(frontTuning_hz.value);
        case 'abc': return b.abc().rearVolume_m3(volume_m3.value).frontVolume_m3(frontVolume_m3.value).rearTuning_hz(rearTuning_hz.value).frontTuning_hz(frontTuning_hz.value);
      }
    }, (made) => {
      made.name.set(projName.value.trim() || 'Unnamed project');
      if (projDescription.value.trim()) {
        made.description.set(projDescription.value.trim());
      }
      made.nDrivers.set(nDrivers.value);
      made.wiring.set(wiring.value);
    });

    newProjectDriver.value = null;
    recentActions.record('new-project');
    return p;
  }

  function cancel(): void {
    newProjectDriver.value = null;
  }

  return {
    step,
    totalSteps,
    currentStepNumber,
    stepLabel,
    isDriverStep, isCountStep, isBoxTypeStep, isBoxDetailsStep, isProjectInfoStep,
    hadUnsaved,

    selectedDriver,
    selectedDriverName,
    selectedDriverSpecs,
    selectDriver,

    nDrivers,
    placement,
    wiring,
    N_DRIVERS_OPTIONS,
    ARRAY_WIRING_OPTIONS,

    boxType,
    BOX_OPTIONS,
    IMPLEMENTED_BOX_TYPES,
    volume_m3,
    frontVolume_m3,
    isDual,
    hasTunings,
    rearTuning_hz,
    frontTuning_hz,
    isSealed,
    isVented,

    ebp,
    ebpSuitability,
    ebpSuitabilityLabel,

    SEALED_ALIGNMENT_OPTIONS,
    selectedSealedAlignment,
    targetQtc,
    qtc,
    sealedFsc_hz,
    sealedVolume_m3,
    selectSealedAlignment,
    sealedPickerDeviationShown,
    setSealedVolume_m3,

    VENTED_ALIGNMENT_OPTIONS,
    selectedVentedAlignment,
    selectVentedAlignment,
    ventedVolume_m3,
    ventedVolume_L,
    ventedTuning_hz,
    setVentedVolume_m3,
    setVentedTuning_hz,
    ventedVolumeWarning,
    ventedTuningWarning,

    isPassiveRadiator,
    passiveRadiatorView,
    passiveRadiatorEdits,
    passiveRadiatorBrowseOpen,
    loadSavedPassiveRadiator,
    loadBundledPassiveRadiator,
    defineNewPassiveRadiator,

    projName,
    projDescription,

    selectedOption,

    canNext,
    canBack,
    canCreate,
    next,
    back,
    createProject,
    cancel,
  };
}
