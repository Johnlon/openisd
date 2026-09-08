import type { FieldHandle, RawField } from './cell.js';

export type VentShape = 'round' | 'slotted';

export interface Vent {
  readonly shape: RawField<VentShape>;
  readonly diameter_m: FieldHandle<number>;
  readonly width_m: FieldHandle<number>;
  readonly height_m: FieldHandle<number>;
  readonly length_m: FieldHandle<number>;
  readonly endCorrection_m: RawField<number>;
  /** Cross-sectional area, or null when the dimensions this vent's own shape needs are not
   *  set. Null, not 0 and not NaN: 0 is a real (if absurd) port area, and absence is spelled
   *  the same way everywhere in this domain — a missing number is null. */
  area_m2(): number | null;
  /** Acoustic length, or null when the length or the area it depends on is unset. */
  effectiveLength_m(): number | null;

  /** The tuning this port ACTUALLY produces in a chamber of `volume_m3` — the port as built,
   *  rather than the tuning the user asked for. Null when the port's dimensions or the volume
   *  are not set. */
  tuningIn_hz(volume_m3: number | null): number | null;

  /** The physical length this port needs to tune a chamber of `volume_m3` to `fb_hz` — the
   *  inverse of `tuningIn_hz()`. Null on the same terms. */
  lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null;

  // FIXME(QO126): neither direction has a caller, so `VentedBox.tuning_hz` is a stored value that
  // changes no design — the user may enter either end and NOTHING is solved from it. The vented
  // box's tuning ↔ vent length is the same relation the passive-radiator box has as tuning ↔
  // added mass, and both must become solved pairs through one mechanism. Ruled and scoped in
  // bugs/BUG_20260908_tuning_and_its_paired_quantity_never_solve_each_other.md; deferred until
  // the packages/model → packages/design migration lands.
  //
  // Audit `lengthForTuning_m` against BUG_20260908_addedMassForTuning_returns_total_mass_not_
  // added_mass.md BEFORE wiring it: the passive-radiator inverse returned the TOTAL quantity
  // where the caller needed the delta, and this one has not been checked for the same defect.
}
