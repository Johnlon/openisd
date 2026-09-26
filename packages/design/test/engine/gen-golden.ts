import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TestSolverQuantities } from './testSolver.js';
import { driverParams, solveConsistencyGroup } from './testSolver.js';
import { Engine } from '../../engine/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures', 'golden');

const NAMES = [
  'sealed-single',
  'vented-single',
  'bandpass4-single',
  'pr-single',
  'sealed-2drv-parallel',
  'vented-2drv-series',
];

const engine = new Engine();

for (const name of NAMES) {
  const filePath = join(fixturesDir, name + '.json');
  const fixture = JSON.parse(readFileSync(filePath, 'utf8'));
  const { design: { driverRaw, box, P } } = fixture;

  const q: TestSolverQuantities = {
    Fs_hz: driverRaw.Fs, Re_ohm: driverRaw.Re, Znom_ohm: driverRaw.Znom,
    Qts: driverRaw.Qts, Qes: driverRaw.Qes, Qms: driverRaw.Qms,
    Vas_m3: driverRaw.Vas, Sd_m2: driverRaw.Sd, Dd_m: driverRaw.Dd,
    BL_Tm: driverRaw.BL, Mms_kg: driverRaw.Mms, Cms_m_per_N: driverRaw.Cms,
    Rms_kg_per_s: driverRaw.Rms, Xmax_m: driverRaw.Xmax, Pe_W: driverRaw.Pe,
  };
  const solved = solveConsistencyGroup(q);
  const drv: TestSolverQuantities = {
    ...solved,
    Re_terminal_ohm: solved.Re_ohm === undefined ? undefined
      : engine.terminalRe_ohm(solved.Re_ohm!, solved.numVC, solved.wiring),
    BL_terminal_Tm: solved.BL_Tm === undefined ? undefined
      : engine.terminalBL_Tm(solved.BL_Tm!, solved.numVC, solved.wiring),
  };
  const sw = engine.sweep(driverParams(drv), driverRaw.Le, box, P).values;
  const mx = engine.maxCurves(driverParams(drv), driverRaw.Le, box, P).values;

  if (!sw || !mx) {
    throw new Error(`Engine refused fixture ${name}`);
  }

  fixture.sweep = sw;
  fixture.maxCurves = mx;

  writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  console.log(`Updated golden fixture: ${name}.json`);
}
