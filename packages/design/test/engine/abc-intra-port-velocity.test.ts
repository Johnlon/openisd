/**
 * ABC intra-chamber port velocity: the flow through the intra port's mass, and WinISD's chart.
 *
 * Air speed in the intra port is the current through the port mass `jωMai`; Ricl is the leak around
 * the port. With `Zi = Ricl ∥ jωMai` and V the rear-node pressure, that current is
 *   V / [jωMai + Zf·(1 + jωMai/Ricl)].
 * WinISD's chart is V/(jωMai + Zf): it drops the term Zf·jωMai/Ricl. `winisdAbcIntraPortVelocity`
 * on (the default) reproduces WinISD's chart; off uses the full form.
 * Evidence: winisd_research/PROBE_FINDINGS.md (abc velocity self-consistency) and
 * bugs/archive/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md.
 *
 * Goes through the engine's door (`engine.simulation.sweep`) with a driver from the test solver.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {SweepParams, SweepResult} from '../../engine/index.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';
import type {TestSolverQuantities} from './testSolver.js';

const engine = createEngine();
const LE_H = 0.5e-3;
const {rho: RHO, c: C} = engine.environment.solve({}).values!;

const SP = 0.004, SP_INTRA = 0.002, LEFF_INTRA = 0.12;
const BASE: SweepParams = {
  Vb: 0.02, Vf: 0.015, eg: 2.83, fmin: 20, fmax: 20000, N: 200,
  lossMode: 'winisd-lossy',
  Fr: 42, Ff: 60, Sp: SP, Spr: SP, SpIntra: SP_INTRA, LeffIntra: LEFF_INTRA,
  Qlr: 7, Qar: 30, Qpr: 100, Qiclfr: 20, Qlf: 9, Qaf: 40, Qpf: 15,
};

function sweepWith(flag: boolean | undefined, extra: Partial<SweepParams> = {}): SweepResult {
  const d = solveConsistencyGroup({Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6});
  const P: SweepParams = {...BASE, ...extra, ...(flag === undefined ? {} : {winisdAbcIntraPortVelocity: flag})};
  const r = engine.simulation.sweep(sweepDriver(d), LE_H, 'abc', P).values;
  if (r === null || r.pvIntra === null) throw new Error('no intra-port curve');
  return r;
}

/** The front chamber's impedance and its port branch at `f`, rebuilt from the parameters alone. */
function frontChamber(f: number): {Zf: number; Rap: number} {
  const w = 2 * Math.PI * f;
  const Cabf = BASE.Vf! / (RHO * C * C);
  const wf = 2 * Math.PI * BASE.Ff!;
  const Mapf = 1 / (wf * wf * Cabf);
  const inv = (re: number, im: number) => { const d = re * re + im * im; return {re: re / d, im: -im / d}; };
  const parts = [
    inv(BASE.Qlf! * wf * Mapf, 0),
    inv(wf * Mapf / BASE.Qaf!, -1 / (w * Cabf)),
    inv(wf * Mapf / BASE.Qpf!, w * Mapf),
  ];
  const sum = parts.reduce((s, p) => ({re: s.re + p.re, im: s.im + p.im}), {re: 0, im: 0});
  return {Zf: 1 / Math.hypot(sum.re, sum.im), Rap: Math.hypot(wf * Mapf / BASE.Qpf!, w * Mapf)};
}

const DRIVER = {Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6} satisfies TestSolverQuantities;

/** Ricl and the intra port's mass, rebuilt from the driver and the parameters alone. */
function intraPort(): {Mai: number; Ricl: number} {
  const d = solveConsistencyGroup(DRIVER);
  const Mas = d.Mms_kg! / (DRIVER.Sd_m2 * DRIVER.Sd_m2);
  const ws = 2 * Math.PI * d.Fs_hz!;
  return {Mai: RHO * LEFF_INTRA / SP_INTRA, Ricl: BASE.Qiclfr! * ws * Mas};
}

/** |UPi·Zf·(1 + jωMai/Ricl)| against |UP·Rap|: both are the pressure Vf across the front chamber. */
function identityGap(r: SweepResult, i: number): number {
  const {Mai, Ricl} = intraPort();
  const f = r.fs[i]!;
  const {Zf, Rap} = frontChamber(f);
  const x = 2 * Math.PI * f * Mai / Ricl;
  const lhs = r.pvIntra![i]! * SP_INTRA * Zf * Math.hypot(1, x);
  const rhs = r.pv[i]! * SP * Rap;
  return Math.abs(lhs - rhs) / rhs;
}

/** dB difference of two velocity curves at point `i`. */
const gapDb = (a: SweepResult, b: SweepResult, i: number): number =>
  20 * Math.log10(a.pvIntra![i]! / b.pvIntra![i]!);

describe('ABC intra-port velocity, winisd-lossy', () => {
  it('switch off: the current through the port mass builds the front-chamber pressure, |UPi·Zf·(1+jωMai/Ricl)| = |UP·Rap|', () => {
    const r = sweepWith(false);
    for (let i = 0; i < r.fs.length; i += 10) expect(identityGap(r, i), `${r.fs[i]} Hz`).toBeLessThan(1e-9);
  });

  it('absent flag means on: WinISD\'s chart is the default', () => {
    expect(sweepWith(undefined).pvIntra).toEqual(sweepWith(true).pvIntra);
  });

  it('switch on is WinISD\'s chart: it differs from off by a small dropped term (2.54 dB measured on this box)', () => {
    const on = sweepWith(true), off = sweepWith(false);
    let worst = 0;
    for (let i = 0; i < on.fs.length; i++) worst = Math.max(worst, Math.abs(gapDb(on, off, i)));
    expect(worst).toBeGreaterThan(2.5);
    expect(worst).toBeLessThan(2.6);
  });

  it('switch on does not satisfy the port-mass identity (the dropped term)', () => {
    const on = sweepWith(true);
    let worst = 0;
    for (let i = 0; i < on.fs.length; i++) worst = Math.max(worst, identityGap(on, i));
    expect(worst).toBeGreaterThan(0.01);
  });

  it('a very large inter-chamber leak Q: on and off agree to 1e-9', () => {
    const on = sweepWith(true, {Qiclfr: 1e12}).pvIntra!;
    const off = sweepWith(false, {Qiclfr: 1e12}).pvIntra!;
    for (let i = 0; i < on.length; i++) expect(Math.abs(on[i]! - off[i]!) / off[i]!, `point ${i}`).toBeLessThan(1e-9);
  });
});
