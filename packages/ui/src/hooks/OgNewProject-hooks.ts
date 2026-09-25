import { computed, type ComputedRef, ref, type Ref, shallowRef } from 'vue';
// Type-only: the store constructs projects (`newProject()`) and owns the engine instance; this
// hook only names their shapes, so neither import is a layering edge (QO80).
import type { OpenISDDriver, OpenISDProject } from '@openisd/design';
import type { BoxType, EbpSuitability, Engine, VentedAlignment, VentedDesign, Wiring } from '@openisd/design/engine';
import {
  ARRAY_WIRING_OPTIONS,
  DEFAULT_SOURCE_RESISTANCE_OHM,
  DEFAULT_VENTED_ALIGNMENT,
  SEALED_ALIGNMENT_OPTIONS,
  type SelectorOption,
  VENTED_ALIGNMENT_OPTIONS,
} from '@openisd/design/fields';
import {
  defaultPassiveRadiator,
  engine as appEngine,
  isModified,
  newProject,
  newProjectBoxTypeOptions,
  newProjectDriver,
} from '../logic/appState.js';
import { selectedOption } from '../logic/domEvents.js';
import { countOptions } from '../logic/fields/uiFields.js';
import { fromDisplay } from '../logic/fields/units.js';

export interface OgNewProjectDeps {
  engine?: Engine;
  initialDriver?: OpenISDDriver | null;
}

export interface OgNewProjectAPI {
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

  // Step 5: Metadata
  readonly projName: Ref<string>;
  readonly projDescription: Ref<string>;

  /** Every `<select>` in the wizard resolves its choice against its option list through this —
   *  the template never parses a select's string itself (see `uiFields-dropdowns.test.ts`). */
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

/** The vented `Ql` a new project is born with (`NO_VENTED_LOSSES` in the schema). The preview
 *  runs before the project exists, so it is read here; `OgNewProject-hooks.test.ts` pins it to
 *  the created project's own value. */
const NEW_PROJECT_VENTED_QL = 10;

const STEP_LABELS = Object.freeze([
  'Select driver for project',
  'Number of drivers and placement',
  'Type of design',
  'Sealed Alignment',
  'Project Information',
]);

export function useOgNewProject(deps?: OgNewProjectDeps): OgNewProjectAPI {
  const eng = deps?.engine ?? appEngine;
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

  const N_DRIVERS_OPTIONS = countOptions('driver_nDrivers');

  const hadUnsaved = computed(() => isModified.value);

  const isDual = computed(() => boxType.value === 'bandpass4');
  const isSealed = computed(() => boxType.value === 'sealed');
  const isVented = computed(() => boxType.value === 'vented');
  // Both sealed and vented get an alignment step (step 4); every other box type skips straight
  // from box-type (3) to project info (5) — no sourced alignment formula for them yet
  // (docs/plans/archive/FIX_WIZARD_VENTED.md §4).
  const hasAlignmentStep = computed(() => isSealed.value || isVented.value);
  const totalSteps = computed(() => (hasAlignmentStep.value ? 5 : 4));

  const currentStepNumber = computed(() => {
    if (step.value <= 3) return step.value;
    if (step.value === 4) return 4;
    return hasAlignmentStep.value ? 5 : 4;
  });

  const stepLabel = computed(() => {
    if (step.value === 4 && isVented.value) return 'Vented Alignment';
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
    if (Vas_m3 != null) lines.push(`Vas: ${(Vas_m3 * 1000).toFixed(1)} L`);
    return lines;
  });

  const ebp = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    const Fs_hz = driver.specs.Fs_hz.value;
    const Qes = driver.specs.Qes.value;
    return Fs_hz != null && Qes != null && Qes !== 0 ? eng.ebp(Fs_hz, Qes) : null;
  });

  const ebpSuitability = computed(() => {
    return ebp.value != null ? eng.ebpSuitability(ebp.value) : null;
  });

  const ebpSuitabilityLabel = computed(() => {
    switch (ebpSuitability.value) {
      case 'sealed':
        return 'Sealed preferred';
      case 'vented':
        return 'Vented preferred';
      case 'either':
        return 'Either sealed or vented';
      default:
        return 'Suitability unavailable';
    }
  });

  const qtc = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    const Qts = driver.specs.Qts.value;
    const Vas_m3 = driver.specs.Vas_m3.value;
    const v_m3 = sealedVolume_L.value / 1000;
    return Qts != null && Vas_m3 != null && v_m3 > 0
      ? eng.sealedQtcFromVolume(Qts, Vas_m3, v_m3)
      : null;
  });

  const selectedSealedAlignment = computed(() => {
    return qtc.value != null ? eng.closestSealedAlignment(qtc.value) : null;
  });

  /** Re-derive the sealed volume from the current driver and target Qtc; a driver without
   *  Qts/Vas leaves the previous volume standing. */
  function recomputeSealedVolume(driver: OpenISDDriver, target: number): void {
    const Qts = driver.specs.Qts.value;
    const Vas_m3 = driver.specs.Vas_m3.value;
    if (Qts == null || Vas_m3 == null) return;
    const calculated_m3 = eng.sealedFromQtc(Qts, Vas_m3, target);
    // Vb is a 2dp field everywhere else in the app (packages/ui/src/logic/fields/uiFields.ts) —
    // match that here instead of showing the solver's raw float.
    if (calculated_m3 != null) sealedVolume_L.value = Math.round(calculated_m3 * 1000 * 100) / 100;
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
   *  resistance folded into Qes — not the bare datasheet Qts (`boxDesign.ts#ventedAlignment`). */
  function ventedDesign(driver: OpenISDDriver, alignment: VentedAlignment, Rs_ohm: number, Ql: number): VentedDesign | null {
    const Fs_hz = driver.specs.Fs_hz.value;
    const Qts = driver.specs.Qts.value;
    const Vas_m3 = driver.specs.Vas_m3.value;
    if (Fs_hz == null || Qts == null || Vas_m3 == null) return null;
    const Qms = driver.specs.Qms.value;
    const Qes = driver.specs.Qes.value;
    const Re_ohm = driver.specs.Re_ohm.value;
    const QtsLoaded = Qms != null && Qes != null && Re_ohm != null
      ? eng.sourceLoadedQts(Qms, Qes, Re_ohm, Rs_ohm, Qts)
      : Qts;
    return eng.ventedAlignment(alignment, Fs_hz, QtsLoaded, Vas_m3, Ql);
  }

  const ventedAlignmentResult = computed(() => {
    const driver = selectedDriver.value;
    if (!driver) return null;
    return ventedDesign(driver, selectedVentedAlignment.value, DEFAULT_SOURCE_RESISTANCE_OHM, NEW_PROJECT_VENTED_QL);
  });

  const ventedVolume_L = computed(() => (ventedAlignmentResult.value?.Vb ?? 0) * 1000);
  const ventedTuning_hz = computed(() => ventedAlignmentResult.value?.Fb ?? 0);

  // The designed value stays exactly as WinISD designs it; these say when it is implausible.
  // Only meaningful for a vented box — a sealed design has no vented box to judge, and reading
  // the vented preview for one would judge a number the user is not being shown.
  const ventedVolumeWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    const design = ventedAlignmentResult.value;
    if (!design) return null;
    const issue = eng.ventedVolumeIssue(design.Vb);
    return issue === null ? null : eng.plausibilityToText(issue);
  });

  const ventedTuningWarning = computed<string | null>(() => {
    if (!isVented.value) return null;
    const design = ventedAlignmentResult.value;
    if (!design) return null;
    const issue = eng.ventedTuningIssue(design.Fb);
    return issue === null ? null : eng.plausibilityToText(issue);
  });

  if (initialDriver) recomputeSealedVolume(initialDriver, targetQtc.value);

  const canNext = computed(() => {
    if (step.value === 1) return selectedDriver.value !== null;
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
      step.value = hasAlignmentStep.value ? 4 : 5;
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
      step.value = hasAlignmentStep.value ? 4 : 3;
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
    const p = newProject();
    p.setDriver(selectedDriver.value);
    const name = projName.value.trim() || 'Unnamed project';
    p.name.set(name);
    if (projDescription.value.trim()) {
      p.description.set(projDescription.value.trim());
    }
    p.nDrivers.set(nDrivers.value);
    p.wiring.set(wiring.value);

    const box = boxType.value;
    p.box.boxType.set(box);
    const volume_m3 = fromDisplay(vol.value, 'volume', 'L');
    const frontVolume_m3 = fromDisplay(frontVol.value, 'volume', 'L');

    switch (box) {
      case 'sealed':
        p.box.sealed.volume_m3.set(fromDisplay(sealedVolume_L.value, 'volume', 'L'));
        break;
      case 'vented': {
        // Designed against the project's OWN Rg and Ql — the preview's constants are pinned to
        // these by test, so the two never disagree.
        const design = ventedDesign(
          selectedDriver.value, selectedVentedAlignment.value, p.Rs_ohm.value, p.box.vented.losses.Ql.value,
        );
        if (design) {
          p.box.vented.volume_m3.set(design.Vb);
          p.box.vented.tuning_goal_hz.set(design.Fb);
        }
        p.box.vented.vent.diameter_m.set(0.05);
        break;
      }
      case 'box-passive-radiator':
        p.box.passiveRadiator.volume_m3.set(volume_m3);
        defaultPassiveRadiator(p);
        p.box.passiveRadiator.tuning_goal_hz.set(35);
        break;
      case 'bandpass4':
        p.box.bandpass4.chambers.rear.volume_m3.set(volume_m3);
        p.box.bandpass4.chambers.front.volume_m3.set(frontVolume_m3);
        p.box.bandpass4.vents.front.diameter_m.set(0.05);
        p.box.bandpass4.chambers.front.tuning_goal_hz.set(35);
        break;
    }

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
