/**
 * One box topology's own acoustic circuit — Zbox, and the driver/port/net volume velocities it
 * produces at one frequency, given the driver-side quantities `solve()` (`../circuit.ts`)
 * computes once (electrical source `pg`, damping `ZaE`, driver branch `ZaD`, box compliance
 * `Cab`/`Zc`, the loss Qs, the driver's own acoustic elements `Cas`/`Mas`, and the lossMode this
 * sweep selected). A box-specific field (Vb, Vf, Sp, Leff, Fb, pr*, Fr, Qp, tlPortModel, …) is
 * read straight off the `SweepParams` each class is constructed with, not through this record —
 * it is not shared, only that one topology reads it.
 *
 * The boundary where a `BoxType` (persisted data, `types.ts`) becomes behaviour: see
 * `boxModel()` in `./index.ts`, the one exhaustive factory that constructs one of these per
 * `SimulatableBoxType`.
 */
import type {Complex, Solution} from '../types.js';
import type {LossModeValue} from '../../fields/lossMode.js';

/** The driver-side circuit quantities every box topology is handed, for one frequency — computed
 *  once by `solve()` and shared across topologies. Not every field is read by every topology:
 *  each class destructures only what its own formulas use. */
export interface DriverSideQuantities {
  /** Angular frequency, rad/s (2π·f). */
  readonly w: number;
  /** Acoustic pressure source. */
  readonly pg: Complex;
  /** Electrical damping, referred to the acoustic domain. */
  readonly ZaE: Complex;
  /** Driver branch impedance (Ras, Mas, Cas in series). */
  readonly ZaD: Complex;
  /** Box acoustic compliance, Vb/(ρc²). */
  readonly Cab: number;
  /** 1/(jω·Cab). */
  readonly Zc: Complex;
  /** Box leakage loss, Ql/(ω·Cab), parallel to Zc. */
  readonly Ral: Complex;
  /** Box absorption loss, Qa/(ω·Cab), parallel to Zc. */
  readonly Raa: Complex;
  /** Box leakage Q, defaulted (P.Ql || 10). */
  readonly Ql: number;
  /** Box absorption Q, defaulted (P.Qa || 100). */
  readonly Qa: number;
  /** Driver acoustic compliance, Cms·Sd². */
  readonly Cas: number;
  /** Driver acoustic mass, Mms/Sd². */
  readonly Mas: number;
  /** Air density, kg/m³. */
  readonly rho: number;
  /** Speed of sound, m/s. */
  readonly c: number;
  /** The loss model this sweep selected (or forced to 'lossless' when Ql/Qa are both ≥1e6). */
  readonly lossMode: LossModeValue;
}

/** What one box topology's circuit produces at one frequency — the same four fields `solve()`
 *  itself returns, minus the electrical quantities (`Zel`) that are the same for every box
 *  type and stay computed in `solve()` once the topology's own result is in hand. */
export interface BoxOutput extends Pick<Solution, 'Zbox' | 'UD' | 'UP' | 'U0'> {
  /** The REAR port's own volume velocity, for a two-port topology (`Bandpass6Box`, `AbcBox`) —
   *  `UP` above is that topology's FRONT port, the same "one port" convention every other box
   *  type already returns. `circuit.ts`'s `solve()` forwards this into `Solution.UPr`, and
   *  `sweep.ts` turns it into `SweepResult.pvRear` for the `RearPort` chart. */
  readonly UPr?: Complex;
  /** ABC's intra-chamber port volume velocity, WinISD's own chart-21 form (Ricl left out of the
   *  load impedance it divides by — winisd_research/GHIDRA_FINDINGS.md "ABC (Aperiodic
   *  Bi-Chamber)" — a WinISD wart, reproduced by default). Present only for `AbcBox`'s
   *  `winisd-lossy` branch; forwarded the same way as `UPr`, into `Solution.UPi` /
   *  `SweepResult.pvIntra`. */
  readonly UPi?: Complex;
}

export interface BoxModel {
  /** Zbox and the driver/port/net volume velocities this topology produces at one frequency. */
  solve(q: DriverSideQuantities): BoxOutput;
}
