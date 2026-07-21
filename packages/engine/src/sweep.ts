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

import { RHO, P0 } from './constants.js';
import { cx, cScale, cMul, cAbs, cArg } from './complex.js';
import { solve } from './circuit.js';
import { withAddedMass } from './driver.js';
import { applyFilters } from './filters.js';
import type { Driver, BoxType, SweepParams, SweepResult, MaxCurvesResult, DriverError } from './types.js';

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
export function sweep(drv: Driver, box: BoxType, P: SweepParams): SweepResult {
  // Driver-side added mass (WINISD.md §12c) shifts Mms/Fs/Q's before the circuit sees it.
  // 0/absent → withAddedMass returns the driver unchanged, so goldens are byte-identical.
  const d = withAddedMass(drv, P.driverAddedMass ?? 0);
  const f0 = P.fmin || 10, f1 = P.fmax || 1000, N = P.N || 400, r = 1;
  const fs: number[] = [], H = [], spl = [], exc = [], excPR = [], pv = [], zmag = [], zph = [], gd = [], phase = [];
  for (let i = 0; i <= N; i++) {
    const f   = f0 * Math.pow(f1 / f0, i / N);
    const s   = solve(f, d, box, P);
    const w   = 2 * Math.PI * f;
    // p = ρ·ω·U₀/(2π·r)  https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance
    // Filters are line-level (upstream of amp) — multiply Hc, UD, UP; Zel is unaffected.
    const Hf  = applyFilters(f, P.filters);
    const Hc  = cMul(cScale(cMul(cx(0, w), s.U0), RHO / (2 * Math.PI * r)), Hf);
    const UD  = cMul(s.UD, Hf);
    const UP  = cMul(s.UP, Hf);
    const pm  = cAbs(Hc);
    const Sdt = d.Sd * (P.nDrivers || 1); // d.Sd === drv.Sd (withAddedMass leaves Sd untouched)
    const area = box === 'pr' ? P.prSd! : P.Sp!;
    fs.push(f); H.push(Hc);
    // SPL = 20·log10(|p|/P0)  https://en.wikipedia.org/wiki/Sound_pressure#Sound_pressure_level
    spl.push(pm > 0 ? 20 * Math.log10(pm / P0) : -200);
    phase.push(cArg(Hc));
    // x_peak = √2·|UD|/(ω·Sd)  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
    exc.push(Math.SQRT2 * cAbs(UD) / (w * Sdt) * 1000);
    pv.push(area ? Math.SQRT2 * cAbs(UP) / area : 0);
    // UP is total volume velocity from all PRs; divide by prNum for per-PR excursion
    excPR.push(box === 'pr' ? Math.SQRT2 * cAbs(UP) / (w * P.prSd! * (P.prNum || 1)) * 1000 : 0);
    zmag.push(cAbs(s.Zel));
    zph.push(cArg(s.Zel) * 180 / Math.PI);
  }
  const ph = unwrap(phase);
  for (let i = 0; i < fs.length; i++) {
    const a = Math.max(0, i - 1), b = Math.min(fs.length - 1, i + 1);
    const dw = 2 * Math.PI * (fs[b] - fs[a]);
    // τg = −dφ/dω  https://en.wikipedia.org/wiki/Group_delay_and_phase_delay
    gd.push(dw !== 0 ? -(ph[b] - ph[a]) / dw * 1000 : 0);
  }
  return { fs, H, spl, phase: ph, exc, excPR, pv, zmag, zph, gd };
}

/**
 * Maximum SPL and power curves — sweep at 2.83 V then scale to Xmax and Pe limits.
 * Voltage limit: v_Xmax = 2.83 · (Xmax / x_at_2.83V)
 * Power limit:   v_Pe   = √(Pe · Re)  — Pe is thermal power into Re, per T/S definition.
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
export function maxCurves(drv: Driver, box: BoxType, P: SweepParams): MaxCurvesResult {
  const base = sweep(drv, box, Object.assign({}, P, { eg: 2.83 }));
  const Pe   = (drv.Pe != null && drv.Pe > 0) ? drv.Pe * (P.nDrivers || 1) : null;
  const Re   = drv.Re;                  // T/S power reference is always Re, not Znom
  const maxspl: number[] = [], maxpwr: number[] = [], xlim: boolean[] = [];
  for (let i = 0; i < base.fs.length; i++) {
    const excAt283 = base.exc[i] / 1000;
    const vXmax = (excAt283 > 0 && drv.Xmax! > 0) ? 2.83 * (drv.Xmax! / excAt283) : Infinity;
    const vPe   = Pe != null ? Math.sqrt(Pe * Re) : Infinity;
    const vUse  = Math.min(vXmax, vPe);
    maxspl.push(base.spl[i] + 20 * Math.log10(vUse / 2.83));
    maxpwr.push(vUse * vUse / Re);
    xlim.push(vXmax < vPe);
  }
  return { fs: base.fs, maxspl, maxpwr, xlim, peAbsent: Pe == null };
}

/**
 * Postcondition: classify a sweep result's finiteness so a degenerate design is
 * never a silently blank chart. A precondition on inputs can't foresee a
 * frequency-dependent singularity, so this is the belt-and-braces at the exit.
 * Returns a DriverError-shaped issue (same channel as deriveDriver), or null:
 *   - null  — every plotted point is finite (sentinels like −200 dB count as finite)
 *   - warn  — some points non-finite (isolated singularity); the curve still draws
 *             with a gap, so name the frequency
 *   - error — the primary curve (spl) has no finite point at all: nothing usable
 */
export function classifyFinite(sw: SweepResult): DriverError | null {
  const arrays = [sw.spl, sw.phase, sw.exc, sw.excPR, sw.pv, sw.zmag, sw.zph, sw.gd];
  const badIdx = new Set<number>();
  for (const arr of arrays)
    for (let i = 0; i < arr.length; i++)
      if (!Number.isFinite(arr[i])) badIdx.add(i);
  if (badIdx.size === 0) return null;

  // Every frequency has a non-finite observable → nothing usable to draw. (Test on
  // the whole grid, not on spl alone: spl carries a finite −200 dB silence sentinel
  // that would mask a pervasive breakdown, e.g. Vb=0 → exc/zmag all NaN but spl=−200.)
  if (badIdx.size === sw.fs.length)
    return { level: 'error', field: 'sweep', message: 'Simulation produced no usable values — check the box volume and driver parameters.' };

  // Otherwise an isolated singularity: the curve still draws (the renderer gaps
  // non-finite points); name the affected frequency so the gap isn't a mystery.
  const freqs = [...badIdx].sort((a, b) => a - b).map(i => sw.fs[i]);
  const near = freqs.slice(0, 3).map(f => f >= 100 ? f.toFixed(0) : f.toFixed(1)).join(', ');
  const more = freqs.length > 3 ? ` (+${freqs.length - 3} more)` : '';
  return { level: 'warn', field: 'sweep', message: `Simulation undefined near ${near} Hz${more} — likely a numerical singularity; the curve has a gap there.` };
}
