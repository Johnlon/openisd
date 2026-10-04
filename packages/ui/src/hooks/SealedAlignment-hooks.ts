import {computed, type ComputedRef, ref, type Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import type {DriverEngine, EbpSuitability, SealedAlignmentOption, SealedEngine} from '@openisd/design/engine';

export interface SealedAlignmentEditorAPI {
  readonly open: Readonly<Ref<boolean>>;
  readonly options: ComputedRef<readonly SealedAlignmentOption[]>;
  readonly selectedOption: ComputedRef<SealedAlignmentOption | null>;
  /** The draft volume, SI. */
  readonly volume_m3: Ref<number | null>;
  readonly qtc: ComputedRef<number | null>;
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;
  openEditor(): void;
  selectQtc(qtc: number): void;
  accept(): void;
  cancel(): void;
}

/** The sealed-alignment dialog: a DRAFT volume the user shapes by Qtc or by volume, written to
 *  the project only on `accept()`. Holds the two engine areas it consults and nothing else. */
export class SealedAlignmentEditor implements SealedAlignmentEditorAPI {
  readonly open = ref(false);
  readonly options: ComputedRef<readonly SealedAlignmentOption[]>;
  readonly selectedOption: ComputedRef<SealedAlignmentOption | null>;
  /** The draft volume, SI. */
  readonly volume_m3 = ref<number | null>(null);
  readonly qtc: ComputedRef<number | null>;
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;

  readonly #driverValues: ComputedRef<{Qts: number | null; Vas_m3: number | null; Fs_hz: number | null; Qes: number | null}>;

  constructor(
    private readonly project: ComputedRef<OpenISDProject>,
    changed: Ref<number>,
    private readonly sealed: SealedEngine,
    driver: DriverEngine,
  ) {
    this.#driverValues = computed(() => {
      void changed.value;
      const ts = project.value.driver.specs;
      return {Qts: ts.Qts.value, Vas_m3: ts.Vas_m3.value, Fs_hz: ts.Fs_hz.value, Qes: ts.Qes.value};
    });
    this.options = computed(() => sealed.alignmentOptions());
    this.qtc = computed(() => {
      const {Qts, Vas_m3} = this.#driverValues.value;
      const volume = this.volume_m3.value;
      return volume == null || Qts == null || Vas_m3 == null
        ? null
        : sealed.qtcFromVolume(Qts, Vas_m3, volume);
    });
    this.selectedOption = computed(() => this.qtc.value == null ? null : sealed.closestAlignment(this.qtc.value));
    this.ebp = computed(() => {
      const {Fs_hz, Qes} = this.#driverValues.value;
      return Fs_hz == null || Qes == null ? null : driver.ebp(Fs_hz, Qes);
    });
    this.ebpSuitability = computed(() => this.ebp.value == null ? null : driver.ebpSuitability(this.ebp.value));
    this.ebpSuitabilityLabel = computed(() => {
      switch (this.ebpSuitability.value) {
        case 'sealed': return 'Sealed preferred';
        case 'vented': return 'Vented preferred';
        case 'either': return 'Either sealed or vented';
        case null: return 'Suitability unavailable';
      }
    });
  }

  openEditor(): void {
    this.volume_m3.value = this.project.value.box.sealed.volume_m3.value;
    this.open.value = true;
  }

  selectQtc(targetQtc: number): void {
    const {Qts, Vas_m3} = this.#driverValues.value;
    this.volume_m3.value = Qts == null || Vas_m3 == null
      ? null
      : this.sealed.volumeForQtc(Qts, Vas_m3, targetQtc);
  }

  accept(): void {
    const v = this.volume_m3.value;
    if (v != null && v > 0) this.project.value.box.sealed.volume_m3.set(v);
    this.open.value = false;
  }

  cancel(): void {
    this.open.value = false;
    this.volume_m3.value = null;
  }
}
