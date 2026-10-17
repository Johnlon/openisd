import {computed, type ComputedRef, ref, type Ref} from 'vue';
import type {OpenISDProject, SealedBoxLosses} from '@openisd/design';
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

  /** The target the draft volume was worked out from, while the draft is still that volume. */
  #picked: {qtc: number; volume_m3: number} | null = null;

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
    this.#picked = null;
    this.volume_m3.value = this.project.value.box.sealed.volume_m3.value;
    this.open.value = true;
  }

  selectQtc(targetQtc: number): void {
    const p = this.project.value;
    const volume = p.driver.sealedVolumeForQtc(targetQtc, p.Rs_ohm.value, this.#losses());
    this.volume_m3.value = volume;
    this.#picked = volume === null ? null : {qtc: targetQtc, volume_m3: volume};
  }

  /** A picked target is kept as the box's entered Qtc, with the volume calculated from it; a volume typed
   *  after the pick is kept as the entered volume instead (John, 16 Oct 2026). */
  accept(): void {
    const v = this.volume_m3.value;
    const sealed = this.project.value.box.sealed;
    if (v != null && v > 0) {
      if (this.#picked !== null && this.#picked.volume_m3 === v) sealed.q_tc.set(this.#picked.qtc);
      else sealed.volume_m3.set(v);
    }
    this.#picked = null;
    this.open.value = false;
  }

  cancel(): void {
    this.#picked = null;
    this.open.value = false;
    this.volume_m3.value = null;
  }
}
