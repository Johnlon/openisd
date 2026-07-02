/**
 * Shared engine types.
 *
 * Modeled directly from the runtime shapes the engine already produces —
 * these types describe existing behaviour, they do not change it.
 */

/** A complex number in rectangular form. */
export interface Complex {
  re: number;
  im: number;
}

/** Severity of a driver/parse issue. `error` blocks derivation; `warn` only drops a reference line. */
export type IssueLevel = 'error' | 'warn';

/** One human-readable problem tied to a specific field. */
export interface DriverError {
  level: IssueLevel;
  field: string;
  message: string;
}

/**
 * Go-style result. Calculation/parse entry points return this instead of
 * throwing: `value` is null when a blocking error occurred.
 */
export interface Result<T> {
  value: T | null;
  errors: DriverError[];
}

/**
 * Raw driver parameters as entered/imported — every field optional because a
 * partial driver is a valid intermediate state (parseWdr drops absent fields).
 */
export interface DriverRaw {
  // Thiele/Small
  Fs?: number;
  Qts?: number;
  Qes?: number;
  Qms?: number;
  Vas?: number;
  Sd?: number;
  Re?: number;
  Le?: number;
  Xmax?: number;
  Pe?: number;
  /** Nominal impedance (WinISD Znom) — label only, not used in simulation. */
  Z?: number;
  // Metadata
  name?: string;
  brand?: string;
  model?: string;
  providedBy?: string;
  comment?: string;
  datasheetUrl?: string;
  vendorpageUrl?: string;
  sourceUrl?: string;
  frdUrl?: string;
  impedanceUrl?: string;
}

/**
 * A fully-derived driver — the non-null `value` returned by deriveDriver.
 * The required fields are those deriveDriver validates (Fs/Re/Sd/Vas) or
 * derives (the Q trio + Cms/Mms/Rms/Bl). `Le` stays optional: it is passed
 * through from DriverRaw and only affects the impedance plot.
 */
export interface Driver extends DriverRaw {
  Fs: number;
  Re: number;
  Sd: number;
  Vas: number;
  Qts: number;
  Qes: number;
  Qms: number;
  Cms: number;
  Mms: number;
  Rms: number;
  Bl: number;
}

/** Enclosure types the circuit solver handles. */
export type BoxType = 'sealed' | 'vented' | 'pr' | 'bandpass4';

/** Driver wiring for multi-driver setups. */
export type Wiring = 'series' | 'parallel';

/** Circuit model variant — WinISD-compatible (Le excluded from acoustic path) or full gyrator. */
export type CircuitModel = 'winisd' | 'gyrator';

/** Signal-chain filter descriptor. Which optional fields apply depends on `type`. */
export type FilterType = 'highpass' | 'lowpass' | 'linkwitz' | 'peaking';

export interface Filter {
  type: FilterType;
  enabled: boolean;
  fc?: number;
  Q?: number;
  f0?: number;
  Q0?: number;
  fp?: number;
  Qp?: number;
  gain?: number;
}

/**
 * Sweep/solve parameters. `Vb` and `eg` are required (every call site — the
 * store and every test — supplies them). Box-specific fields (Vf, Sp, Leff,
 * pr*) are optional because a given box type only reads its own; the solver
 * accesses them within the matching branch where they are guaranteed present.
 */
export interface SweepParams {
  Vb: number;
  eg: number;
  // Frequency grid
  fmin?: number;
  fmax?: number;
  N?: number;
  // Multi-driver
  nDrivers?: number;
  wiring?: Wiring;
  Rs?: number;
  circuitModel?: CircuitModel;
  // Box losses
  Ql?: number;
  Qa?: number;
  Qp?: number;
  // Vented / bandpass
  Vf?: number;
  Sp?: number;
  Leff?: number;
  // Passive radiator
  prSd?: number;
  prNum?: number;
  prMmd?: number;
  prMadd?: number;
  prCms?: number;
  prRms?: number;
  prXmax?: number;
  // Signal chain
  filters?: Filter[];
}

/** Circuit solution at a single frequency. */
export interface Solution {
  U0: Complex;
  UD: Complex;
  UP: Complex;
  Zbox: Complex;
  Zel: Complex;
  ZaD: Complex;
}

/** Full frequency-sweep output arrays (one entry per frequency point). */
export interface SweepResult {
  fs: number[];
  H: Complex[];
  spl: number[];
  phase: number[];
  exc: number[];
  excPR: number[];
  pv: number[];
  zmag: number[];
  zph: number[];
  gd: number[];
}

/** Max-SPL / max-power output. `xlim[i]` = Xmax is the limiting factor at point i. */
export interface MaxCurvesResult {
  fs: number[];
  maxspl: number[];
  maxpwr: number[];
  xlim: boolean[];
  peAbsent: boolean;
}
