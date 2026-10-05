/**
 * The simulation area — the frequency sweep, converting circuit solutions to observable
 * quantities, and the limit curves.
 *
 * Sound pressure level:
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 *
 * Far-field pressure from a piston source (p = ρωU₀/2πr):
 *   https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance
 *
 * Authoritative source (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
 */

import {FLAT_MAX_BOOST_DB, P0} from '../constants.js';
import type {EnvironmentIssue} from '../air.js';
import {solveEnvironment} from '../air.js';
import type {Complex} from '../types.js';
import {cAbs, cArg, cDiv, cMul, cScale, cx} from '../complex.js';
import type {CircuitQuantities} from '../circuit.js';
import {hfAsymptotePressure_Pa, solve} from '../circuit.js';
import {missingDependencies} from '../consistency.js';
import type {DriverIssue, DriverPrerequisite, DriverQuantityName} from '../driver/DriverEngine.js';
import type {PrIssue} from '../pr/PrEngine.js';
import type {VentIssue} from '../vent/VentEngine.js';
import {hotRe, isobarikPair, terminalBL_Tm, withAddedMass} from '../solvers/driverQuantities.js';
import {applyFilters} from '../filters.js';
import {driveFromVoltage} from '../signal/SignalEngine.js';
import type {BoxType, DriverError, EnclosureParams, MaxCurvesResult, SweepParams, SweepResult, WinisdFilterErrors} from '../types.js';
import type {DriverValues, SweepDriver} from '../solverTypes.js';
import type {BoxParamsIssue, BoxParamsQuantityName, BoxParamsSolveResult} from '../params.js';
import {requiredParamsFor} from '../params.js';
import type {SolveRoute} from '../consistency.js';
import type {SignalIssue} from '../signal/SignalEngine.js';

/** Every issue channel a sweep can surface: the driver's own missing circuit fields (a
 *  `missing-dependencies` issue per absent field, never a combined message or a cross-field
 *  substitution suggestion — packages/design/AGENTS.md ruling QO144), the environment's entered
 *  air constants being out of range, an unstated enclosure parameter (`OpenISDProject.sweep()`
 *  reports this channel when the box has no `Vb`/`Vf`/`Sp`/etc. to sweep with at all — the engine
 *  `sweep()` function itself never produces this variant, since it never reads box params
 *  before the domain has already confirmed they exist), or the active box's own vent/PR
 *  resonance being unstated (`OpenISDProject.sweep()` — a vented/bandpass4 project whose port
 *  has neither a tuning nor a port length, or a passive-radiator project whose radiator has
 *  neither an added mass nor a tuning, would otherwise sweep silently to NaN because
 *  `SweepParams.Leff`/`prMadd` come back undefined; the domain guard names the missing target
 *  instead). Never a sweep-own quantity: `sweep()` computes nothing a caller enters, so it has
 *  no target of its own to report an issue about. */
export type SweepIssue =
  | DriverIssue | EnvironmentIssue | BoxParamsIssue
  | VentIssue | PrIssue | SignalIssue;

/** The unified sweep result: the curves (or null if nothing could be derived), and why. */
export interface SweepSolveResult {
  readonly values: SweepResult | null;
  readonly issues: readonly SweepIssue[];
}

/** The unified max-curves result — same shape as `SweepSolveResult`, over `MaxCurvesResult`, plus
 *  `driverPrerequisites`: neither `Pe_W` nor `Xmax_m` stated is NOT a blocking issue — `maxspl`/
 *  `maxpwr` going to `Infinity` is the mathematically correct answer (nothing limits them), not a
 *  gap. QO143 (2026-09-15): report it as its own advisory, separate from `issues`, naming exactly
 *  what would bound the curve — never silently, and never as a false "cannot be calculated". */
export interface MaxCurvesSolveResult {
  readonly values: MaxCurvesResult | null;
  readonly issues: readonly SweepIssue[];
  readonly driverPrerequisites: readonly DriverPrerequisite[];
}

/** The "no output" sentinel sweep() writes where |p| = 0 exactly. A real level can sit below it
 *  (a steep filter), so silence is this exact value, never a threshold. */
const SILENCE_DB = -200;

/** Whether `v` is the silence sentinel, not a real level. */
function isSilence(v: number): boolean {
  return v === SILENCE_DB;
}


/**
 * Transfer Function Magnitude in dB relative to `ref`, the lossless circuit's high-frequency
 * asymptote (0 dB).
 */
export function tfMag(spl: number[], ref: number): number[] {
  return spl.map(v => (Number.isFinite(v) && !isSilence(v)) ? v - ref : v);
}


/**
 * Unwrap a phase array (radians) to remove ±π discontinuities.
 * https://en.wikipedia.org/wiki/Phase_unwrapping
 */
export function unwrap(p: number[]): number[] {
  const o = [p[0]];
  for (let i = 1; i < p.length; i++) {
    let d = p[i] - p[i - 1];
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    o.push(o[i - 1] + d);
  }
  return o;
}

/** Group delay central-difference half-step, relative to `f`. WinISD (`f_4618f0` chart 12) steps
 *  a fixed 1e-10 Hz, which divides the response's rounding error by 2π·2e-10 Hz: ~3e-4 ms of
 *  staircase on every box and up to 0.16 ms on the 6th-order bandpass above 1.2 kHz
 *  (bugs/BUG_20261005_bp6-group-delay-noise-above-1k.md). */
const GROUP_DELAY_RELATIVE_STEP = 1e-6;
/** Floor on the half-step, so `f` = 0 still has a non-zero span. */
const GROUP_DELAY_MIN_STEP_HZ = 1e-10;

/**
 * Group delay in ms of the response `h` at `f` (Hz): τg = −dφ/dω, as the phase slope AT `f`,
 * by central difference over f ± 1e-6·f, the phase step read as arg(H(f+δ)/H(f−δ)).
 *   https://en.wikipedia.org/wiki/Group_delay_and_phase_delay
 *
 * ONE definition, shared by the system group delay (`gd`) and the filter-chain group
 * delay (`fltGd`) — the two charts must not be able to disagree about what τg means.
 */
export function groupDelayAtMs(h: (f: number) => Complex, f: number): number {
  const step = Math.max(GROUP_DELAY_MIN_STEP_HZ, f * GROUP_DELAY_RELATIVE_STEP);
  const fAbove = f + step;
  const fBelow = Math.max(1e-12, f - step);
  const deltaF = fAbove - fBelow;
  const above = h(fAbove), below = h(fBelow);
  // No signal, no phase: a silent response (eg = 0) has no delay, as its phase reads 0.
  if (cAbs(above) === 0 || cAbs(below) === 0) return 0;
  const dphi = cArg(cDiv(above, below));
  const tau = -dphi / (2 * Math.PI * deltaF) * 1000;
  // A flat phase gives `-(0)`, which is NEGATIVE zero. There is no such delay, and
  // `Object.is` — hence `assert.strict.equal` and any `1 / τ` — treats it as its own value.
  return tau === 0 ? 0 : tau;
}

/**
 * Frequency sweep across a log-spaced range.
 *
 * Far-field pressure at 1 m (half-space piston in infinite baffle):
 *   p(ω) = ρ · ω · U₀ / (2π · r)
 *   https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance
 *
 * SPL = 20 · log10(|p| / P0)  where P0 = 20 µPa
 *   https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
 *
 * Peak excursion from volume velocity UD:
 *   x_peak = √2 · |UD| / (ω · Sd)
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Group delay τg = −dφ/dω
 *   https://en.wikipedia.org/wiki/Group_delay_and_phase_delay
 */
/**
 * The six quantities the circuit cannot run without, or the issues naming what is missing.
 *
 * These six are what `circuit.ts` reads unguarded; every OTHER quantity a curve wants is
 * optional and gated at its own use below, because a driver states what its datasheet printed
 * and each chart decides for itself what it can still draw. `Number.isFinite` is part of the
 * check: a subnormal `Sd_m2` yields an infinite `Cms_m_per_N`, which is not a driver.
 */
/** The six quantities `circuit.ts` reads unguarded — every OTHER quantity a curve wants is
 *  optional and gated at its own use below, because a driver states what its datasheet printed
 *  and each chart decides for itself what it can still draw. */
const CIRCUIT_REQUIRED_FIELDS: readonly DriverQuantityName[] = Object.freeze([
  'Sd_m2', 'Re_terminal_ohm', 'BL_terminal_Tm', 'Cms_m_per_N', 'Mms_kg', 'Rms_kg_per_s',
]);

/**
 * The circuit's required quantities, or the issues naming which are absent.
 *
 * One `missing-dependencies` issue per absent field, each naming itself as the (trivial,
 * one-field) route that would unblock it — never a combined message, and never a suggestion to
 * state a DIFFERENT field instead. QO144 (2026-09-15): the user wants to know exactly what to
 * do to get the chart working, not weigh a menu of cross-field substitutions. A stated-but-
 * non-physical value (≤0, non-finite — `Number.isFinite` matters here: a subnormal `Sd_m2`
 * yields an infinite `Cms_m_per_N`, which is not a driver) is reported the same way as absent:
 * either way the user's actual next step is "state a valid `<field>`".
 */
/** The driver's values with null read as absent — the one conversion point `sweep()` needs:
 *  `withAddedMass` (a pure mass-shift transform) and `circuitQuantities` both work over plain
 *  numbers, never over the `SolverField` handle machinery itself. No type name crosses this
 *  boundary — `withAddedMass`'s own working-set type is private to `solver.ts` (S2-10), and
 *  this object's shape is checked structurally against it at the call site below. */
function driverValues(v: DriverValues) {
  return {
    Fs_hz: v.Fs_hz ?? undefined, Re_ohm: v.Re_ohm ?? undefined,
    Znom_ohm: v.Znom_ohm ?? undefined, Le_H: v.Le_H ?? undefined,
    fLe_hz: v.fLe_hz ?? undefined, KLe_H_sqrtHz: v.KLe_H_sqrtHz ?? undefined,
    Qes: v.Qes ?? undefined, Qms: v.Qms ?? undefined, Qts: v.Qts ?? undefined,
    Vas_m3: v.Vas_m3 ?? undefined, Sd_m2: v.Sd_m2 ?? undefined, Dd_m: v.Dd_m ?? undefined,
    BL_Tm: v.BL_Tm ?? undefined, Mms_kg: v.Mms_kg ?? undefined,
    Cms_m_per_N: v.Cms_m_per_N ?? undefined, Rms_kg_per_s: v.Rms_kg_per_s ?? undefined,
    EBP_hz: v.EBP_hz ?? undefined, Xmax_m: v.Xmax_m ?? undefined, Vd_m3: v.Vd_m3 ?? undefined,
    Hc_m: v.Hc_m ?? undefined, Hg_m: v.Hg_m ?? undefined, Pe_W: v.Pe_W ?? undefined,
    no: v.no ?? undefined, SPLref_dB: v.SPLref_dB ?? undefined, SPL_dB: v.SPL_dB ?? undefined,
    USPL_dB: v.USPL_dB ?? undefined, SPLmax_dB: v.SPLmax_dB ?? undefined,
    SPLmaxLF_dB: v.SPLmaxLF_dB ?? undefined, Rme_kg_per_s: v.Rme_kg_per_s ?? undefined,
    Mpow_N_per_sqrtW: v.Mpow_N_per_sqrtW ?? undefined, Mcost_kg_per_s: v.Mcost_kg_per_s ?? undefined,
    gamma_m_per_s2_A: v.gamma_m_per_s2_A ?? undefined, Gloss: v.Gloss ?? undefined,
    Vcd_m: v.Vcd_m ?? undefined, Depth_m: v.Depth_m ?? undefined, MagDepth_m: v.MagDepth_m ?? undefined,
    Magnet_m: v.Magnet_m ?? undefined, DVol_m3: v.DVol_m3 ?? undefined,
    c_m_per_s: v.c_m_per_s ?? undefined, roo_kg_per_m3: v.roo_kg_per_m3 ?? undefined,
    Re_terminal_ohm: v.Re_terminal_ohm ?? undefined, BL_terminal_Tm: v.BL_terminal_Tm ?? undefined,
    numVC: v.numVC ?? undefined, wiring: v.wiring ?? undefined,
  };
}

/** WinISD's driver-count model: more than one driver, every box type (runs/sealed-w5-nd2,
 *  vented-, bp4-, pr-, bp6- and abc-w5-nd2). SPL, excursion, VA and maximum power follow it. */
function winisdCountsDrivers(P: SweepParams): boolean {
  return (P.nDrivers || 1) > 1;
}

/** The impedance chart's factor over one driver's: 1 with WinISD's per-driver impedance bug
 *  (`winisdDriverCountModel` true or absent); otherwise the array the amplifier drives, N for N
 *  drivers in series, 1/N in parallel (John, 2026-10-05). */
function arrayImpedanceScale(P: SweepParams, n: number): number {
  if (P.winisdDriverCountModel !== false) return 1;
  return P.wiring === 'series' ? n : 1 / n;
}

/** One of `n` drivers as WinISD simulates it: alone, driven at P/n, in Vb/n with 1/n of the port
 *  area (same length, so the same tuning). */
function oneOfN(P: SweepParams, n: number): SweepParams {
  return { ...oneBoxOfN(P, n), eg: P.eg / Math.sqrt(n) };
}

/** One of `n` drivers' share of the box: Vb/n and, where they exist, Vf/n, every port area /n and prNum/n. */
function oneBoxOfN(P: SweepParams, n: number): SweepParams {
  return { ...P, nDrivers: 1, Vb: P.Vb / n, ...(P.Vf !== undefined ? { Vf: P.Vf / n } : {}), ...(P.Sp !== undefined ? { Sp: P.Sp / n } : {}), ...(P.prNum !== undefined ? { prNum: P.prNum / n } : {}),
    ...(P.Spr !== undefined ? { Spr: P.Spr / n } : {}), ...(P.SpIntra !== undefined ? { SpIntra: P.SpIntra / n } : {}) };
}

function circuitQuantities(q: ReturnType<typeof withAddedMass>, Le_H: number | undefined, BL_typed_Tm: number | null): { value: CircuitQuantities | null; issues: DriverIssue[] } {
  const issues: DriverIssue[] = [];
  for (const field of CIRCUIT_REQUIRED_FIELDS) {
    const v = q[field];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) continue;
    issues.push(missingDependencies(field,
      [{ formula: `${field} is a directly entered or derived driver quantity`, required: [field], missing: [field] }]));
  }
  if (issues.length > 0) return { value: null, issues };
  return {
    value: {
      Sd_m2: q.Sd_m2!, Re_terminal_ohm: q.Re_terminal_ohm!, BL_terminal_Tm: q.BL_terminal_Tm!,
      Cms_m_per_N: q.Cms_m_per_N!, Mms_kg: q.Mms_kg!, Rms_kg_per_s: q.Rms_kg_per_s!, Le_H,
      BL_Qes_Tm: blFromQes(q.Re_terminal_ohm!, q.Cms_m_per_N!, q.Fs_hz, q.Qes),
      BL_entered_Tm: enteredTerminalBL_Tm(q, BL_typed_Tm),
    },
    issues: [],
  };
}

/** The BL the driver STATES (typed, not calculated), at the terminals. `BL_terminal_Tm` is the BL
 *  the circuit's damping runs on, which "Enable WinISD two-BL driver bug" replaces with the
 *  Qes-derived one; WinISD keeps reading the typed figure for the motor's push and in `CLe`.
 *  Falls back to `BL_terminal_Tm` where no BL is typed: WinISD's own calculated BL is the
 *  Qes-derived one, so there is no second BL to disagree with. */
function enteredTerminalBL_Tm(q: ReturnType<typeof withAddedMass>, BL_typed_Tm: number | null): number {
  if (BL_typed_Tm === null || !(BL_typed_Tm > 0)) return q.BL_terminal_Tm!;
  return terminalBL_Tm(BL_typed_Tm, q.numVC, q.wiring);
}

/** The BL a driver's Fs/Qes/Cms/Re imply: BL² = Re/(ωs·Qes·Cms). Absent when Fs or Qes is. */
function blFromQes(Re_ohm: number, Cms_m_per_N: number, Fs_hz: number | undefined, Qes: number | undefined): number | undefined {
  if (Fs_hz === undefined || Qes === undefined) return undefined;
  return Math.sqrt(Re_ohm / (2 * Math.PI * Fs_hz * Qes * Cms_m_per_N));
}




/**
 * Postcondition: classify a sweep result's finiteness so a degenerate design is
 * never a silently blank chart. A precondition on inputs can't foresee a
 * frequency-dependent singularity, so this is the belt-and-braces at the exit.
 * Returns a DriverError-shaped issue (the same channel `sweep` itself reports on), or null — see
 * `classifyArrays` below for the three-way rule the two postconditions share.
 */
/** `prTfMag`/`prTfPhase` join the plotted set only where they exist (`box-passive-radiator`) —
 *  `null` elsewhere is WinISD having no such chart for that box, not a gap to report. */
function prTransferArrays(sw: SweepResult): readonly PlottedArray[] {
  return sw.prTfMag === null || sw.prTfPhase === null ? [] : [
    { label: 'PR transfer magnitude', values: sw.prTfMag },
    { label: 'PR transfer phase', values: sw.prTfPhase },
  ];
}

/** `rearPortGain` (`vented`) and `frontPortGain` (`bandpass4`) each join the plotted set only
 *  where they exist — same reasoning as `prTransferArrays` above; exactly one of the two is
 *  ever non-null for a given box. */
function portGainArrays(sw: SweepResult): readonly PlottedArray[] {
  return [
    ...(sw.rearPortGain === null ? [] : [{ label: 'rear port gain', values: sw.rearPortGain }]),
    ...(sw.frontPortGain === null ? [] : [{ label: 'front port gain', values: sw.frontPortGain }]),
  ];
}




/**
 * The shared finiteness rule, so the two postconditions above cannot drift apart.
 * `fs` is the frequency grid the arrays are sampled on; `arrays` are the plotted series.
 *   - null  — every plotted point is finite (sentinels like −200 dB count as finite)
 *   - error — EVERY grid point has at least one non-finite observable: nothing usable
 *   - warn  — otherwise; the curve still draws with a gap, so name the frequency
 */
interface PlottedArray { readonly label: string; readonly values: number[] }

function classifyArrays(
  fs: number[], arrays: readonly PlottedArray[], field: string,
  opts: { allowPositiveInfinity: boolean } = { allowPositiveInfinity: false },
): DriverError | null {
  const isBad = (v: number): boolean => opts.allowPositiveInfinity ? (Number.isNaN(v) || v === -Infinity) : !Number.isFinite(v);
  const badIdx = new Set<number>();
  for (const arr of arrays)
    for (let i = 0; i < arr.values.length; i++)
      if (isBad(arr.values[i])) badIdx.add(i);
  if (badIdx.size === 0) return null;

  // Test on the whole grid, not on the headline series alone: `spl` carries a finite
  // −200 dB silence sentinel that would mask a pervasive breakdown (Vb=0 → exc/zmag all
  // NaN but spl=−200), so "the primary series has a finite point" is not enough to call
  // the result usable.
  if (badIdx.size === fs.length) {
    const failed = arrays.filter(arr => arr.values.every(isBad)).map(arr => arr.label);
    return {
      level: 'error',
      field,
      message: `Sweep returned no finite values in: ${failed.join(', ')}. Maximum curves require finite Pe or Xmax bounds.`,
    };
  }

  // Otherwise an isolated singularity: the curve still draws (the renderer gaps
  // non-finite points); name the affected frequency so the gap isn't a mystery.
  const freqs = [...badIdx].sort((a, b) => a - b).map(i => fs[i]);
  const near = freqs.slice(0, 3).map(f => f >= 100 ? f.toFixed(0) : f.toFixed(1)).join(', ');
  const more = freqs.length > 3 ? ` (+${freqs.length - 3} more)` : '';
  return { level: 'warn', field, message: `Simulation undefined near ${near} Hz${more} — likely a numerical singularity; the curve has a gap there.` };
}

/** The simulation area of the engine: the frequency sweep and the limit curves for a driver in
 *  a box, the enclosure-parameter precondition the circuit needs met, and the readouts and
 *  postcondition classifiers a chart applies to a swept result. */
export interface SimulationEngine {
  /** The response, one complex value per frequency. */
  sweep(drv: SweepDriver, Le_H: number | undefined, box: BoxType, P: SweepParams): SweepSolveResult;
  /** The limit curves — how loud before excursion or port velocity gives out. */
  maxCurves(drv: SweepDriver, Le_H: number | undefined, box: BoxType, P: SweepParams): MaxCurvesSolveResult;
  /** The enclosure-parameter precondition (T9): `values` is `P` unchanged when every field the
   *  circuit divides by is present for `box`'s topology, else `null`, with `issues` naming what
   *  is missing. */
  solveBoxParams(box: BoxType, P: EnclosureParams): BoxParamsSolveResult;
  /** The passband reference level a response is measured against. */
  passbandRef(spl: number[]): number;
  /** The real levels of a dB curve: finite, and not the silence sentinel. A real level may sit
   *  far below −190 dB (a steep filter). */
  realLevels(db: readonly number[]): number[];
  /** A dB curve of `n` points that are all silence — what a design with no such output draws. */
  silentCurve(n: number): number[];
  /** Where the response has fallen by `dropDb`, or null if it never does. */
  rolloffFreq(sw: SweepResult, dropDb: number): number | null;
  /** A response carrying a non-finite value — a fault, not a curve. */
  classifyFinite(sw: SweepResult): DriverError | null;
  /** Finiteness issues split by plotted output, for a chart that needs one specific cause. */
  classifyFiniteIssues(sw: SweepResult): DriverError[];
  /** A response the flat-clamp produced rather than the physics. */
  classifyFlatClamp(sw: SweepResult): DriverError | null;
  /** Limit curves carrying a non-finite value. */
  classifyMaxFinite(mx: MaxCurvesResult): DriverError | null;
}

/** The simulation area alone, for a thread that only sweeps. It reads no app setting, so it takes none;
 *  the whole engine comes from `createEngine`. */
export function createSimulationEngine(): SimulationEngine {
  return new SimulationEngineImpl();
}

export class SimulationEngineImpl implements SimulationEngine {
  /**
   * The passband reference level of an SPL curve, in dB — the peak of the real curve,
   * ignoring the silence sentinel so a single dead point can't define the reference.
   *
   * ONE definition, shared by everything that needs "0 dB is here": the transfer-function
   * chart's normalisation, the F3/F6/F10 read-outs, and force-flat's EQ target. Returns 0
   * for an all-silent curve (a −200 dB "reference" is not a reference).
   */
  realLevels(db: readonly number[]): number[] {
    return db.filter(v => Number.isFinite(v) && !isSilence(v));
  }

  silentCurve(n: number): number[] {
    return new Array<number>(n).fill(SILENCE_DB);
  }

  passbandRef(spl: number[]): number {
    let ref = -Infinity;
    for (const v of spl) if (Number.isFinite(v) && !isSilence(v) && v > ref) ref = v;
    return ref === -Infinity ? 0 : ref;
  }

  /**
   * First frequency (low→high, Hz) where SPL reaches within `dropDb` of the passband peak.
   */
  rolloffFreq(sw: SweepResult, dropDb: number): number | null {
    const ref = this.passbandRef(sw.spl);
    for (let i = 0; i < sw.fs.length; i++) {
      if (sw.spl[i] >= ref - dropDb) return sw.fs[i];
    }
    return null;
  }

  /** The one enclosure-parameter result: `values` is `P` unchanged when every field the circuit
   *  divides by is a finite positive number;
   *  otherwise `null`, with `issues` naming what is missing (T9 — one solve per component).
   *
   * Deliberately NOT exhaustive over everything that could go non-finite: `Leff`, the loss Q's
   * and the filter chain can each produce a singularity at one frequency without being invalid
   * inputs. Those are the postcondition's job (`classifyFinite`) — this layer only rejects values
   * that break the solve at EVERY frequency, which is the class a precondition can decide from the
   * inputs alone.
   */
  solveBoxParams(box: BoxType, P: EnclosureParams): BoxParamsSolveResult {
    const issues: BoxParamsIssue[] = [];
    for (const p of requiredParamsFor(box)) {
      const v = P[p.field];
      // Finite as well as positive: `Infinity > 0` is true, so a bare `> 0` would admit a
      // value that is itself already the poison this guard exists to stop.
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) continue;
      const route: SolveRoute<BoxParamsQuantityName> = {
        formula: `${p.label} must be greater than zero — ${p.consequence}.`,
        required: [p.field], missing: [p.field],
      };
      issues.push(missingDependencies(p.field, [route]));
    }
    return { values: issues.length === 0 ? P : null, issues };
  }

  sweep(drv: SweepDriver, Le_H: number | undefined, box: BoxType, P: SweepParams): SweepSolveResult {
    const n = P.nDrivers || 1;
    if (winisdCountsDrivers(P)) {
      // WinISD: one driver in Vb/N fed P/N (eg/√N); N of them sum to +20·log10(N) on its SPL and
      // N times its VA (WinISD's VA chart is the array's: 0.968 VA at 1 and 4 drivers, W5 sealed 1 W).
      const one = this.sweep(drv, Le_H, box, oneOfN(P, n));
      if (one.values === null) return one;
      const gain = 20 * Math.log10(n);
      const zScale = arrayImpedanceScale(P, n);
      return { ...one, values: { ...one.values,
        spl: one.values.spl.map((v) => isSilence(v) ? v : v + gain),
        va: one.values.va.map((v) => v * n),
        zmag: one.values.zmag.map((z) => z * zScale) } };
    }
    // Driver-side added mass (docs/research/WINISD_PARITY.md) shifts Mms/Fs/Q's before the circuit sees it.
    // 0/absent → withAddedMass returns the driver unchanged, so goldens are byte-identical.
    const single = withAddedMass(driverValues(drv.values), P.driverAddedMass ?? 0);
    const d = P.loading === 'isobaric' ? isobarikPair(single) : single;
    const circuit = circuitQuantities(d, Le_H, drv.winisdBL_Tm);
    if (circuit.value === null) return { values: null, issues: circuit.issues };
    const cq = circuit.value;
    const env = solveEnvironment(P);
    if (env.issues.length > 0) return { values: null, issues: env.issues };
    const { rho } = env.values;
    const f0 = P.fmin || 10, f1 = P.fmax || 1000, N = P.N || 400, r = 1;
    const fs: number[] = [], H = [], spl = [], exc = [], excPR = [], pv = [], zmag = [], zph = [], phase = [];
    const va: number[] = [];
    // `bandpass6`/`abc`'s own rear-port and (ABC only) intra-port velocities — `null` unless the
    // box actually has that port (`SweepResult.pvRear`/`pvIntra` doc), decided once after the loop
    // from whether `s.UPr`/`s.UPi` came back defined (box is fixed for the whole sweep,
    // so every point agrees).
    const pvRear: number[] = [], pvIntra: number[] = [];
    let hasUPr = false, hasUPi = false;
    // WinISD's "Transfer function magnitude/phase (PR)" — computed for every box (cheap; `s.UP`
    // is the zero complex for a non-PR box), gated to `null` below only `box-passive-radiator`
    // has this chart at all.
    const prSpl: number[] = [], prPhase: number[] = [];
    // WinISD's "Rear port - Gain" (vented) and "Front port - Gain" (bandpass4) — same shape as
    // `prSpl` above (cheap for every box; `UP` is the zero complex where there is no port), one
    // shared array gated to each chart's own `null` below: `UP` is already whichever port this
    // box has (Bandpass4Box.solve returns the FRONT port flow as `UP`; VentedBox returns the
    // REAR port flow), so the identical formula is the identical computation for both charts —
    // never two copies.
    const portGainSpl: number[] = [];
    // bandpass6/abc "Rear port - Gain": the same gain off the REAR port's flow (`s.UPr`).
    const rearGainSpl: number[] = [];
    // Amplifier apparent load power. WinISD's (`winisdVaModel`, the default): P·Re·|Hf|²/|Z + Rg|,
    // Rg added whatever its placement (f_46bd30 case 0x14). Conventional: P·(Re + Rg)·|Hf|²/|Z_amp|,
    // the load the amplifier sees — Zel already holds Rg when Rg is at the driver side.
    const Rg = P.Rs && P.Rs > 0 ? P.Rs : 0;
    const powerIn = driveFromVoltage(P.eg, cq.Re_terminal_ohm, Rg);
    const winisdVa = P.winisdVaModel !== false;
    const vaNumerator = powerIn * (winisdVa ? cq.Re_terminal_ohm : cq.Re_terminal_ohm + Rg);
    const vaRg = winisdVa || P.rgAtDriverSide === false ? Rg : 0;
    // Filter-chain response, sampled on the same grid. Magnitude in dB, phase wrapped for now
    // (unwrapped after the loop, like `phase`).
    const fltMag: number[] = [], fltPhaseWrapped: number[] = [];
    const filterErrors: WinisdFilterErrors = {besselHighpass: P.winisdBesselHighpass === true};
    for (let i = 0; i <= N; i++) {
      const f   = f0 * Math.pow(f1 / f0, i / N);
      const s   = solve(f, cq, box, P);
      const w   = 2 * Math.PI * f;
      // p = ρ·ω·U₀/(2π·r)  https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance
      // Filters are line-level (upstream of amp) — multiply Hc, UD, UP; Zel is unaffected.
      const Hf  = applyFilters(f, P.filters, filterErrors);
      // The chain's own electrical response — the "(EQ/Filter)" charts. Same -200 dB silence
      // sentinel as `spl`, for the pathological |H| = 0 exactly (e.g. a notch landing on a grid
      // point) — `cAbs` never returns a negative number, so testing `=== 0` catches only that
      // case and lets a NaN |H| (a breakdown) pass through for `classifyFinite` to report,
      // instead of being hidden as silence (BUG_20260927_spl-maps-nan-to-silence).
      const fltAbs = cAbs(Hf);
      fltMag.push(fltAbs === 0 ? SILENCE_DB : 20 * Math.log10(fltAbs));
      fltPhaseWrapped.push(cArg(Hf));
      const Hc  = cMul(cScale(cMul(cx(0, w), s.U0), rho / (2 * Math.PI * r)), Hf);
      const UD  = cMul(s.UD, Hf);
      const UP  = cMul(s.UP, Hf);
      const pm  = cAbs(Hc);
      const Sdt = cq.Sd_m2 * (P.nDrivers || 1); // withAddedMass leaves Sd untouched
      const area = box === 'box-passive-radiator' ? P.prSd! : P.Sp!;
      fs.push(f); H.push(Hc);
      // SPL = 20·log10(|p|/P0)  https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
      // -200 dB is the silence sentinel for |p| = 0 exactly — `pm === 0`, not `pm > 0`, so a NaN
      // pressure (a breakdown) passes through for `classifyFinite` to report instead of being
      // drawn as silence (BUG_20260927_spl-maps-nan-to-silence).
      spl.push(pm === 0 ? SILENCE_DB : 20 * Math.log10(pm / P0));
      phase.push(cArg(Hc));
      // The radiator's OWN pressure, jω·Upr, on the same 0 dB reference as `Hc` above — but,
      // unlike `Hc`, NOT multiplied by `Hf` (winisd_research/GHIDRA_FINDINGS.md "Passive
      // radiator box", "Radiator transfer function" bullet). `s.UP` here is the raw box-solve
      // output, before the loop's own filtered `UP` local shadows it.
      const Hpr = cScale(cMul(cx(0, w), s.UP), rho / (2 * Math.PI * r));
      const prPm = cAbs(Hpr);
      prSpl.push(prPm === 0 ? SILENCE_DB : 20 * Math.log10(prPm / P0));
      // WinISD's own wart, reproduced exactly (validated against winisd_research
      // runs/pr-w5-tf-1/-2 to <5e-13°): both PR charts come off Z = K·ω·Upr with ω taken as a
      // REAL scalar, not the complex jω·Upr the box solve actually produces. |Z| = |K·ω·Upr| =
      // |jω·Upr| — same as the magnitude chart above, since |j| = 1 — but arg(Z) = arg(Upr):
      // multiplying by the real, positive K·ω rotates nothing, so WinISD's phase chart omits
      // the j entirely rather than dropping a rotation from a complex product.
      prPhase.push(cArg(s.UP));
      // WinISD's "Rear port - Gain" (vented, Z = K·ω·Up·Hf, ω real — no j) and "Front port -
      // Gain" (bandpass4, Z = K·jω·Up·Hf — j kept): same K as the PR transfer charts above, and
      // `Up` here is the FILTERED `UP` local (with `Hf` already multiplied in, unlike `Hpr`
      // above). Both charts plot magnitude only, so the real-vs-jω distinction never shows:
      // |jω| = ω for real ω > 0 — one computation, `portGainSpl`, feeds both.
      const Hgain = cScale(cMul(cx(0, w), UP), rho / (2 * Math.PI * r));
      const gainPm = cAbs(Hgain);
      portGainSpl.push(gainPm === 0 ? SILENCE_DB : 20 * Math.log10(gainPm / P0));
      // x_peak = √2·|UD|/(ω·Sd)  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
      exc.push(Math.SQRT2 * cAbs(UD) / (w * Sdt) * 1000);
      pv.push(area ? Math.SQRT2 * cAbs(UP) / area : 0);
      // Rear-port (`bandpass6`/`abc`) and ABC intra-port velocities — same filtered-flow/area
      // convention as `pv` above, off `Spr`/`SpIntra` respectively. `s.UPr`/`s.UPi` are undefined
      // wherever `Solution`'s own doc says so; `hasUPr`/`hasUPi` remember that once, after the loop.
      if (s.UPr !== undefined) {
        hasUPr = true;
        const UPrF = cMul(s.UPr, Hf);
        pvRear.push(P.Spr ? Math.SQRT2 * cAbs(UPrF) / P.Spr : 0);
        const rearPm = cAbs(cScale(cMul(cx(0, w), UPrF), rho / (2 * Math.PI * r)));
        rearGainSpl.push(rearPm === 0 ? SILENCE_DB : 20 * Math.log10(rearPm / P0));
      } else {
        pvRear.push(0);
        rearGainSpl.push(SILENCE_DB);
      }
      if (s.UPi !== undefined) {
        hasUPi = true;
        const UPiF = cMul(s.UPi, Hf);
        pvIntra.push(P.SpIntra ? Math.SQRT2 * cAbs(UPiF) / P.SpIntra : 0);
      } else {
        pvIntra.push(0);
      }
      // UP is total volume velocity from all PRs; divide by prNum for per-PR excursion
      excPR.push(box === 'box-passive-radiator' ? Math.SQRT2 * cAbs(UP) / (w * P.prSd! * (P.prNum || 1)) * 1000 : 0);
      zmag.push(cAbs(s.Zel));
      va.push(vaNumerator * fltAbs * fltAbs / cAbs(cx(s.Zel.re + vaRg, s.Zel.im)));
      zph.push(cArg(s.Zel) * 180 / Math.PI);
    }
    const winisdWrap = P.winisdWrapPhase === true;
    const ph = winisdWrap ? phase : unwrap(phase);
    const prPh = winisdWrap ? prPhase : unwrap(prPhase);
    const fltPhase = winisdWrap ? fltPhaseWrapped : unwrap(fltPhaseWrapped);
    // Radiated pressure up to a real scale factor, which the phase slope does not see.
    const pressure = (f: number): Complex =>
      cMul(cMul(cx(0, 2 * Math.PI * f), solve(f, cq, box, P).U0), applyFilters(f, P.filters, filterErrors));
    const filterChain = (f: number): Complex => applyFilters(f, P.filters, filterErrors);
    // WinISD's ABC group delay (winisd_research GHIDRA_FINDINGS.md "Group delay of the 6th-order
    // bandpass and ABC"): the box at the stepped f', the driver part and jω held at the chart f.
    const winisdAbcGd = box === 'abc' && P.winisdAbcGroupDelay === true;
    const pressureDriverAt = (fd: number) => (f: number): Complex =>
      cMul(cMul(cx(0, 2 * Math.PI * fd), solve(f, cq, box, P, fd).U0), applyFilters(f, P.filters, filterErrors));
    const gd = fs.map(f => groupDelayAtMs(winisdAbcGd ? pressureDriverAt(f) : pressure, f));
    const fltGd = fs.map(f => groupDelayAtMs(filterChain, f));

    // Force flat response (WinISD Advanced) — the inverse filter that lifts every point to the
    // passband reference, applied as a REAL line-level gain: SPL flattens and the excursion /
    // port-velocity / max-SPL curves show what that costs. Real gain ⇒ phase and group delay
    // are untouched, and Zel never sees it (the EQ is upstream of the amplifier), exactly as
    // applyFilters treats the filter chain.
    // Transfer-function 0 dB: the lossless circuit's own HF asymptote (BUG_20260926_winisd-tf-reference).
    const splRefLimit = 20 * Math.log10(hfAsymptotePressure_Pa(cq, P, r) / P0);
    let flatClamped: number | null = null;
    if (P.forceFlatResponse) {
      // WinISD: every point to the TF's 0 dB, cut as well as boosted, no ceiling
      // (runs/sealed-w5-flatresponse; bugs/archive/BUG_20260928_force-flat-response-not-winisd.md).
      const winisd   = P.winisdFlatModel !== false;
      const ref      = winisd ? splRefLimit : this.passbandRef(spl);
      const maxBoost = winisd ? Infinity : P.flatMaxBoostDb ?? FLAT_MAX_BOOST_DB;
      for (let i = 0; i < fs.length; i++) {
        if (!Number.isFinite(spl[i]) || isSilence(spl[i])) continue;  // no gain resurrects silence
        const want = ref - spl[i];
        if (want <= 0 && !winisd) continue;
        const gDb = Math.min(want, maxBoost);
        if (want > maxBoost && flatClamped === null) flatClamped = fs[i];
        const a = Math.pow(10, gDb / 20);
        spl[i]  += gDb;
        exc[i]   *= a;
        excPR[i] *= a;
        pv[i]    *= a;
        pvRear[i] *= a; // 0 where there is no rear port, so the gain is a no-op there
        pvIntra[i] *= a; // same, for ABC's intra port
        prSpl[i] += gDb; // the same real upstream gain reaches the radiator branch too
        portGainSpl[i] += gDb; // ...and the vented/bandpass4 port branch, same reasoning
        rearGainSpl[i] += gDb; // ...and the bandpass6/abc rear port
        H[i] = cScale(H[i], a);
      }
    }

    // Xmax-limited SPL (WinISD Advanced) — how loud the design can actually play at each
    // frequency before the cone runs out of linear travel. Computed unconditionally as its
    // OWN curve: `spl` still feeds the transfer-function chart, the F3/F6/F10 read-outs and
    // every compare trace, so it must never be clamped in place.
    const drvXmax_m = drv.values.Xmax_m;
    const Xmax = (drvXmax_m != null && Number.isFinite(drvXmax_m) && drvXmax_m > 0) ? drvXmax_m : null;
    const splXlimCurve: number[] = [], xlimited: boolean[] = [];
    for (let i = 0; i < fs.length; i++) {
      const xPeak = exc[i] / 1000;                                  // exc is mm; Xmax is metres
      const over  = Xmax !== null && Number.isFinite(xPeak) && xPeak > Xmax;
      xlimited.push(over);
      splXlimCurve.push(over ? spl[i] + 20 * Math.log10(Xmax / xPeak) : spl[i]);
    }

    // WinISD has no "Transfer function (PR)" chart for a box with no radiator — null there,
    // never the -200 dB / 0 rad a fake radiator would sweep to.
    const isPr = box === 'box-passive-radiator';
    // Same reasoning: WinISD has no "Rear port - Gain"/"Front port - Gain" chart for a box with
    // no rear/front port.
    const isVented = box === 'vented';
    const isBandpass4 = box === 'bandpass4';
    const hasTwoPorts = box === 'bandpass6' || box === 'abc';

    return { values: { fs, H, spl, phase: ph, exc, excPR, pv, pvRear: hasUPr ? pvRear : null,
                      pvIntra: hasUPi ? pvIntra : null, zmag, zph, gd, tfMag: tfMag(spl, splRefLimit),
                      prTfMag: isPr ? tfMag(prSpl, splRefLimit) : null, prTfPhase: isPr ? prPh : null,
                      rearPortGain: isVented ? tfMag(portGainSpl, splRefLimit) : hasTwoPorts ? tfMag(rearGainSpl, splRefLimit) : null,
                      frontPortGain: isBandpass4 || hasTwoPorts ? tfMag(portGainSpl, splRefLimit) : null,
                      splXlimCurve, xlimited, flatClamped,
                      fltMag, fltPhase, fltGd, va }, issues: [] };
  }

  /**
   * Postcondition: force-flat's boost ceiling bound somewhere, so the "flat" response is not
   * flat below that frequency. Surfaced through the same issue channel as classifyFinite —
   * a silently truncated inverse filter would read as a design that flattens for free.
   * Returns null when force-flat is off or the clamp never bound.
   */
  classifyFlatClamp(sw: SweepResult): DriverError | null {
    if (sw.flatClamped === null) return null;
    const f = sw.flatClamped;
    return {
      level: 'warn',
      field: 'forceFlatResponse',
      message: `Force-flat needs more than the allowed boost below ${f >= 100 ? f.toFixed(0) : f.toFixed(1)} Hz — `
             + 'the response there is still rolled off, not flat.',
    };
  }

  /**
   * Maximum SPL and power curves — sweep at 2.83 V then scale to Xmax and Pe limits.
   * Voltage limit: v_Xmax = 2.83 · (Xmax / x_at_2.83V)
   * Power limit:   v_Pe   = √(Pe · Re)  — Pe is thermal power into Re, per T/S definition.
   *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
   */
  maxCurves(drv: SweepDriver, Le_H: number | undefined, box: BoxType, P: SweepParams): MaxCurvesSolveResult {
    const n = P.nDrivers || 1;
    if (winisdCountsDrivers(P)) {
      // WinISD: N times one driver's limits in Vb/N — max power ×N; max SPL +20·log10(N) (⚠ unverified).
      const one = this.maxCurves(drv, Le_H, box, oneBoxOfN(P, n));
      if (one.values === null) return one;
      const gain = 20 * Math.log10(n);
      return { ...one, values: { ...one.values, maxpwr: one.values.maxpwr.map((v) => v * n), maxspl: one.values.maxspl.map((v) => v + gain) } };
    }
    // The driver in its box alone: WinISD leaves the filter chain out of Maximum SPL and Maximum
    // power (f_46bd30 never multiplies Hf into kinds 7 and 16; winisd_research/runs/
    // filt-chain-sealed-1). BUG_20260927_max-spl-and-max-power-include-the-filter-chain.
    const swept = this.sweep(drv, Le_H, box, Object.assign({}, P, { eg: 2.83, filters: [] }));
    if (swept.values === null) return { values: null, issues: swept.issues, driverPrerequisites: [] };
    const base = swept.values;
    const drvPe_W = drv.values.Pe_W;
    const Pe   = (drvPe_W != null && drvPe_W > 0) ? drvPe_W * (P.nDrivers || 1) : null;
    // The power reference is Re, not Znom — and the TERMINAL Re, because the amplifier drives the
    // coils as they are wired. `sweep` above already succeeded, and its circuit-required-fields
    // check (CIRCUIT_REQUIRED_FIELDS includes Re_terminal_ohm) demands this exact field be a
    // positive finite number before `swept.values` can be non-null — Re cannot be absent here.
    // Power is into Re + Rs, the same load the power → voltage drive solve uses (`driveVoltage`),
    // with Re at the coil's temperature rise as WinISD states it
    // (bugs/archive/BUG_20260928_vc-temperature-drive-uses-hot-re.md).
    const Re = hotRe(drv.values.Re_terminal_ohm!, P.alfaVC ?? 0, P.vcTempRise ?? 0) + (P.Rs != null && P.Rs > 0 ? P.Rs : 0);
    const drvXmax_m = drv.values.Xmax_m;
    const xmaxUsable = drvXmax_m != null && drvXmax_m > 0;
    const maxspl: number[] = [], maxpwr: number[] = [], xlim: boolean[] = [];
    for (let i = 0; i < base.fs.length; i++) {
      const excAt283 = base.exc[i] / 1000;
      const vXmax = (excAt283 > 0 && xmaxUsable) ? 2.83 * (drvXmax_m! / excAt283) : Infinity;
      const vPe   = Pe != null ? Math.sqrt(Pe * Re) : Infinity;
      const vUse  = Math.min(vXmax, vPe);
      maxspl.push(base.spl[i] + 20 * Math.log10(vUse / 2.83));
      maxpwr.push(vUse * vUse / Re);
      xlim.push(vXmax < vPe);
    }
    // Neither limit stated → vUse is Infinity at every point: a correct answer (unbounded), not a
    // gap, so it is never reported through `issues` — only as this advisory (QO143).
    const unbounded = Pe == null && !xmaxUsable;
    const driverPrerequisites: DriverPrerequisite[] = unbounded
      ? [
          { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] },
          { output: 'maxpwr', missing: ['Pe_W', 'Xmax_m'] },
        ]
      : [];
    return { values: { fs: base.fs, maxspl, maxpwr, xlim, peAbsent: Pe == null }, issues: [], driverPrerequisites };
  }

  classifyFinite(sw: SweepResult): DriverError | null {
    // Every array that reaches a chart. The filter-chain trio is included for the same
    // reason as the rest: it is plotted, so a non-finite point in it must not be silent.
    const arrays: readonly PlottedArray[] = [
      { label: 'SPL', values: sw.spl }, { label: 'phase', values: sw.phase },
      { label: 'transfer magnitude', values: sw.tfMag },
      { label: 'cone excursion', values: sw.exc }, { label: 'PR excursion', values: sw.excPR },
      { label: 'port velocity', values: sw.pv }, { label: 'impedance magnitude', values: sw.zmag },
      { label: 'impedance phase', values: sw.zph }, { label: 'group delay', values: sw.gd },
      { label: 'filter magnitude', values: sw.fltMag }, { label: 'filter phase', values: sw.fltPhase },
      { label: 'filter group delay', values: sw.fltGd }, { label: 'amplifier apparent load power', values: sw.va },
      ...prTransferArrays(sw), ...portGainArrays(sw),
    ];
    return classifyArrays(sw.fs, arrays, 'sweep');
  }

  /** Per-output finiteness issues for callers that render only one chart at a time. */
  classifyFiniteIssues(sw: SweepResult): DriverError[] {
    const arrays: readonly PlottedArray[] = [
      { label: 'SPL', values: sw.spl }, { label: 'phase', values: sw.phase },
      { label: 'transfer magnitude', values: sw.tfMag },
      { label: 'cone excursion', values: sw.exc }, { label: 'PR excursion', values: sw.excPR },
      { label: 'port velocity', values: sw.pv }, { label: 'impedance magnitude', values: sw.zmag },
      { label: 'impedance phase', values: sw.zph }, { label: 'group delay', values: sw.gd },
      { label: 'filter magnitude', values: sw.fltMag }, { label: 'filter phase', values: sw.fltPhase },
      { label: 'filter group delay', values: sw.fltGd }, { label: 'amplifier apparent load power', values: sw.va },
      ...prTransferArrays(sw), ...portGainArrays(sw),
    ];
    return arrays.flatMap((array): DriverError[] => {
      const bad = array.values.filter(value => !Number.isFinite(value)).length;
      if (bad === 0) return [];
      const field = `sweep:${array.label}`;
      if (bad === array.values.length) {
        return [{ level: 'error', field, message: `Sweep returned no finite values for ${array.label}.` }];
      }
      return [{ level: 'warn', field, message: `Sweep has ${bad} non-finite ${array.label} value${bad === 1 ? '' : 's'}; the chart has a gap.` }];
    });
  }

  /**
   * Postcondition for `maxCurves`, the other engine output that reaches a chart.
   *
   * `classifyFinite` cannot cover it: `MaxCurvesResult` is computed AFTER the sweep it is
   * derived from, and can be non-finite while every sweep array is perfectly finite. The
   * reachable case is a driver with NEITHER `Pe` NOR `Xmax`: `maxCurves` then has no limit
   * to apply, `vUse = min(Infinity, Infinity)`, and `maxspl`/`maxpwr` are `+Infinity` at every
   * frequency. QO143 (2026-09-15): that is a CORRECT answer — nothing limits the curve yet —
   * not a breakdown, so it is deliberately exempted here (`allowPositiveInfinity`) and reported
   * instead as `this.maxCurves()`'s own `driverPrerequisites` advisory, never as this postcondition's
   * error. A genuine breakdown (NaN, or `-Infinity`) is still reported exactly as before.
   */
  classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
    return classifyArrays(mx.fs, [
      { label: 'maximum SPL', values: mx.maxspl },
      { label: 'maximum power', values: mx.maxpwr },
    ], 'maxCurves', { allowPositiveInfinity: true });
  }
}
