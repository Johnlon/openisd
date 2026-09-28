/**
 * Shared engine types.
 *
 * Modeled directly from the runtime shapes the engine already produces —
 * these types describe existing behaviour, they do not change it.
 */

import type {LossModeValue} from '../fields/lossMode.js';

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
 * `bandpass6` and `abc` have circuit CLASSES (`boxes/Bandpass6Box.ts`, `boxes/AbcBox.ts`,
 * reachable through `boxes/index.ts`'s `boxModel()`) and are full `SimulatableBoxType` members:
 * `circuit.ts`'s `solve()` (the `SimulationEngine.sweep()` production path) and
 * `domain/project/projectSweep.ts` both switch over every `SimulatableBoxType` including these
 * two — see `Bandpass6Box.ts`'s doc for the WinISD-captured formulas either box solves.
 */
export type BoxType =
  | 'sealed'
  | 'vented'
  | 'bandpass4'
  | 'bandpass6'
  | 'box-passive-radiator'
  | 'abc';

/** The box types the circuit solver's PRODUCTION path (`circuit.ts`'s `solve()`, reached through
 *  `SimulationEngine.sweep()`) actually models — every `BoxType` today (`Bandpass6Box.ts`/`AbcBox.ts` cover
 *  the last two, `boxes/index.ts`'s `boxModel()`). Spelled out as its OWN union rather than
 *  `= BoxType`: the two sets happen to match now, but a future `BoxType` with no circuit yet must
 *  widen `BoxType` without silently claiming it here too. */
export type SimulatableBoxType =
  | 'sealed'
  | 'vented'
  | 'bandpass4'
  | 'bandpass6'
  | 'box-passive-radiator'
  | 'abc';

import type {SelectorOption} from '../fields/index.js';

/** One of WinISD's sealed-box target-Q choices from the New Project wizard: `value` IS the Qtc. */
export type SealedAlignmentOption = SelectorOption<number>;

export type EbpSuitability = 'sealed' | 'either' | 'vented';

/** WinISD's five vented alignments from the New Project wizard, in its dropdown order. */
export type VentedAlignment = 'qb3' | 'bb4' | 'c4' | 'ebs3' | 'ebs6';

/** What a vented alignment designs: box volume and tuning. */
export interface VentedDesign {
  readonly Vb: number;
  readonly Fb: number;
}

/** Driver wiring for multi-driver setups. */
export type Wiring = 'series' | 'parallel';

/** Circuit model variant: 'winisd' — Le excluded from the acoustic path (WinISD, inductance off);
 *  'gyrator' — textbook, Le in the acoustic path through one BL; 'winisdGyrator' — WinISD's
 *  inductance-on model, Le's acoustic element built from the entered BL (BUG_20260926). */
export type CircuitModel = 'winisd' | 'gyrator' | 'winisdGyrator';

/**
 * Signal-chain filter descriptor — one of WinISD's 8 Filter Editor types, plus the two
 * OpenISD-only shelves. A sum type, not a bag of optional fields: each variant carries
 * exactly the parameters WinISD's own `[Filters]` `.wpr` format stores for that type
 * (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format"). Formulas and quirks:
 * winisd_research/GHIDRA_FINDINGS.md "EQ/Filter chain — every filter type's response and
 * group delay".
 */
/** WinISD's low/high-pass subtypes, in its Filter Editor "Subtype" order. */
export type PassFamily = 'butterworth' | 'linkwitzRiley' | 'bessel' | 'sos';

// One interface per filter class. `type` is the discriminant; a class that handles two WinISD
// types (low/high pass, low/high shelf) has one interface with a two-member `type`.
export interface PassSpec { type: 'lowpass' | 'highpass'; family: PassFamily; order: number; fc: number; Q: number }
export interface AllpassSpec { type: 'allpass'; order: number; t: number; Q: number }
export interface LinkwitzSpec { type: 'linkwitz'; f0: number; Q0: number; fp: number; Qp: number }
export interface ParametricEqSpec { type: 'peaking'; fc: number; Q: number; gain: number }
export interface PeakHighpassSpec { type: 'peakHighpass'; fpk: number; gainPk: number }
export interface StaticGainSpec { type: 'staticGain'; gain: number }
export interface RaisedCosineSpec { type: 'raisedCosine'; fc: number; bwOct: number; gain: number }
export interface ShelfSpec { type: 'lowshelf' | 'highshelf'; fc: number; Q: number; gain: number }
export type FilterSpec =
  | PassSpec | AllpassSpec | LinkwitzSpec | ParametricEqSpec
  | PeakHighpassSpec | StaticGainSpec | RaisedCosineSpec | ShelfSpec;
export type FilterType = FilterSpec['type'];

/** What the project's chain adds to a spec: bypass, and the UI's list key (crypto.randomUUID),
 *  which the engine ignores. */
export interface ChainEntry { id?: string; enabled: boolean }
/** One signal-chain filter. */
export type Filter = ChainEntry & FilterSpec;
// The chain filter of each class — what its editor shows and its typed edit takes and returns.
export type PassFilter = ChainEntry & PassSpec;
export type AllpassFilter = ChainEntry & AllpassSpec;
export type LinkwitzFilter = ChainEntry & LinkwitzSpec;
export type ParametricEqFilter = ChainEntry & ParametricEqSpec;
export type PeakHighpassFilter = ChainEntry & PeakHighpassSpec;
export type StaticGainFilter = ChainEntry & StaticGainSpec;
export type RaisedCosineFilter = ChainEntry & RaisedCosineSpec;
export type ShelfFilter = ChainEntry & ShelfSpec;
// What an editor may write, per class — the fields WinISD's Filter Editor exposes, each clamped
// to its entry range by that class's typed edit.
export type PassPatch = Partial<Pick<PassSpec, 'family' | 'order' | 'fc' | 'Q'>>;
export type AllpassPatch = Partial<Pick<AllpassSpec, 'order' | 't' | 'Q'>>;
export type LinkwitzPatch = Partial<Pick<LinkwitzSpec, 'f0' | 'Q0' | 'fp' | 'Qp'>>;
export type ParametricEqPatch = Partial<Pick<ParametricEqSpec, 'fc' | 'Q' | 'gain'>>;
export type PeakHighpassPatch = Partial<Pick<PeakHighpassSpec, 'fpk' | 'gainPk'>>;
export type StaticGainPatch = Partial<Pick<StaticGainSpec, 'gain'>>;
export type RaisedCosinePatch = Partial<Pick<RaisedCosineSpec, 'fc' | 'bwOct' | 'gain'>>;
export type ShelfPatch = Partial<Pick<ShelfSpec, 'fc' | 'Q' | 'gain'>>;

/** One filter's `.wpr` `[Filters]` on-disk shape: `filter<i>type`/`filter<i>params`
 *  (winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format"). `type` is WinISD's own
 *  Filter Editor type number (0-7); `params` is the `;`-separated field list for that type,
 *  enabled included. */
/** One `.wpr` `[Filters]` entry after decoding: the filter, or `null` where WinISD skips the
 *  entry; `warning` set whenever it did not import as its own stated values. */
export interface WprFilterImport { filter: Filter | null; warning: string | null }

export interface WprFilter {
  type: number;
  params: string;
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
  /** WinISD's driver count (true/absent): N copies of one driver, each in Vb/N fed P/N — sealed box
   *  only so far (bugs/BUG_20260928_driver-count-not-winisd.md). false: the N coils wired by
   *  `wiring` into one terminal impedance. */
  winisdDriverCountModel?: boolean;
  Rs?: number;
  circuitModel?: CircuitModel;
  /** WinISD's VA, P·Re·|Hf|²/|Z + Rg| (true/absent), or the amplifier's apparent power,
   *  P·(Re + Rg)·|Hf|²/|Z_amp| (false). */
  winisdVaModel?: boolean;
  // Box losses
  lossMode?: LossModeValue;
  Ql?: number;
  Qa?: number;
  Qp?: number;
  // Vented / bandpass
  Vf?: number;
  Sp?: number;
  Leff?: number;
  /** The REAR port's own cross-sectional area, m² — `bandpass6`/`abc` only, WinISD `.wpr`
   *  `Sdrport`. Read ONLY by `simulation/SimulationEngine.ts`'s own `pvRear` chart computation (rear-port velocity =
   *  volume flow / area, the same divide `Sp` above does for the front/only port); never by the
   *  circuit itself, which gets the rear port's acoustic MASS from `Fr` (the chamber's tuning),
   *  not from this geometry — the same reason `Bandpass6Box.ts`/`AbcBox.ts` never call
   *  `port.ts`'s `portImpedance()`. Absent for any other box type, which never reads it. */
  Spr?: number;
  /** The vent's tuning target, Hz (WinISD `[VentRear]`/`[VentFront]` `Fb`, `VentedBox.tuning_goal_hz`
   *  / `Bandpass4Box.chambers.front.tuning_goal_hz`) — read ONLY by `circuit.ts`'s vented
   *  `winisd-lossy` branch, whose port mass Map = 1/(ωb²·Cab) comes from `Fb` and never from
   *  `Leff` (winisd_research/GHIDRA_FINDINGS.md "Vented box — `0x456800`"). Absent for any other
   *  box/lossMode combination, which never reads it. */
  Fb?: number;
  // Passive radiator
  prSd?: number;
  prNum?: number;
  prMmd?: number;
  prMadd?: number;
  prCms?: number;
  prRms?: number;
  prXmax?: number;
  /** WinISD `.wpr` `[Box] Fr`. For a passive-radiator box, the resonance this box and this
   *  radiator actually produce together (`PassiveRadiatorBox.systemTuning_hz`, NOT the
   *  radiator's own free-air Fs) — WinISD's own code computes that resonance itself rather than
   *  reading this field back (winisd_research/GHIDRA_FINDINGS.md "Passive radiator box —
   *  `0x45a960`"). For `bandpass6`/`abc`, the REAR chamber's own vent tuning target, read by
   *  `Bandpass6Box`/`AbcBox`'s `winisd-lossy` branch the same way `Ff` feeds the front chamber —
   *  Maprear = 1/(ωr²·Cabr) comes from THIS (winisd_research/GHIDRA_FINDINGS.md "6th-order
   *  bandpass — `0x5668c0`", "ABC (Aperiodic Bi-Chamber) — `0x4591b0`"). Absent for `sealed`/
   *  `vented`/`bandpass4`, which never read it. */
  Fr?: number;
  // 4th-order bandpass — read ONLY by `Bandpass4Box`'s `winisd-lossy` branch (never
  // `conventional-lossy`/`lossless`, which keep the shared `Ql`/`Qa`/`Qp` above for the rear
  // chamber and never read the front chamber's own losses at all). Each is a FIXED resistance
  // at that chamber's own frequency, never per-sweep-frequency, and never shared between
  // chambers (winisd_research/GHIDRA_FINDINGS.md "4th-order bandpass — `0x457a30`",
  // bugs/BUG_20260927_bandpass4-box-not-winisd-form.md). Absent for any other box/lossMode
  // combination, which never reads them.
  /** Rear (sealed) chamber leakage Q, WinISD `.wpr` `Qlr` — `Bandpass4Box.chambers.rear.losses.Ql`. */
  Qlr?: number;
  /** Rear chamber absorption Q, WinISD `.wpr` `Qar` — `chambers.rear.losses.Qa`. */
  Qar?: number;
  /** Inter-chamber leak Q, WinISD `.wpr` `Qiclfr` — `chambers.rear.losses.Qicl`. Read at the
   *  DRIVER's own ωs = 1/√(Mas·Cas), never at ωsc/ωf. */
  Qiclfr?: number;
  /** Front (vented) chamber leakage Q, WinISD `.wpr` `Qlf` — `chambers.front.losses.Ql`. */
  Qlf?: number;
  /** Front chamber absorption Q, WinISD `.wpr` `Qaf` — `chambers.front.losses.Qa`. */
  Qaf?: number;
  /** Front chamber port loss Q, WinISD `.wpr` `Qpf` — `chambers.front.losses.Qp`. */
  Qpf?: number;
  /** Front chamber tuning, Hz, WinISD `.wpr` `Ff` — `chambers.front.tuning_goal_hz`. The front
   *  port mass Mapf = 1/(ωf²·Cabf) comes from THIS, never from the front vent's own
   *  length/area (`Leff`/`Sp`, which the front vent's chart-facing geometry still uses). */
  Ff?: number;
  // 6th-order bandpass / ABC — read ONLY by `Bandpass6Box`/`AbcBox`'s `winisd-lossy` branch. The
  // rear chamber's OWN port loss Q: `bandpass4`'s rear chamber is sealed and has no port, so no
  // prior box type needed this field (winisd_research/GHIDRA_FINDINGS.md "6th-order bandpass —
  // `0x5668c0`").
  /** Rear chamber port loss Q, WinISD `.wpr` `Qpr` — `chambers.rear.losses.Qp`. */
  Qpr?: number;
  // ABC's intra-chamber port — read ONLY by `AbcBox`'s `winisd-lossy` branch. Lossless
  // (Rai = 0, winisd_research/GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber) — `0x4591b0`"), so
  // its mass is the only element: Mai = ρ·`LeffIntra`/`SpIntra`, the same
  // end-correction-folded-length/area convention `Leff`/`Sp` use for the front/rear ports.
  /** Intra-chamber vent effective length (physical length + end-correction·diameter), m. */
  LeffIntra?: number;
  /** Intra-chamber vent cross-sectional area, m². */
  SpIntra?: number;
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
  // Iso-barik loading: the driver is a compound pair (`isobarikPair`). Absent = standard.
  loading?: 'standard' | 'isobaric';
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
  /** WinISD's force-flat (true/absent): every point to the transfer function's 0 dB, boosted or
   *  cut, uncapped (bugs/BUG_20260928_force-flat-response-not-winisd.md). false: boost only, up to
   *  the passband reference, capped at `flatMaxBoostDb`. */
  winisdFlatModel?: boolean;
  /** Ceiling on the conventional force-flat boost, dB. Absent → FLAT_MAX_BOOST_DB. */
  flatMaxBoostDb?: number;
}

/** Circuit solution at a single frequency. */
export interface Solution {
  U0: Complex;
  UD: Complex;
  UP: Complex;
  /** The rear port's own volume velocity — `bandpass6`/`abc` only (`BoxOutput.UPr`'s own doc,
   *  `boxes/BoxModel.ts`); `undefined` for every other box type, which has at most one port and
   *  reports it through `UP`. */
  UPr?: Complex;
  /** ABC's intra-chamber port velocity, WinISD's own chart-21 form (Ricl left out — a WinISD
   *  wart, `boxes/AbcBox.ts`'s own doc) — `winisd-lossy` only; `undefined` for `lossless`/
   *  `conventional-lossy` (`AbcBox.solve()` does not compute it there) and for every non-`abc`
   *  box type. */
  UPi?: Complex;
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
  /** Port air velocity, m/s. The vent for `vented`; the FRONT port for `bandpass4`/`bandpass6`/
   *  `abc` (`Solution.UP`'s own doc — `boxes/Bandpass6Box.ts`/`AbcBox.ts` both return the front
   *  port's flow as `UP`). `0` (never a chart-hiding `null`) for `sealed`/`box-passive-radiator`,
   *  which have no port. */
  pv: number[];
  /** The REAR port's own air velocity, m/s — `bandpass6`/`abc` only, from `Solution.UPr`; `null`
   *  for every other box type, which has at most one port and reports it through `pv` above. */
  pvRear: number[] | null;
  /** ABC's intra-chamber port velocity, m/s, WinISD's own chart-21 form (`Solution.UPi`'s own
   *  doc) — `winisd-lossy` only; `null` for `lossless`/`conventional-lossy` and for every
   *  non-`abc` box type. */
  pvIntra: number[] | null;
  zmag: number[];
  zph: number[];
  gd: number[];
  /** Transfer function magnitude in dB relative to the high-frequency passband asymptote (0 dB). */
  tfMag: number[];
  /**
   * WinISD's "Transfer function magnitude (PR)" — the radiator's own pressure (jω·Upr), on the
   * SAME 0 dB reference as `tfMag`, but — unlike `tfMag` and every other system chart — NOT
   * multiplied by the filter chain (winisd_research/GHIDRA_FINDINGS.md "Passive radiator box",
   * "Radiator transfer function" bullet). `null` for every box type but
   * `box-passive-radiator`: WinISD itself has no such chart for them, so this is absence, never
   * a fake zero (unlike `excPR` above, which WinISD computes as 0 for every other box).
   */
  prTfMag: number[] | null;
  /** `prTfMag`'s phase, in RADIANS, unwrapped — same convention as `phase`. `null` exactly
   *  where `prTfMag` is. */
  prTfPhase: number[] | null;
  /**
   * WinISD's "Rear port - Gain" (vented box only) — the port's own pressure (K·ω·Up, ω taken
   * as a REAL scalar, same wart as `prTfPhase`), on the SAME `tfMag` 0 dB reference as
   * `prTfMag` — but, unlike `prTfMag`, MULTIPLIED by the filter chain, same as `tfMag` itself
   * (winisd_research/GHIDRA_FINDINGS.md "Passive radiator box", "Rear port gain" bullet — the
   * formula is box-agnostic, found against a vented capture). `null` for every box type but
   * `vented`: WinISD itself has no such chart for them, so this is absence, never a fake zero.
   */
  rearPortGain: number[] | null;
  /**
   * WinISD's "Front port - Gain" (bandpass4 box only) — the SAME computation as `rearPortGain`
   * above (K·jω·Up·Hf, magnitude only, so keeping or dropping the j never shows), against the
   * front port's own `Up` rather than the rear port's (winisd_research/GHIDRA_FINDINGS.md
   * "4th-order bandpass", "Front port gain" bullet). `null` for every box type but `bandpass4`,
   * same reasoning as `rearPortGain`.
   */
  frontPortGain: number[] | null;
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
  /** Amplifier apparent load power (VA), WinISD's: P·Re·|Hf|²/|Z + Rg| with P the drive power
   *  into Re + Rg. WinISD writes Re where the apparent power has Re + Rg (f_46bd30 case 0x14,
   *  BUG_20260927_winisd-va-uses-re-not-re-plus-rg). */
  va: number[];
}

/** Max-SPL / max-power output. `xlim[i]` = Xmax is the limiting factor at point i. */
export interface MaxCurvesResult {
  fs: number[];
  maxspl: number[];
  maxpwr: number[];
  xlim: boolean[];
  peAbsent: boolean;
}

/** What a passive-radiator tuning solve reads: the box volume and the radiator's own mass,
 *  added mass, area and compliance — all present. */
export interface PrParams {
  readonly Vb: number;
  readonly prMmd: number;
  readonly prMadd: number;
  readonly prSd: number;
  readonly prCms: number;
  /** Radiator count; each radiator carries prMmd + prMadd. */
  readonly prNum: number;
}
