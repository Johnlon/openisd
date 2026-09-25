import type {Calculatable, Calculated, Clearable, Entered, Precise, Readable, SimpleField, Unsolvable, Writable} from './cell.js';

export type VentShape = 'round' | 'slotted';

export interface Vent {
  readonly shape: SimpleField<VentShape>;
  readonly diameter_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
  readonly width_m: Readable<number | null> & Entered & Writable<number> & Clearable;
  readonly height_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
  readonly length_m: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
  /** How many identical ports share the chamber (WinISD `[VentRear] Num`). Never N: C one port
   *  unless entered; the resolve stores the C value, and repairs a count that is not a whole
   *  number of at least one. */
  readonly count: Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>;
  readonly endCorrection_m: SimpleField<number>;
  /** ONE port's cross-sectional area — a solved pair with whichever dimension the vent's own
   *  `shape` uses (`diameter_m` round, `height_m` slotted), against the live `width_m` for the
   *  slotted case. Null when neither side of the pair is stated, not 0 and not NaN: 0 is a real
   *  (if absurd) port area, and absence is spelled the same way everywhere in this domain. */
  readonly area_m2: Readable<number | null> & Entered & Calculated & Precise & Writable<number> & Clearable & Calculatable<number> & Unsolvable;
  /** The whole opening — `count` ports of `area_m2` each. Null on the same terms. */
  totalArea_m2(): number | null;
  /** Acoustic length, or null when the length or the area it depends on is unset. */
  effectiveLength_m(): number | null;

  /** The tuning this port ACTUALLY produces in a chamber of `volume_m3` — the port as built,
   *  rather than the tuning the user asked for. Null when the port's dimensions or the volume
   *  are not set. */
  tuningIn_hz(volume_m3: number | null): number | null;

  /** The physical length this port needs to tune a chamber of `volume_m3` to `fb_hz` — the
   *  inverse of `tuningIn_hz()`. Null on the same terms. */
  lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null;

  // FIXME(QO126): neither direction has a caller, so `VentedBox.tuning_goal_hz` is a stored value that
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
