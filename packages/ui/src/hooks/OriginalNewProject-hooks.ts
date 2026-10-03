import { computed, type ComputedRef, ref, type Ref, shallowRef, triggerRef } from 'vue';
// Type-only: the store constructs projects (`newProject()`) and owns the engine instance; this
// hook only names their shapes, so neither import is a layering edge (QO80).
import { type OpenISDDriver, type OpenISDProject, OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import type { BundledPassiveRadiatorRepo, MyPassiveRadiatorRepo } from '@openisd/persistence';
import type { BoxType, EbpSuitability, SealedEngine, VentedAlignment, VentedEngine, Wiring } from '@openisd/design/engine';
import {ARRAY_WIRING_OPTIONS, DEFAULT_NEW_PROJECT_VENTED_QL, DEFAULT_SOURCE_RESISTANCE_OHM, DEFAULT_VENTED_ALIGNMENT, NumberField, SEALED_ALIGNMENT_OPTIONS, VENTED_ALIGNMENT_OPTIONS, type SelectorOption} from '@openisd/design/fields';
import {
  createProject as createProjectInStore,
  isModified,
  newProjectBoxTypeOptions,
  newProjectDriver,
} from '../logic/appState.js';
import {useApp} from '../logic/app.js';
import { selectedOption } from '../logic/domEvents.js';

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

/** The step's writes, one per parameter; null clears the entry. */
export interface PassiveRadiatorStepEdits {
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
}

export interface OriginalNewProjectAPI {
  // Navigation & Step state
  readonly step: Ref<number>;
  readonly totalSteps: ComputedRef<number>;
  readonly currentStepNumber: ComputedRef<number>;
  readonly stepLabel: ComputedRef<string>;
  readonly STEP_LABELS: readonly string[];
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
  readonly vol: Ref<number>;
  readonly frontVol: Ref<number>;
  readonly isDual: ComputedRef<boolean>;
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
  /** The sealed box volume: derived from the chosen alignment, editable on step 4. */
  readonly sealedVolume_L: Ref<number>;
  selectSealedAlignment(qtc: number): void;
  setSealedVolume_L(litres: number): void;

  // Step 4: Vented Alignment — WinISD's five, designed as its wizard does
  // (docs/research/VENTED_ALIGNMENT_FORMULAS.md)
  readonly VENTED_ALIGNMENT_OPTIONS: readonly SelectorOption<VentedAlignment>[];
  readonly selectedVentedAlignment: Ref<VentedAlignment>;
  selectVentedAlignment(alignment: VentedAlignment): void;
  /** The alignment's vented box volume, litres — read-only, from the driver and alignment. */
  readonly ventedVolume_L: ComputedRef<number>;
  /** The alignment's tuning frequency, Hz — read-only, from the driver and alignment. */
  readonly ventedTuning_hz: ComputedRef<number>;
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
   *  the template never parses a select's string itself (see `field-dropdowns.test.ts`). */
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

const STEP_LABELS = Object.freeze([
  'Select driver for project',
  'Number of drivers and placement',
  'Type of design',
  'Sealed Alignment',
  'Project Information',
]);

export function useOgNewProject(deps?: OriginalNewProjectDeps): OriginalNewProjectAPI {
  const eng: OriginalNewProjectEngineAreas = deps?.areas ?? useApp().engine;
  const prRepos: NewProjectPassiveRadiatorRepos = deps?.passiveRadiators
    ?? { saved: useApp().myPassiveRadiators, bundled: useApp().bundledPassiveRadiators };
  const initialDriver = deps?.initialDriver ?? newProjectDriver.value ?? null;

  const step = ref(1);
  const selectedDriver = shallowRef<OpenISDDriver | null>(initialDriver);

  const nDrivers = ref(1);
  const placement = ref<'standard' | 'iso'>('standard');
  const wiring = ref<Wiring>('parallel');

  const boxType = ref<BoxType>('sealed');
  const BOX_OPTIONS = newProjectBoxTypeOptions();
  // Starting volume for the non-sealed box types (WinISD's default); a sealed box takes its
  // volume from the alignment on step 4 instead, so the two never overwrite each other.
  const vol = ref(7);
  const frontVol = ref(10);
  const targetQtc = ref(0.707);
  const sealedVolume_L = ref(7);
  const selectedVentedAlignment = ref<VentedAlignment>(DEFAULT_VENTED_ALIGNMENT);

  const projName = ref('');
  const projDescription = ref('');

  const N_DRIVERS_OPTIONS = NumberField.DRIVER_NDRIVERS.countOptions();

  const hadUnsaved = computed(() => isModified.value);

  const isDual = computed(() => boxType.value === 'bandpass4');
  const isSealed = computed(() => boxType.value === 'sealed');
  const isVented = computed(() => boxType.value === 'vented');
  const isPassiveRadiator = computed(() => boxType.value === 'box-passive-radiator');
  // Step 4 is the sealed or vented alignment, or the passive radiator; every other box type skips
  // straight from box-type (3) to project info (5) — no sourced alignment formula for them yet
  // (docs/plans/archive/FIX_WIZARD_VENTED.md §4).
  const hasStep4 = computed(() => isSealed.value || isVented.value || isPassiveRadiator.value);
  const totalSteps = computed(() => (hasStep4.value ? 5 : 4));

  const currentStepNumber = computed(() => {
    if (step.value <= 3) return step.value;
    if (step.value === 4) return 4;
    return hasStep4.value ? 5 : 4;
  });

  const stepLabel = computed(() => {
    if (step.value === 4 && isVented.value) return 'Vented Alignment';
    if (step.value === 4 && isPassiveRadiator.value) return 'Passive Radiator';
    return STEP_LABELS[step.value - 1];
  });

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
    if (Fs_hz != null) lines.push(`Fs: ${Fs_hz} Hz`);
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
    return driver.sealedQtc(NumberField.BOX_VB_L.toSI(sealedVolume_L.value));
  });

  const selectedSealedAlignment = computed(() => {
    return qtc.value != null ? eng.sealed.closestAlignment(qtc.value) : null;
  });

  /** Re-derive the sealed volume from the current driver and target Qtc; a driver without
   *  Qts/Vas leaves the previous volume standing. */
  function recomputeSealedVolume(driver: OpenISDDriver, target: number): void {
    const calculated_m3 = driver.sealedVolumeForQtc(target);
    // Vb is a 2dp field everywhere else in the app — match that here instead of showing the solver's raw float.
    if (calculated_m3 != null) sealedVolume_L.value = Number(NumberField.BOX_VB_L.format(calculated_m3));
  }

  function selectDriver(driver: OpenISDDriver): void {
    selectedDriver.value = driver;
    recomputeSealedVolume(driver, targetQtc.value);
    // "Use" in the step-1 driver picker is the step's whole job — done, move on.
    if (step.value === 1) next();
  }

  function selectSealedAlignment(target: number): void {
    targetQtc.value = target;
    if (selectedDriver.value) recomputeSealedVolume(selectedDriver.value, target);
  }

  function setSealedVolume_L(litres: number): void {
    sealedVolume_L.value = litres;
  }

  function selectVentedAlignment(alignment: VentedAlignment): void {
    selectedVentedAlignment.value = alignment;
  }

  /** WinISD designs the vented box for the driver AS DRIVEN — Qts with the project's series
   *  resistance folded into Qes — not the bare datasheet Qts (`OpenISDDriver.ventedDesign`). */
  const ventedAlignmentResult = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return driver.ventedDesign(selectedVentedAlignment.value, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_VENTED_QL);
  });

  const ventedVolume_L = computed(() => (ventedAlignmentResult.value?.Vb != null ? NumberField.BOX_VB_L.toDisplay(ventedAlignmentResult.value.Vb) : 0));
  const ventedTuning_hz = computed(() => ventedAlignmentResult.value?.Fb ?? 0);

  // The designed value stays exactly as WinISD designs it; these say when it is implausible.
  // Only meaningful for a vented box — a sealed design has no vented box to judge, and reading
  // the vented preview for one would judge a number the user is not being shown.
  const ventedVolumeWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    const design = ventedAlignmentResult.value;
    if (!design) return null;
    const issue = eng.vented.volumeIssue(design.Vb);
    return issue === null ? null : issue.text;
  });

  const ventedTuningWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    const design = ventedAlignmentResult.value;
    if (!design) return null;
    const issue = eng.vented.tuningIssue(design.Fb);
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
      name: pr.model.value || 'Custom PR',
      Vas_m3: spec.Vas_m3.value, Qms: spec.Qms.value, Fs_hz: spec.Fs_hz.value,
      Sd_m2: spec.Sd_m2.value, Xmax_m: spec.Xmax_m.value,
    };
  });

  /** Write one parameter of the chosen radiator and redraw the step; nothing when none is chosen. */
  function writeSpec(field: OpenISDPassiveRadiatorStandalone['spec']['Qms'], v: number | null): void {
    if (v === null) field.clear(); else field.set(v);
    triggerRef(passiveRadiator);
  }
  const passiveRadiatorEdits: PassiveRadiatorStepEdits = {
    setVas_m3: v => { if (passiveRadiator.value) writeSpec(passiveRadiator.value.spec.Vas_m3, v); },
    setQms: v => { if (passiveRadiator.value) writeSpec(passiveRadiator.value.spec.Qms, v); },
    setFs_hz: v => { if (passiveRadiator.value) writeSpec(passiveRadiator.value.spec.Fs_hz, v); },
    setSd_m2: v => { if (passiveRadiator.value) writeSpec(passiveRadiator.value.spec.Sd_m2, v); },
    setXmax_m: v => { if (passiveRadiator.value) writeSpec(passiveRadiator.value.spec.Xmax_m, v); },
  };

  const canNext = computed(() => {
    if (step.value === 1) return selectedDriver.value !== null;
    if (step.value === 4 && isPassiveRadiator.value) return passiveRadiatorView.value !== null;
    if (step.value >= 2 && step.value <= 4) return true;
    return false;
  });

  const canBack = computed(() => step.value > 1);

  const canCreate = computed(() => step.value === 5 && projName.value.trim() !== '');

  function next(): void {
    if (!canNext.value) return;
    if (step.value === 1) {
      step.value = 2;
      return;
    }
    if (step.value === 2) {
      step.value = 3;
      return;
    }
    if (step.value === 3) {
      step.value = hasStep4.value ? 4 : 5;
      return;
    }
    if (step.value === 4) {
      step.value = 5;
      return;
    }
  }

  function back(): void {
    if (!canBack.value) return;
    if (step.value === 5) {
      step.value = hasStep4.value ? 4 : 3;
      return;
    }
    if (step.value === 4) {
      step.value = 3;
      return;
    }
    if (step.value === 3) {
      step.value = 2;
      return;
    }
    if (step.value === 2) {
      step.value = 1;
      return;
    }
  }

  function createProject(): OpenISDProject | null {
    if (!selectedDriver.value) return null;
    const volume_m3 = NumberField.BOX_VB_L.toSI(vol.value);
    const frontVolume_m3 = NumberField.BOX_VB_L.toSI(frontVol.value);
    // The user's choices, and only those; the builder fills the rest with the type's starting
    // values (`OpenISDBox.applyStartingValues`). The vented design is made against the project's
    // OWN Rg and Ql — the preview's constants are pinned to these by test, so the two never
    // disagree.
    const p = createProjectInStore(selectedDriver.value, (b) => {
      switch (boxType.value) {
        case 'sealed': return b.sealed().volume_m3(NumberField.BOX_VB_L.toSI(sealedVolume_L.value));
        case 'vented': return b.vented().alignment(selectedVentedAlignment.value);
        case 'box-passive-radiator': {
          const pr = b.passiveRadiator().volume_m3(volume_m3);
          return passiveRadiator.value === null ? pr : pr.radiator(passiveRadiator.value);
        }
        case 'bandpass4': return b.bandpass4().rearVolume_m3(volume_m3).frontVolume_m3(frontVolume_m3);
        case 'bandpass6': return b.bandpass6();
        case 'abc': return b.abc();
      }
    });
    p.name.set(projName.value.trim() || 'Unnamed project');
    if (projDescription.value.trim()) {
      p.description.set(projDescription.value.trim());
    }
    p.nDrivers.set(nDrivers.value);
    p.wiring.set(wiring.value);

    newProjectDriver.value = null;
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
    STEP_LABELS,
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
    vol,
    frontVol,
    isDual,
    isSealed,
    isVented,

    ebp,
    ebpSuitability,
    ebpSuitabilityLabel,

    SEALED_ALIGNMENT_OPTIONS,
    selectedSealedAlignment,
    targetQtc,
    qtc,
    sealedVolume_L,
    selectSealedAlignment,
    setSealedVolume_L,

    VENTED_ALIGNMENT_OPTIONS,
    selectedVentedAlignment,
    selectVentedAlignment,
    ventedVolume_L,
    ventedTuning_hz,
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
