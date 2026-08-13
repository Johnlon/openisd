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

/* OBSOLETE: DriverRaw is retired by ARCHITECTURE.md AD-9 ("nothing inherits its shape
 * unmodified"). Do NOT add fields to it or build new consumers of it. Any change here must
 * be made with the specific intent of decommissioning it — migrating a call site off it, or
 * deleting a now-dead reference — never to extend or "fix" it in place. AD-8 still needs a
 * narrow successor type scoped to exactly what deriveDriver/sweep read; that is new work,
 * not a change to this interface. See PLAN_OPENISD_DRIVER_MODEL.md. */
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
  manufacturer?: string;
  providedBy?: string;
  comment?: string;
  added?: string;
  datasheetUrl?: string;
  manuPageUrl?: string;
  distributorPageUrl?: string;
  sourceUrl?: string;
  frdUrl?: string;
  impedanceUrl?: string;
  // Non-modeled properties for lossless round-trip / metadata
  Xlim?: number;
  hvc?: number;
  hag?: number;
  hc?: number;
  numVC?: number;
  VCCon?: number;
  tc?: number;
  Rth?: number;
  Cth?: number;
  loss?: number;
  thick?: number;
  depth?: number;
  magnetDepth?: number;
  fLe?: number;
  Le2?: number;
  Dd?: number;
  Hg?: number;
  Hc?: number;
  no?: number;
  SPLref?: number;
  USPL?: number;
  Vd?: number;
  SPLmaxLF?: number;
  Mpow?: number;
  SPLmax?: number;
  Mcost?: number;
  Rme?: number;
  gamma?: number;
  magnet?: number;
  basket?: number;
  outer?: number;
  VCd?: number;
  basketDisplacement?: number;
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
export type FilterType = 'highpass' | 'lowpass' | 'linkwitz' | 'peaking' | 'lowshelf' | 'highshelf';

export interface Filter {
  /** UI list key (crypto.randomUUID). Carried through state; ignored by the engine. */
  id?: string;
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
  tempK?: number;
  // Driver-side added mass to cone (kg) — raises Mms, lowers Fs. 0/absent = no-op. WINISD.md §12c.
  driverAddedMass?: number;
  // Thermal power compression: coil temp rise ΔT (K) × alfaVC (SI /K) → hot Re. 0/absent = no-op.
  vcTempRise?: number;
  alfaVC?: number;
  // ---- WinISD Advanced-pane simulation options (PLAN_ADVANCED_SIM_OPTIONS.md) ----------
  /**
   * Source resistance placement (WinISD Advanced: "Rg is at driver side").
   * true/absent — Rs sits in series with EACH driver, so it scales with the array
   *               (n in parallel → Rs/n). This is OpenISD's historic behaviour.
   * false       — one Rs in series with the whole array, at the amplifier.
   * Identical either way when nDrivers is 1.
   */
  rgAtDriverSide?: boolean;
  /**
   * Model the vent as a lossy acoustic transmission line instead of a lumped mass
   * (WinISD Advanced: `Use "transmission line"-model for port simulation`, .wpr TLPorts).
   * Adds the duct's own half-wave pipe resonances at c/(2·Leff); reduces to the lumped
   * model exactly as ω→0. Applies to `vented` and `bandpass4`; absent/false = lumped.
   */
  tlPortModel?: boolean;
  /**
   * Auto-EQ the system flat (WinISD Advanced: "Force flat response", .wpr FlatResponse).
   * Applies the frequency-dependent line-level gain that lifts every point to the passband
   * reference, so the excursion/velocity/max-SPL curves show what flattening costs.
   */
  forceFlatResponse?: boolean;
  /** Ceiling on the force-flat boost, dB. Absent → FLAT_MAX_BOOST_DB. */
  flatMaxBoostDb?: number;
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
  /** Transfer function magnitude in dB relative to the high-frequency passband asymptote (0 dB). */
  tfMag: number[];
  /**
   * SPL with the drive backed off wherever peak excursion would exceed Xmax
   * (WinISD Advanced: "SPL graph is Xmax limited"). Always computed, never substituted
   * for `spl`: the plain curve still feeds the transfer-function chart, the F3/F6/F10
   * read-outs and every compare trace. Equals `spl` where the driver stays within Xmax,
   * and where the driver publishes no Xmax at all.
   */
  splXlim: number[];
  /** `true` at each frequency where `splXlim` had to back the drive off. */
  xlimited: boolean[];
  /**
   * Lowest frequency (Hz) at which force-flat's boost hit `flatMaxBoostDb`, or null if
   * the clamp never bound (including when force-flat is off). Surfaced as a warn by
   * `classifyFlatClamp` — a clamped "flat" response is not flat, and must not look it.
   */
  flatClamped: number | null;
  /**
   * The EQ/filter chain's OWN electrical response — WinISD's three "(EQ/Filter)" charts.
   * Depends only on `SweepParams.filters` and the frequency grid: not on the driver, not
   * on the box. Unity (0 dB, 0 rad, 0 ms) when no filter is enabled.
   *
   * 0 dB is defined by WinISD Pro's help, "Filter/equalizer behavioral simulator":
   * "Filter system is logically located at electrical side. 0 dB gain at filter chain
   * means that voltage at driver terminal is equal that is specified at 'signal'-tab."
   *
   * Force-flat's boost is deliberately NOT included: it is applied downstream as a real
   * gain on the output curves, never through the filter chain, so this stays the response
   * of the filters the user actually declared.
   */
  fltMag: number[];
  /** Filter-chain phase in RADIANS, unwrapped — same convention as `phase`. */
  fltPhase: number[];
  /** Filter-chain group delay in ms, derived from `fltPhase` by the same τg as `gd`. */
  fltGd: number[];
}

/** Max-SPL / max-power output. `xlim[i]` = Xmax is the limiting factor at point i. */
export interface MaxCurvesResult {
  fs: number[];
  maxspl: number[];
  maxpwr: number[];
  xlim: boolean[];
  peAbsent: boolean;
}
