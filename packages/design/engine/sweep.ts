/**
 * Frequency sweep — converts circuit solutions to observable quantities.
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

import { P0, FLAT_MAX_BOOST_DB } from './constants.js';
import { airFor } from './air.js';
import { cx, cScale, cMul, cAbs, cArg } from './complex.js';
import { solve } from './circuit.js';
import { withAddedMass, solveConsistencyGroup } from './solver.js';
import { referenceEfficiency, splFromEfficiency } from './efficiency.js';
import { applyFilters } from './filters.js';
import type { BoxType, SweepParams, SweepResult, MaxCurvesResult, DriverError, Result } from './types.js';
import { QUANTITY_NAMES } from './solverQuantities.js';
import type { SolverQuantities, QuantityName } from './solverQuantities.js';
import type { CircuitQuantities } from './circuit.js';

/** SPL below this is the "no output" sentinel sweep() writes where |p| = 0, not a real level. */
const SILENCE_DB = -190;

/**
 * The passband reference level of an SPL curve, in dB — the peak of the real curve,
 * ignoring the silence sentinel so a single dead point can't define the reference.
 *
 * ONE definition, shared by everything that needs "0 dB is here": the transfer-function
 * chart's normalisation, the F3/F6/F10 read-outs, and force-flat's EQ target. Returns 0
 * for an all-silent curve (a −200 dB "reference" is not a reference).
 */
export function passbandRef(spl: number[]): number {
  let ref = -Infinity;
  for (const v of spl) if (Number.isFinite(v) && v > SILENCE_DB && v > ref) ref = v;
  return ref === -Infinity ? 0 : ref;
}

/**
 * The high-frequency passband reference level of an SPL curve, in dB — the level at the top end
 * of the sweep grid (asymptote), matching WinISD's Transfer Function Magnitude reference level.
 */
export function hfPassbandRef(spl: number[]): number {
  if (spl.length > 0 && Number.isFinite(spl[spl.length - 1]) && spl[spl.length - 1] > SILENCE_DB) {
    return spl[spl.length - 1];
  }
  return passbandRef(spl);
}

/**
 * Transfer Function Magnitude in dB relative to the high-frequency passband asymptote (0 dB).
 */
export function tfMag(spl: number[], ref?: number): number[] {
  const r = ref ?? hfPassbandRef(spl);
  return spl.map(v => (Number.isFinite(v) && v > SILENCE_DB) ? v - r : v);
}

/**
 * First frequency (low→high, Hz) where SPL reaches within `dropDb` of the passband peak.
 */
export function rolloffFreq(sw: SweepResult, dropDb: number): number | null {
  const ref = passbandRef(sw.spl);
  for (let i = 0; i < sw.fs.length; i++) {
    if (sw.spl[i] >= ref - dropDb) return sw.fs[i];
  }
  return null;
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

/**
 * Group delay in ms from an UNWRAPPED phase array (radians) on grid `fs` (Hz).
 *
 * τg = −dφ/dω, by central difference on the log-spaced grid.
 *   https://en.wikipedia.org/wiki/Group_delay_and_phase_delay
 *
 * ONE definition, shared by the system group delay (`gd`) and the filter-chain group
 * delay (`fltGd`) — the two charts must not be able to disagree about what τg means.
 */
export function groupDelayMs(fs: number[], phaseUnwrapped: number[]): number[] {
  const gd: number[] = [];
  for (let i = 0; i < fs.length; i++) {
    const a = Math.max(0, i - 1), b = Math.min(fs.length - 1, i + 1);
    const dw = 2 * Math.PI * (fs[b] - fs[a]);
    const tau = dw !== 0 ? -(phaseUnwrapped[b] - phaseUnwrapped[a]) / dw * 1000 : 0;
    // A flat phase gives `-(0)`, which is NEGATIVE zero. There is no such delay, and
    // `Object.is` — hence `assert.strict.equal` and any `1 / τ` — treats it as its own value.
    gd.push(tau === 0 ? 0 : tau);
  }
  return gd;
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
function usableQuantity(v: number | undefined): v is number {
  return v != null && Number.isFinite(v) && v > 0;
}

/**
 * A physically plausible value for a quantity, used ONLY to ask "would stating this one let the
 * sweep run?" — never in a result. A `switch` rather than a table, per packages/design/AGENTS.md.
 *
 * The magnitudes are a mid-range 6.5" mid-woofer's. They matter only in that they are positive
 * and finite, which is what the solver's own `setVal` requires before it will write a derived
 * field; the ANSWER this produces is structural — which relations can close — not numeric.
 */
function plausibleValue(name: QuantityName): number {
  switch (name) {
    case 'Fs_hz': return 37;            case 'Re_ohm': return 5.6;
    case 'Znom_ohm': return 8;          case 'Qes': return 0.40;
    case 'Qms': return 7.0;             case 'Qts': return 0.38;
    case 'Vas_m3': return 0.030;        case 'Sd_m2': return 0.0133;
    case 'Dd_m': return 0.13;           case 'BL_Tm': return 8.87;
    case 'Re_terminal_ohm': return 5.6; case 'BL_terminal_Tm': return 8.87;
    case 'Mms_kg': return 0.0234;       case 'Cms_m_per_N': return 7.4e-4;
    case 'Rms_kg_per_s': return 0.80;   case 'EBP_hz': return 92;
    case 'Xmax_m': return 0.005;        case 'Vd_m3': return 6.65e-5;
    case 'Hc_m': return 0.012;          case 'Hg_m': return 0.006;
    case 'Pe_W': return 60;             case 'no': return 0.0035;
    case 'SPLref_dB': return 88;        case 'SPL_dB': return 88;
    case 'USPL_dB': return 89;          case 'SPLmax_dB': return 105;
    case 'SPLmaxLF_dB': return 95;      case 'Rme_kg_per_s': return 14;
    case 'Mpow_N_per_sqrtW': return 3.7; case 'Mcost_kg_per_s': return 20;
    case 'gamma_m_per_s2_A': return 379; case 'Gloss': return 0.02;
    case 'Vcd_m': return 0.038;         case 'Depth_m': return 0.075;
    case 'MagDepth_m': return 0.020;    case 'Magnet_m': return 0.090;
    case 'DVol_m3': return 4.0e-4;      case 'c_m_per_s': return 344;
    case 'roo_kg_per_m3': return 1.2;
    // Voice-coil inductance and its two semi-inductance partners (relation 24). Representative
    // of the corpus, and only ever used as a PROBE — this function asks "would this quantity,
    // stated on its own, let the driver simulate", so the magnitude has to be plausible and
    // nothing more. KLe is Le·√(2π·fLe) at these two, so the three agree with each other.
    case 'Le_H': return 5.0e-4;         case 'fLe_hz': return 1000;
    case 'KLe_H_sqrtHz': return 5.0e-4 * Math.sqrt(2 * Math.PI * 1000);
  }
  const unhandled: never = name;
  return unhandled;
}

/**
 * Every quantity that, stated ON ITS OWN, would let this driver simulate.
 *
 * Asked by handing each candidate to the REAL solver and re-testing the circuit's six, so the
 * answer can never disagree with what the engine actually does and no second copy of the
 * relation table exists. A driver missing only `Vas` gets back
 * `Vas, Cms, Mms, Rms, BL, no, SPL` — seven ways to unblock it, all of them true.
 *
 * Empty means no single field is enough: more than one thing is missing.
 */
function singleFieldUnblockers(q: SolverQuantities): (QuantityName)[] {
  const out: (QuantityName)[] = [];
  for (const name of QUANTITY_NAMES) {
    // A terminal value cannot be STATED — it is derived from the per-coil value and the wiring —
    // so offering it as a way to unblock the sweep would be advice a user cannot act on.
    if (name === 'Re_terminal_ohm' || name === 'BL_terminal_Tm') continue;
    if (q[name] !== undefined) continue;
    const solved = solveConsistencyGroup(
      Object.assign({}, q, { [name]: plausibleValue(name) }));
    if (usableQuantity(solved.Sd_m2) && usableQuantity(solved.Re_terminal_ohm) && usableQuantity(solved.BL_terminal_Tm)
        && usableQuantity(solved.Cms_m_per_N) && usableQuantity(solved.Mms_kg)
        && usableQuantity(solved.Rms_kg_per_s)) out.push(name);
  }
  return out;
}

function circuitQuantities(q: SolverQuantities, Le_H: number | undefined): Result<CircuitQuantities> {
  const bad: string[] = [];
  const errors: DriverError[] = [];
  // Returns the VALUE, not a verdict: a boolean stored in a const narrows nothing, so the object
  // built below would still see `number | undefined`. Handing back the number lets one
  // `=== undefined` check per name do the narrowing, with no assertion anywhere.
  const need = (field: QuantityName, v: number | undefined): number | undefined => {
    if (v == null) { bad.push(field); return undefined; }
    if (!Number.isFinite(v) || v <= 0) {
      // A stated-but-impossible value is its own fault and its own message: naming an
      // alternative field would be wrong, because nothing is missing.
      errors.push({ level: 'error', field, message: `${field} is ${v}, which is not a physical value.` });
      return undefined;
    }
    return v;
  };
  // Every check runs before the bail-out, so nothing is reported one field at a time.
  const Sd_m2 = need('Sd_m2', q.Sd_m2);
  const Re_terminal_ohm = need('Re_terminal_ohm', q.Re_terminal_ohm);
  const BL_terminal_Tm = need('BL_terminal_Tm', q.BL_terminal_Tm);
  const Cms_m_per_N = need('Cms_m_per_N', q.Cms_m_per_N);
  const Mms_kg = need('Mms_kg', q.Mms_kg);
  const Rms_kg_per_s = need('Rms_kg_per_s', q.Rms_kg_per_s);
  if (Sd_m2 === undefined || Re_terminal_ohm === undefined || BL_terminal_Tm === undefined
      || Cms_m_per_N === undefined || Mms_kg === undefined || Rms_kg_per_s === undefined) {
    const first = bad[0];
    if (first !== undefined) {
      // The six above are what the CIRCUIT reads, and four of them are ordinarily derived — a
      // datasheet prints none of `Cms`, `Mms`, `Rms`, `BL`. Naming them tells the reader to
      // enter numbers they do not have. What they can act on is a field that, stated on its own,
      // would close the gap — so that is what the message carries.
      const options = singleFieldUnblockers(q);
      errors.push({
        level: 'error',
        field: first,
        message: options.length
          ? `This driver cannot be simulated yet. State any ONE of: ${options.join(', ')}.`
          : 'This driver cannot be simulated: more than one parameter is missing, and no single '
            + 'value completes it.',
      });
    }
    return { value: null, errors };
  }
  return {
    value: {
      Sd_m2, Re_terminal_ohm, BL_terminal_Tm, Cms_m_per_N, Mms_kg, Rms_kg_per_s, Le_H,
    },
    errors,
  };
}

export function sweep(drv: SolverQuantities, Le_H: number | undefined, box: BoxType, P: SweepParams): Result<SweepResult> {
  // Driver-side added mass (docs/research/WINISD_PARITY.md) shifts Mms/Fs/Q's before the circuit sees it.
  // 0/absent → withAddedMass returns the driver unchanged, so goldens are byte-identical.
  const d = withAddedMass(drv, P.driverAddedMass ?? 0);
  const circuit = circuitQuantities(d, Le_H);
  if (circuit.value === null) return { value: null, errors: circuit.errors };
  const cq = circuit.value;
  const { rho, c } = airFor(P);
  const f0 = P.fmin || 10, f1 = P.fmax || 1000, N = P.N || 400, r = 1;
  const fs: number[] = [], H = [], spl = [], exc = [], excPR = [], pv = [], zmag = [], zph = [], phase = [];
  // Filter-chain response, sampled on the same grid. Magnitude in dB, phase wrapped for now
  // (unwrapped after the loop, like `phase`).
  const fltMag: number[] = [], fltPhaseWrapped: number[] = [];
  for (let i = 0; i <= N; i++) {
    const f   = f0 * Math.pow(f1 / f0, i / N);
    const s   = solve(f, cq, box, P);
    const w   = 2 * Math.PI * f;
    // p = ρ·ω·U₀/(2π·r)  https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance
    // Filters are line-level (upstream of amp) — multiply Hc, UD, UP; Zel is unaffected.
    const Hf  = applyFilters(f, P.filters);
    // The chain's own electrical response — the "(EQ/Filter)" charts. Same -200 dB silence
    // sentinel as `spl`, for the pathological |H| = 0 (e.g. a notch landing on a grid point).
    const fltAbs = cAbs(Hf);
    fltMag.push(fltAbs > 0 ? 20 * Math.log10(fltAbs) : -200);
    fltPhaseWrapped.push(cArg(Hf));
    const Hc  = cMul(cScale(cMul(cx(0, w), s.U0), rho / (2 * Math.PI * r)), Hf);
    const UD  = cMul(s.UD, Hf);
    const UP  = cMul(s.UP, Hf);
    const pm  = cAbs(Hc);
    const Sdt = cq.Sd_m2 * (P.nDrivers || 1); // withAddedMass leaves Sd untouched
    const area = box === 'box-passive-radiator' ? P.prSd! : P.Sp!;
    fs.push(f); H.push(Hc);
    // SPL = 20·log10(|p|/P0)  https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
    spl.push(pm > 0 ? 20 * Math.log10(pm / P0) : -200);
    phase.push(cArg(Hc));
    // x_peak = √2·|UD|/(ω·Sd)  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
    exc.push(Math.SQRT2 * cAbs(UD) / (w * Sdt) * 1000);
    pv.push(area ? Math.SQRT2 * cAbs(UP) / area : 0);
    // UP is total volume velocity from all PRs; divide by prNum for per-PR excursion
    excPR.push(box === 'box-passive-radiator' ? Math.SQRT2 * cAbs(UP) / (w * P.prSd! * (P.prNum || 1)) * 1000 : 0);
    zmag.push(cAbs(s.Zel));
    zph.push(cArg(s.Zel) * 180 / Math.PI);
  }
  const ph = unwrap(phase);
  const gd = groupDelayMs(fs, ph);
  const fltPhase = unwrap(fltPhaseWrapped);
  const fltGd = groupDelayMs(fs, fltPhase);

  // Force flat response (WinISD Advanced) — the inverse filter that lifts every point to the
  // passband reference, applied as a REAL line-level gain: SPL flattens and the excursion /
  // port-velocity / max-SPL curves show what that costs. Real gain ⇒ phase and group delay
  // are untouched, and Zel never sees it (the EQ is upstream of the amplifier), exactly as
  // applyFilters treats the filter chain.
  let flatClamped: number | null = null;
  if (P.forceFlatResponse) {
    const ref      = passbandRef(spl);
    const maxBoost = P.flatMaxBoostDb ?? FLAT_MAX_BOOST_DB;
    for (let i = 0; i < fs.length; i++) {
      if (!Number.isFinite(spl[i]) || spl[i] <= SILENCE_DB) continue;  // no gain resurrects silence
      const want = ref - spl[i];
      if (want <= 0) continue;
      const gDb = Math.min(want, maxBoost);
      if (want > maxBoost && flatClamped === null) flatClamped = fs[i];
      const a = Math.pow(10, gDb / 20);
      spl[i]  += gDb;
      exc[i]   *= a;
      excPR[i] *= a;
      pv[i]    *= a;
      H[i] = cScale(H[i], a);
    }
  }

  // Xmax-limited SPL (WinISD Advanced) — how loud the design can actually play at each
  // frequency before the cone runs out of linear travel. Computed unconditionally as its
  // OWN curve: `spl` still feeds the transfer-function chart, the F3/F6/F10 read-outs and
  // every compare trace, so it must never be clamped in place.
  const Xmax = (drv.Xmax_m != null && Number.isFinite(drv.Xmax_m) && drv.Xmax_m > 0) ? drv.Xmax_m : null;
  const splXlim: number[] = [], xlimited: boolean[] = [];
  for (let i = 0; i < fs.length; i++) {
    const xPeak = exc[i] / 1000;                                  // exc is mm; Xmax is metres
    const over  = Xmax !== null && Number.isFinite(xPeak) && xPeak > Xmax;
    xlimited.push(over);
    splXlim.push(over ? spl[i] + 20 * Math.log10(Xmax / xPeak) : spl[i]);
  }

  // Reference SPL limit from first principles (high-frequency asymptote)
  let splRefLimit: number | undefined = undefined;
  if (d.Fs_hz != null && d.Vas_m3 != null && d.Qes != null
      && d.Fs_hz > 0 && d.Vas_m3 > 0 && d.Qes > 0 && cq.Re_terminal_ohm > 0 && P.eg > 0) {
    const np = (P.wiring || 'parallel') === 'parallel' ? (P.nDrivers || 1) : 1;
    // η₀ and the SPL constant come from the ONE implementation (efficiency.ts), evaluated at
    // the ρ and c this sweep is actually running on — the eg²/Re and n² terms are this
    // caller's own drive conditions, not part of the reference formula.
    const eta0 = referenceEfficiency(d.Fs_hz, d.Vas_m3, d.Qes, c);
    splRefLimit = splFromEfficiency(eta0, rho, c)
                + 10 * Math.log10(P.eg * P.eg / cq.Re_terminal_ohm)
                + 20 * Math.log10(np);
  }

  return { value: { fs, H, spl, phase: ph, exc, excPR, pv, zmag, zph, gd, tfMag: tfMag(spl, splRefLimit), splXlim, xlimited, flatClamped,
                    fltMag, fltPhase, fltGd }, errors: [] };
}

/**
 * Postcondition: force-flat's boost ceiling bound somewhere, so the "flat" response is not
 * flat below that frequency. Surfaced through the same issue channel as classifyFinite —
 * a silently truncated inverse filter would read as a design that flattens for free.
 * Returns null when force-flat is off or the clamp never bound.
 */
export function classifyFlatClamp(sw: SweepResult): DriverError | null {
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
export function maxCurves(drv: SolverQuantities, Le_H: number | undefined, box: BoxType, P: SweepParams): Result<MaxCurvesResult> {
  const swept = sweep(drv, Le_H, box, Object.assign({}, P, { eg: 2.83 }));
  if (swept.value === null) return { value: null, errors: swept.errors };
  const base = swept.value;
  const Pe   = (drv.Pe_W != null && drv.Pe_W > 0) ? drv.Pe_W * (P.nDrivers || 1) : null;
  // The power reference is Re, not Znom — and the TERMINAL Re, because the amplifier drives the
  // coils as they are wired. `sweep` above already refused a driver without it, so this is a
  // narrowing, not an assumption.
  const Re   = drv.Re_terminal_ohm;
  if (Re === undefined) return { value: null, errors: swept.errors };
  const maxspl: number[] = [], maxpwr: number[] = [], xlim: boolean[] = [];
  for (let i = 0; i < base.fs.length; i++) {
    const excAt283 = base.exc[i] / 1000;
    const vXmax = (excAt283 > 0 && drv.Xmax_m != null && drv.Xmax_m > 0) ? 2.83 * (drv.Xmax_m / excAt283) : Infinity;
    const vPe   = Pe != null ? Math.sqrt(Pe * Re) : Infinity;
    const vUse  = Math.min(vXmax, vPe);
    maxspl.push(base.spl[i] + 20 * Math.log10(vUse / 2.83));
    maxpwr.push(vUse * vUse / Re);
    xlim.push(vXmax < vPe);
  }
  return { value: { fs: base.fs, maxspl, maxpwr, xlim, peAbsent: Pe == null }, errors: [] };
}

/**
 * Postcondition: classify a sweep result's finiteness so a degenerate design is
 * never a silently blank chart. A precondition on inputs can't foresee a
 * frequency-dependent singularity, so this is the belt-and-braces at the exit.
 * Returns a DriverError-shaped issue (the same channel `sweep` itself reports on), or null — see
 * `classifyArrays` below for the three-way rule the two postconditions share.
 */
export function classifyFinite(sw: SweepResult): DriverError | null {
  // Every array that reaches a chart. The filter-chain trio is included for the same
  // reason as the rest: it is plotted, so a non-finite point in it must not be silent.
  const arrays = [sw.spl, sw.phase, sw.exc, sw.excPR, sw.pv, sw.zmag, sw.zph, sw.gd,
                  sw.fltMag, sw.fltPhase, sw.fltGd];
  return classifyArrays(sw.fs, arrays, 'sweep',
    'Simulation produced no usable values — check the box volume and driver parameters.');
}

/**
 * Postcondition for `maxCurves`, the other engine output that reaches a chart.
 *
 * `classifyFinite` cannot cover it: `MaxCurvesResult` is computed AFTER the sweep it is
 * derived from, and can be non-finite while every sweep array is perfectly finite. The
 * reachable case is a driver with NEITHER `Pe` NOR `Xmax`: `maxCurves` then has no limit
 * to apply, `vUse = min(Infinity, Infinity)`, and `maxspl`/`maxpwr` are `Infinity` at
 * every frequency — which propagates into the chart's own `ymax` scaling and takes the
 * axis with it. `maxCurves` reports `peAbsent` when the power line alone is missing; that is a
 * different statement from "these two charts have no drawable value at all".
 */
export function classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
  return classifyArrays(mx.fs, [mx.maxspl, mx.maxpwr], 'maxCurves',
    'Max-SPL and Max-power are undefined at every frequency — with neither a rated power (Pe) '
    + 'nor a peak excursion (Xmax) there is no limit to plot. Set Pe or Xmax on the driver.');
}

/**
 * The shared finiteness rule, so the two postconditions above cannot drift apart.
 * `fs` is the frequency grid the arrays are sampled on; `arrays` are the plotted series.
 *   - null  — every plotted point is finite (sentinels like −200 dB count as finite)
 *   - error — EVERY grid point has at least one non-finite observable: nothing usable
 *   - warn  — otherwise; the curve still draws with a gap, so name the frequency
 */
function classifyArrays(fs: number[], arrays: number[][], field: string,
                        pervasiveMessage: string): DriverError | null {
  const badIdx = new Set<number>();
  for (const arr of arrays)
    for (let i = 0; i < arr.length; i++)
      if (!Number.isFinite(arr[i])) badIdx.add(i);
  if (badIdx.size === 0) return null;

  // Test on the whole grid, not on the headline series alone: `spl` carries a finite
  // −200 dB silence sentinel that would mask a pervasive breakdown (Vb=0 → exc/zmag all
  // NaN but spl=−200), so "the primary series has a finite point" is not enough to call
  // the result usable.
  if (badIdx.size === fs.length) return { level: 'error', field, message: pervasiveMessage };

  // Otherwise an isolated singularity: the curve still draws (the renderer gaps
  // non-finite points); name the affected frequency so the gap isn't a mystery.
  const freqs = [...badIdx].sort((a, b) => a - b).map(i => fs[i]);
  const near = freqs.slice(0, 3).map(f => f >= 100 ? f.toFixed(0) : f.toFixed(1)).join(', ');
  const more = freqs.length > 3 ? ` (+${freqs.length - 3} more)` : '';
  return { level: 'warn', field, message: `Simulation undefined near ${near} Hz${more} — likely a numerical singularity; the curve has a gap there.` };
}
