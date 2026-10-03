import {computed, type ComputedRef, ref, type Ref} from 'vue';
import type {OpenISDProject} from '@openisd/design';
import {NumberField} from '@openisd/design/fields';
import type {DriverEngine, EbpSuitability, VentedAlignment} from '@openisd/design/engine';
import {DEFAULT_VENTED_ALIGNMENT, type SelectorOption, VENTED_ALIGNMENT_OPTIONS} from '@openisd/design/fields';

export interface VentedAlignmentEditorAPI {
  readonly open: Readonly<Ref<boolean>>;
  readonly options: readonly SelectorOption<VentedAlignment>[];
  readonly selectedAlignment: Ref<VentedAlignment>;
  readonly volume_L: ComputedRef<number | null>;
  readonly tuning_hz: ComputedRef<number | null>;
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;
  openEditor(): void;
  selectAlignment(a: VentedAlignment): void;
  accept(): void;
  cancel(): void;
}

/**
 * The vented-alignment dialog: DRAFT volume+tuning the user shapes by picking a named alignment
 * (QB3/BB4/C4/EBS3/EBS6), written to the project only on `accept()`. Mirrors
 * `SealedAlignmentEditor`'s own shape and lifecycle (SealedAlignment-hooks.ts) — same reuse
 * pattern, one class, both shells can drive the same picker button. Unlike sealed, vented has no
 * volume→alignment reverse lookup (`VentedEngine` has no `closestAlignment`), so the picked
 * alignment is tracked directly as state rather than derived from the draft volume.
 *
 * `OpenISDDriver.ventedDesign(alignment, Rs_ohm, Ql)` (engine, 2026-09-29) does the
 * source-loaded-Qts + `VentedEngine.alignment()` work in one call, giving `{Vb, Fb}` — this
 * editor writes both `volume_m3` and `tuning_goal_hz` from it, exactly as agreed.
 */
export class VentedAlignmentEditor implements VentedAlignmentEditorAPI {
  readonly open = ref(false);
  readonly options = VENTED_ALIGNMENT_OPTIONS;
  readonly selectedAlignment = ref<VentedAlignment>(DEFAULT_VENTED_ALIGNMENT);
  readonly volume_L: ComputedRef<number | null>;
  readonly tuning_hz: ComputedRef<number | null>;
  readonly ebp: ComputedRef<number | null>;
  readonly ebpSuitability: ComputedRef<EbpSuitability | null>;
  readonly ebpSuitabilityLabel: ComputedRef<string>;

  readonly #draftVb_m3 = ref<number | null>(null);
  readonly #draftFb_hz = ref<number | null>(null);
  readonly #driverValues: ComputedRef<{Fs_hz: number | null; Qes: number | null}>;

  constructor(
    private readonly project: ComputedRef<OpenISDProject>,
    changed: Ref<number>,
    driver: DriverEngine,
  ) {
    this.#driverValues = computed(() => {
      void changed.value;
      const ts = project.value.driver.specs;
      return { Fs_hz: ts.Fs_hz.value, Qes: ts.Qes.value };
    });
    this.volume_L = computed(() => (this.#draftVb_m3.value == null ? null : NumberField.BOX_VB_L.toDisplay(this.#draftVb_m3.value)));
    this.tuning_hz = computed(() => this.#draftFb_hz.value);
    this.ebp = computed(() => {
      const { Fs_hz, Qes } = this.#driverValues.value;
      return Fs_hz == null || Qes == null ? null : driver.ebp(Fs_hz, Qes);
    });
    this.ebpSuitability = computed(() => (this.ebp.value == null ? null : driver.ebpSuitability(this.ebp.value)));
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
    const vented = this.project.value.box.vented;
    this.#draftVb_m3.value = vented.volume_m3.value || null;
    this.#draftFb_hz.value = vented.tuning_goal_hz.value;
    this.open.value = true;
    this.#recalculate();
  }

  selectAlignment(a: VentedAlignment): void {
    this.selectedAlignment.value = a;
    this.#recalculate();
  }

  #recalculate(): void {
    const p = this.project.value;
    const design = p.driver.ventedDesign(this.selectedAlignment.value, p.Rs_ohm.value, p.box.vented.losses.Ql.value);
    if (design) {
      this.#draftVb_m3.value = design.Vb;
      this.#draftFb_hz.value = design.Fb;
    }
  }

  accept(): void {
    const vented = this.project.value.box.vented;
    if (this.#draftVb_m3.value != null && this.#draftVb_m3.value > 0) vented.volume_m3.set(this.#draftVb_m3.value);
    if (this.#draftFb_hz.value != null && this.#draftFb_hz.value > 0) vented.tuning_goal_hz.set(this.#draftFb_hz.value);
    this.open.value = false;
  }

  cancel(): void {
    this.open.value = false;
    this.#draftVb_m3.value = null;
    this.#draftFb_hz.value = null;
  }
}
