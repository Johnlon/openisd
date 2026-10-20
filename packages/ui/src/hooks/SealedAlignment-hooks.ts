import {computed, type ComputedRef, ref, type Ref} from 'vue';
import type {OpenISDProject, SealedBoxLosses} from '@openisd/design';
import {WinisdDeviation} from '@openisd/design/fields';
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
  /** The ≠W cue by the picker shows: WinISD's picker volume is not what the picker gives. */
  readonly deviationShown: ComputedRef<boolean>;
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
  readonly deviationShown: ComputedRef<boolean>;

  readonly #driverValues: ComputedRef<{Qts: number | null; Vas_m3: number | null; Fs_hz: number | null; Qes: number | null}>;

  constructor(
    private readonly project: ComputedRef<OpenISDProject>,
    changed: Ref<number>,
    sealed: SealedEngine,
    driver: DriverEngine,
  ) {
    this.#driverValues = computed(() => {
      void changed.value;
      const ts = project.value.driver.specs;
      return {Qts: ts.Qts.value, Vas_m3: ts.Vas_m3.value, Fs_hz: ts.Fs_hz.value, Qes: ts.Qes.value};
    });
    this.options = computed(() => sealed.alignmentOptions());
    this.deviationShown = computed(() => {
      void changed.value;
      return WinisdDeviation.SEALED_PICKER.cueShown(project.value.errorSwitches);
    });
    // The Qtc the draft volume gives on the Box tab: the same lossy figure, under the project's own source
    // resistance and box losses.
    this.qtc = computed(() => {
      void changed.value;
      const p = project.value;
      const volume = this.volume_m3.value;
      return volume == null ? null : p.driver.sealedQtc(volume, p.Rs_ohm.value, this.#losses());
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

  /** The project's box losses for the closed box. */
  #losses(): SealedBoxLosses {
    const losses = this.project.value.box.sealed.losses;
    return {Ql: losses.Ql.value, Qa: losses.Qa.value};
  }

  openEditor(): void {
    this.volume_m3.value = this.project.value.box.sealed.volume_m3.value;
    this.open.value = true;
  }

  selectQtc(targetQtc: number): void {
    const p = this.project.value;
    const winisdPicker = p.winisdSealedPicker.value;
    const volume = p.driver.sealedPickerVolume(targetQtc, p.Rs_ohm.value, this.#losses(), winisdPicker);
    this.volume_m3.value = volume;
  }

  /** The accepted volume is kept as the box's entered volume, picked or typed: Qtc is then calculated, and a
   *  driver edit leaves the volume alone, as in WinISD (John, 20 Oct 2026, QO274 "keep the vol"). */
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
