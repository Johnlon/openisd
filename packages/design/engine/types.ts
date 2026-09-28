/**
 * Shared engine types.
 *
 * Modeled directly from the runtime shapes the engine already produces —
 * these types describe existing behaviour, they do not change it.
 */

import type { LossModeValue } from './lossMode.js';

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
    case 'bandpass6':
    case 'abc':
      return null;
  }
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
  /** The box's own tuning, Hz — WinISD's "Fr" for a passive-radiator box (`PassiveRadiatorBox.
   *  systemTuning_hz`, the resonance this box and this radiator actually produce together, NOT
   *  the radiator's own free-air Fs) — read ONLY by `circuit.ts`'s passive-radiator `winisd-lossy`
   *  branch, whose Ral/Raa (leak/absorption) are fixed at `Fr` rather than per-frequency
   *  (winisd_research/GHIDRA_FINDINGS.md "Passive radiator box — `0x45a960`"). Absent for any
   *  other box/lossMode combination, which never reads it. */
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
