/* Golden-master regression test.  Runs under Vitest (npm run test:unit).
 * Reads committed fixtures from test/fixtures/golden/*.json and asserts the
 * engine reproduces every number exactly.  Exact === is intentional: the engine
 * is deterministic, JSON round-trips doubles losslessly, so any divergence after
 * a "pure move" is a real behaviour change.  Do not add tolerance. */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Engine, SolverQuantities } from '../../engine/index.js';
import type { SweepResult, MaxCurvesResult } from '../../engine/index.js';


const here        = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures', 'golden');

const NAMES = [
  'sealed-single',
  'vented-single',
  'bandpass4-single',
  'pr-single',
  'sealed-2drv-parallel',
  'vented-2drv-series',
];

const cmpArray = (label: string, got: unknown, exp: unknown[]) => {
  assert.ok(Array.isArray(got), `${label}: expected an array`);
  assert.equal(got.length, exp.length, `${label}: length ${got.length} !== ${exp.length}`);
  for (let i = 0; i < exp.length; i++)
    assert.equal(got[i], exp[i], `${label}[${i}]: ${got[i]} !== ${exp[i]}`);
};

describe('golden-master — engine reproduces committed fixtures exactly', () => {
  /* ρ and c follow temperature, humidity and pressure (air.ts), and `useWinisdAirModel`
   * switches to WinISD's parity model instead of the physical one — so a fixture that does not
   * name its environment does not say what it is a snapshot OF. Every one must carry all four,
   * explicitly, rather than inheriting whatever the engine's defaults happen to be on the day. */
  for (const name of NAMES) {
    it(`${name} — states the air it was produced in`, () => {
      const { design: { P } } = JSON.parse(readFileSync(join(fixturesDir, name + '.json'), 'utf8'));
      assert.equal(P.tempK, 293.15, `${name}: fixture does not state its temperature`);
      assert.equal(P.humidityPct, 30, `${name}: fixture does not state its relative humidity`);
      assert.equal(P.pressurePa, 101325, `${name}: fixture does not state its air pressure`);
      assert.equal(P.useWinisdAirModel, false,
        `${name}: fixture does not state whether it was produced in openisd's physical air or WinISD's`);
    });
  }

  for (const name of NAMES) {
    it(`${name} — sweep + maxCurves are byte-identical to the fixture`, () => {
      const engine = new Engine();
      const { design: { driverRaw, box, P }, sweep: expSw, maxCurves: expMx } =
        JSON.parse(readFileSync(join(fixturesDir, name + '.json'), 'utf8'));

      // The fixture states the driver in RECORD names (`Fs`, `Vas`, `Cms`); the engine takes
      // unit-suffixed ones. `Le` is not a solver quantity, so it travels to `sweep` separately —
      // and it must come from THIS fixture, not a shared constant, or the impedance curve is
      // computed for a driver the fixture does not describe.
      const q: SolverQuantities = {
        Fs_hz: driverRaw.Fs, Re_ohm: driverRaw.Re, Znom_ohm: driverRaw.Znom,
        Qts: driverRaw.Qts, Qes: driverRaw.Qes, Qms: driverRaw.Qms,
        Vas_m3: driverRaw.Vas, Sd_m2: driverRaw.Sd, Dd_m: driverRaw.Dd,
        BL_Tm: driverRaw.BL, Mms_kg: driverRaw.Mms, Cms_m_per_N: driverRaw.Cms,
        Rms_kg_per_s: driverRaw.Rms, Xmax_m: driverRaw.Xmax, Pe_W: driverRaw.Pe,
      };
      const solved = engine.solveConsistencyGroup(q);
      // The terminal pair is the CALLER's, and it is derived AFTER the solve: `Re_ohm`/`BL_Tm`
      // are themselves derivable, so a fixture stating neither still has both by now. The solver
      // no longer does this, so that a stated per-coil value can never be overwritten.
      const drv = {
        ...solved,
        Re_terminal_ohm: solved.Re_ohm === undefined ? undefined
          : engine.terminalRe_ohm(solved.Re_ohm, solved.numVC, solved.wiring),
        BL_terminal_Tm: solved.BL_Tm === undefined ? undefined
          : engine.terminalBL_Tm(solved.BL_Tm, solved.numVC, solved.wiring),
      };
      const sw = engine.sweep(drv, driverRaw.Le, box, P).value;
      const mx = engine.maxCurves(drv, driverRaw.Le, box, P).value;
      assert.ok(sw && mx, `${name}: the engine refused this fixture`);

      for (const k of ['fs', 'spl', 'phase', 'exc', 'excPR', 'pv', 'zmag', 'zph', 'gd'] as const)
        cmpArray(`${name} sweep.${k}`, sw[k as keyof SweepResult], expSw[k]);
      for (const k of ['maxspl', 'maxpwr'] as const)
        cmpArray(`${name} maxCurves.${k}`, mx[k as keyof MaxCurvesResult], expMx[k]);
      cmpArray(`${name} maxCurves.xlim`, mx.xlim, expMx.xlim);
    });
  }
});
