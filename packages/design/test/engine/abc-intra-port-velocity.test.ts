/**
 * ABC intra-chamber port velocity: the correct flow through the intra port, and WinISD's chart.
 *
 * WinISD divides the rear-node pressure by `jωMai + Zf` for this one chart, dropping Ricl. Its own
 * box load and every other ABC chart use `Zi = Ricl ∥ jωMai`. `winisdAbcIntraPortVelocity` off
 * (the default) divides by `Zi + Zf`; on, it reproduces WinISD's chart.
 * Evidence: bugs/BUG_20261003_winisd-abc-intra-port-velocity-drops-ricl.md.
 *
 * Goes through the engine's door (`engine.simulation.sweep`) with a driver from the test solver.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import type {SweepParams, SweepResult} from '../../engine/index.js';
import {solveConsistencyGroup, sweepDriver} from './testSolver.js';

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

describe('ABC intra-port velocity, winisd-lossy', () => {
  it('switch off: the flow through the intra port builds the front-chamber pressure, |UPi·Zf| = |UP·Rap|', () => {
    const r = sweepWith(false);
    for (let i = 0; i < r.fs.length; i += 10) {
      const {Zf, Rap} = frontChamber(r.fs[i]!);
      const lhs = r.pvIntra![i]! * SP_INTRA * Zf;
      const rhs = r.pv[i]! * SP * Rap;
      expect(Math.abs(lhs - rhs) / rhs, `${r.fs[i]} Hz`).toBeLessThan(1e-9);
    }
  });

  it('absent flag means off', () => {
    expect(sweepWith(undefined).pvIntra).toEqual(sweepWith(false).pvIntra);
  });

  it('switch on differs from off, most at the top of the band where Ricl matters', () => {
    const on = sweepWith(true), off = sweepWith(false);
    const last = on.fs.length - 1;
    expect(Math.abs(20 * Math.log10(on.pvIntra![last]! / off.pvIntra![last]!))).toBeGreaterThan(3);
  });

  it('switch on: the flow no longer builds the front-chamber pressure (Ricl is left out)', () => {
    const r = sweepWith(true);
    const i = r.fs.length - 1;
    const {Zf, Rap} = frontChamber(r.fs[i]!);
    const lhs = r.pvIntra![i]! * SP_INTRA * Zf;
    const rhs = r.pv[i]! * SP * Rap;
    expect(Math.abs(lhs - rhs) / rhs).toBeGreaterThan(0.1);
  });

  it('a very large inter-chamber leak Q: on and off agree to 1e-9', () => {
    const on = sweepWith(true, {Qiclfr: 1e12}).pvIntra!;
    const off = sweepWith(false, {Qiclfr: 1e12}).pvIntra!;
    for (let i = 0; i < on.length; i++) expect(Math.abs(on[i]! - off[i]!) / off[i]!, `point ${i}`).toBeLessThan(1e-9);
  });
});
