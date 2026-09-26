import type {DqIssue} from './consistency.js';

export interface SolverField<T = number> {
  /** `null` when the value cannot be derived from current inputs ('N'). */
  readonly value: T | null;

  /** True if the user explicitly entered this value ('E'). The solver must NEVER overwrite an entered value. */
  readonly entered: boolean;

  /** True if the value was derived by the physics engine ('C'). */
  readonly calculated: boolean;

  /** Half-width of the entered value's rounding interval; `null` unless entered. */
  readonly precision: number | null;

  /** The current DQ issues on this field. */
  readonly dq: readonly DqIssue[];

  /** Write a derived value, marking the field as 'calculated' ('C'), and optionally attach DQ. */
  setCalculated(value: T, dq?: readonly DqIssue[]): void;

  /** Attach a Data Quality (DQ) issue to an *entered* field. */
  setDq(dq?: readonly DqIssue[]): void;

  /** Mark a field as un-derivable ('N' / not-available). */
  setNotAvailable(): void;
}

/** A slot a solve only ever READS — `.value`/`.entered`, never `.setCalculated`/`.setDq`/
 *  `.setNotAvailable`. Every `*SolverParams` member below that a solve never writes back to is
 *  typed `SolverInput`, not the full `SolverField`: a slot that only ever reports a plain
 *  number/null (a `SimpleField`, a plain `Field`, a read via `inputOf`) can be handed to a
 *  solve without pretending it is a C/E-flagged handle it never had to be — narrower input,
 *  narrower type, the compiler proving which members a solve actually derives. */
export type SolverInput<T = number> = Pick<SolverField<T>, 'value' | 'entered'>;

/** A `SolverField` handle for every passive-radiator quantity. Pass to `solvePr` — it derives
 *  whichever of `tuning_goal_hz`/`addedMass_kg` is not entered plus `resonanceWithAddedMass_hz`/
 *  `systemTuning_hz`, writing back via `setCalculated` and never overwriting entered values.
 *  `Vb_m3`/`prMmd_kg`/`prSd_m2`/`prCms_m_per_N` are read-only inputs to the solve —
 *  nothing here ever writes back to the box volume or the radiator's own T/S spec. */
export interface PrSolverParams {
  addedMass_kg: SolverField;
  tuning_goal_hz: SolverField;
  Vb_m3: SolverInput;
  prMmd_kg: SolverInput;
  prSd_m2: SolverInput;
  prCms_m_per_N: SolverInput;
  resonanceWithAddedMass_hz: SolverField;
  systemTuning_hz: SolverField;
}

/** A `SolverField` handle for every vent quantity. Pass this to `solveVent` — the solve
 *  derives whichever of `tuning_goal_hz`/`length_m` is not entered and writes it back via
 *  `setCalculated`, never overwriting an entered value. `Vb_m3`/`area_m2`/`count`/`endCorrection_m` are
 *  read-only inputs — nothing here ever writes back to the box volume or the vent geometry. */
export interface VentSolverParams {
  tuning_goal_hz: SolverField;
  length_m: SolverField;
  Vb_m3: SolverInput;
  /** ONE port's area; `count` says how many identical ports share the chamber. */
  area_m2: SolverInput;
  count: SolverInput;
  endCorrection_m: SolverInput;
}

/** A `SolverField` handle for every sealed-alignment quantity. Pass this to
 *  `solveSealedAlignment` — the solve derives whichever of `Qtc`/`Vb_m3` is not entered from
 *  the driver's own `Qts`/`Vas_m3` and writes it back via `setCalculated`, never overwriting an
 *  entered value. `Qts`/`Vas_m3` are read-only inputs — nothing here ever writes back to the
 *  driver's own T/S spec.
 *
 *  `Fs_hz`/`Ql`/`Qa`/`lossMode` (S10) feed the Vb→Qtc route only, matching the Box tab's own
 *  lossy readout (`sealedResonance`) instead of the lossless textbook ratio. `Fs_hz` is the
 *  gate: when a caller leaves it not-entered, the route falls back to the lossless formula
 *  exactly as before S10, so every pre-S10 caller (the target-Qtc alignment picker included)
 *  keeps its unchanged behaviour. */
export interface SealedAlignmentSolverParams {
  Qts: SolverInput;
  Vas_m3: SolverInput;
  Fs_hz: SolverInput;
  Ql: SolverInput;
  Qa: SolverInput;
  lossMode: SolverInput<string>;
  Qtc: SolverField;
  Vb_m3: SolverField;
}

/** A slot that is never absent: entered, or calculated. The solve never retracts it. */
export interface PresentSolverField<T = number> {
  readonly value: T;
  readonly entered: boolean;
  setCalculated(value: T): void;
}

/** The drive signal's handles. Pass to `solveSignal`. With a usable `Re_ohm` it derives the
 *  one of `power_W`/`voltage_V` that is not entered from the other; without one, `power_W` is
 *  not available and `voltage_V` keeps what it holds. `Re_ohm` is the driver's, read only. */
export interface SignalSolverParams {
  power_W: SolverField;
  Re_ohm: SolverInput;
  voltage_V: PresentSolverField;
  Rs_ohm?: SolverInput;
}

/** A `SolverField` handle for every driver T/S quantity. Pass this directly to
 *  `solveDriverConsistencyGroup` — no positional args, no intermediate dict. */
export interface DriverSolverParams {
  Fs_hz: SolverField;
  Re_ohm: SolverField;
  Znom_ohm: SolverField;
  Le_H: SolverField;
  fLe_hz: SolverField;
  KLe_H_sqrtHz: SolverField;
  Qes: SolverField;
  Qms: SolverField;
  Qts: SolverField;
  Vas_m3: SolverField;
  Sd_m2: SolverField;
  Dd_m: SolverField;
  BL_Tm: SolverField;
  Mms_kg: SolverField;
  Cms_m_per_N: SolverField;
  Rms_kg_per_s: SolverField;
  EBP_hz: SolverField;
  Xmax_m: SolverField;
  Vd_m3: SolverField;
  Hc_m: SolverField;
  Hg_m: SolverField;
  Pe_W: SolverField;
  no: SolverField;
  SPLref_dB: SolverField;
  SPL_dB: SolverField;
  USPL_dB: SolverField;
  SPLmax_dB: SolverField;
  SPLmaxLF_dB: SolverField;
  Rme_kg_per_s: SolverField;
  Mpow_N_per_sqrtW: SolverField;
  Mcost_kg_per_s: SolverField;
  gamma_m_per_s2_A: SolverField;
  Gloss: SolverField;
  Vcd_m: SolverField;
  Depth_m: SolverField;
  MagDepth_m: SolverField;
  Magnet_m: SolverField;
  DVol_m3: SolverField;
  c_m_per_s: SolverField;
  roo_kg_per_m3: SolverField;
  Re_terminal_ohm: SolverField;
  BL_terminal_Tm: SolverField;
  /** Read only: the domain defaults a not-entered coil count itself; the solve never derives one. */
  numVC: SolverInput;
  /** Read only: the domain defaults a not-entered wiring itself; the solve never derives one. */
  wiring: SolverInput<'series' | 'parallel'>;
}
