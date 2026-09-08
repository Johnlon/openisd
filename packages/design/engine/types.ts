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
 * THE box types. One declaration, imported by the engine, the domain, the model and the UI —
 * there is no second enumeration of this concept anywhere (John's canon, 2026-08-28).
 *
 * `box-passive-radiator` carries the `box-` prefix because `passive-radiator` already names a
 * DRIVER type — a driver that IS a passive radiator (ruling D7). One enclosure loaded by such a
 * driver, one driver that is one: two concepts, and they must not share a spelling. The other
 * five need no prefix: nothing else answers to those names.
 *
 * `bandpass6` and `abc` are declared here and are NOT simulated — `simulatableBoxType()` is the
 * one place that decides, and every engine entry point refuses them by name rather than by
 * being unable to express them.
 */
export type BoxType =
  | 'sealed'
  | 'vented'
  | 'bandpass4'
  | 'bandpass6'
  | 'box-passive-radiator'
  | 'abc';

/** The box types the circuit solver actually models. */
export type SimulatableBoxType = 'sealed' | 'vented' | 'bandpass4' | 'box-passive-radiator';

/**
 * Narrow a box type to one the circuit models, or null when it has none. The ONE place that
 * distinction is made, so a caller gets either a simulatable type or an explicit refusal — never
 * a silent fall-through into another topology's maths.
 *
 * INTERNAL to this package: `Engine.simulatableBoxType()` is the public way to ask, and the
 * engine door exports no loose functions (`test/architecture-engine-boundary.test.ts`).
 *
 * A SWITCH, not a list. The case labels NARROW `box` to exactly those four literals, which is
 * `SimulatableBoxType`, so `return box` needs no assertion — where `array.includes(box)` cannot
 * narrow at all and took one cast to ask the question and a second to answer it. It also leaves
 * no array to be mutable state, which is what `packages/design/AGENTS.md` and
 * `test/architecture-no-globals.test.ts` are about.
 */
export function simulatableBoxType(box: BoxType): SimulatableBoxType | null {
  switch (box) {
    case 'sealed':
    case 'vented':
    case 'bandpass4':
    case 'box-passive-radiator':
      return box;
    default:
      return null;
  }
}

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
/** The enclosure fields this check reads — every parameter some box type divides by, all
 *  optional because "absent" is one of the states it exists to report.
 *
 *  A subset of `SweepParams` rather than `SweepParams` itself: validating an enclosure needs no
 *  drive level and no frequency grid, and demanding them would mean a project that cannot yet be
 *  swept could not be checked either — which is precisely the project whose box parameters are
 *  most likely to be wrong. */
export type EnclosureParams = Partial<Pick<SweepParams, 'Vb' | 'Vf' | 'Sp' | 'prSd' | 'prCms' | 'prMmd'>>;

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
  // ---- Environment (per project — WinISD keeps T/p/phi in the .wpr [Box] section) --------
  /** Ambient temperature, K. Absent → `T_REF_K` (293.15). */
  tempK?: number;
  /**
   * Relative humidity, PERCENT (0–100). Absent → `RH_REF_PCT` (30). WinISD's `.wpr` `phi` is
   * a FRACTION; the one conversion between the two lives in the `.wpr` writer.
   */
  humidityPct?: number;
  /** Static air pressure, Pa. Absent → `P_REF_PA` (101325). */
  pressurePa?: number;
  /**
   * Selects the FORMULA for ρ/c: absent/false uses OpenISD's own CIPM-2007 moist-air model;
   * true uses WinISD's own simpler formula instead. Neither setting discards humidity or
   * pressure — both still fully affect the result either way. See air.ts's WinISD-parity doc.
   */
  useWinisdAirModel?: boolean;
  // Driver-side added mass to cone (kg) — raises Mms, lowers Fs. 0/absent = no-op. docs/research/WINISD_PARITY.md.
  driverAddedMass?: number;
  // Thermal power compression: coil temp rise ΔT (K) × alfaVC (SI /K) → hot Re. 0/absent = no-op.
  vcTempRise?: number;
  alfaVC?: number;
  // ---- WinISD Advanced-pane simulation options (PLAN_ADVANCED_SIM_OPTIONS.md) ----------
  /**
   * Source resistance placement (WinISD Advanced: "Rg is at driver side").
   * true/absent — Rs sits in series with EACH driver, so it scales with the array
   *               (n in parallel → Rs/n); the default.
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
  splXlimCurve: number[];
  /** `true` at each frequency where `splXlimCurve` had to back the drive off. */
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
