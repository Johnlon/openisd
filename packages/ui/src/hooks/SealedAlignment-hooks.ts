import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { OpenISDProject } from '@openisd/design';
import type { EbpSuitability, Engine, SealedAlignmentOption } from '@openisd/design/engine';

export interface SealedAlignmentEditorDeps {
  readonly project: ComputedRef<OpenISDProject>;
  readonly changed: Ref<number>;
  readonly engine: Engine;
}

export interface SealedAlignmentEditorAPI {
  readonly open: Readonly<Ref<boolean>>;
  readonly options: ComputedRef<readonly SealedAlignmentOption[]>;
  readonly selectedOption: ComputedRef<SealedAlignmentOption | null>;
  readonly volume_L: Ref<number | null>;
  readonly qtc: ComputedRef<number | null>;
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;
  openEditor(): void;
  selectQtc(qtc: number): void;
  accept(): void;
  cancel(): void;
}

export function createSealedAlignmentEditor({project, changed, engine}: SealedAlignmentEditorDeps): SealedAlignmentEditorAPI {
  const open = ref(false);
  const draftVolume_m3 = ref<number | null>(null);

  const driverValues = computed(() => {
    void changed.value;
    const ts = project.value.driver.ts;
    return {Qts: ts.Qts.value, Vas_m3: ts.Vas_m3.value, Fs_hz: ts.Fs_hz.value, Qes: ts.Qes.value};
  });

  const options = computed(() => engine.sealedAlignmentOptions());
  const qtc = computed(() => {
    const {Qts, Vas_m3} = driverValues.value;
    const volume = draftVolume_m3.value;
    return volume == null || Qts == null || Vas_m3 == null
      ? null
      : engine.sealedQtcFromVolume(Qts, Vas_m3, volume);
  });
  const selectedOption = computed(() => qtc.value == null ? null : engine.closestSealedAlignment(qtc.value));
  const volume_L = computed<number | null>({
    get: () => draftVolume_m3.value == null ? null : draftVolume_m3.value * 1000,
    set: value => { draftVolume_m3.value = value == null ? null : value / 1000; },
  });
  const ebp = computed(() => {
    const {Fs_hz, Qes} = driverValues.value;
    return Fs_hz == null || Qes == null ? null : engine.ebp(Fs_hz, Qes);
  });
  const suitability = computed(() => ebp.value == null ? null : engine.ebpSuitability(ebp.value));
  const suitabilityLabel = computed(() => {
    switch (suitability.value) {
      case 'sealed': return 'Sealed preferred';
      case 'vented': return 'Vented preferred';
      case 'either': return 'Either sealed or vented';
      default: return 'Suitability unavailable';
    }
  });

  function openEditor(): void {
    draftVolume_m3.value = project.value.box.sealed.volume_m3.get();
    open.value = true;
  }

  function selectQtc(targetQtc: number): void {
    const {Qts, Vas_m3} = driverValues.value;
    draftVolume_m3.value = Qts == null || Vas_m3 == null
      ? null
      : engine.sealedFromQtc(Qts, Vas_m3, targetQtc);
  }

  function accept(): void {
    if (draftVolume_m3.value != null && draftVolume_m3.value > 0) {
      project.value.box.sealed.volume_m3.set(draftVolume_m3.value);
    }
    open.value = false;
  }

  function cancel(): void {
    open.value = false;
    draftVolume_m3.value = null;
  }

  return {open, options, selectedOption, volume_L, qtc, ebp, ebpSuitability: suitability, ebpSuitabilityLabel: suitabilityLabel, openEditor, selectQtc, accept, cancel};
}
