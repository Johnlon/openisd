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
   *  inverse of `tuningIn_hz()`. Both directions exist because the user may enter either, and
   *  the other is then solved. Null on the same terms. */
  lengthForTuning_m(volume_m3: number | null, fb_hz: number): number | null;
}
