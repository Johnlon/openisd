export type FieldState = 'entered' | 'calculated' | 'not-available';

export interface SolverField<T = number> {
  readonly value: T | null;

  /** True if the user explicitly entered this value ('E'). The solver must NEVER overwrite an entered value. */
  readonly entered: boolean;

  /** True if the value was derived by the physics engine ('C'). */
  readonly calculated: boolean;

  /** True if the value cannot be derived from current inputs ('N'). */
  readonly notAvailable: boolean;

  /** The current DQ messages on this field. */
  readonly dq: readonly string[];

  /** Write a derived value, marking the field as 'calculated' ('C'), and optionally attach DQ. */
  setCalculated(value: T, dq?: string[]): void;

  /** Attach a Data Quality (DQ) issue to an *entered* field. */
  setDq(dq?: string[]): void;

  /** Mark a field as un-derivable ('N' / not-available). */
  setNotAvailable(): void;
}

/** A `SolverField` handle for every vent quantity. Pass this to `solveVent` — the solve
 *  derives whichever of `tuning_hz`/`length_m` is not entered and writes it back via
 *  `setCalculated`, never overwriting an entered value. */
export interface VentSolverParams {
  tuning_hz: SolverField;
  length_m: SolverField;
  Vb_m3: SolverField;
  area_m2: SolverField;
  endCorrection_m: SolverField;
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
  numVC: SolverField;
  wiring: SolverField<'series' | 'parallel'>;
}
