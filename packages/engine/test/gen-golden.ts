/* Run once to generate golden fixtures.  DO NOT run in CI.
 *   npm run gen-golden   (vite-node — the engine is TypeScript)
 * Commit the resulting test/fixtures/golden/*.json.  Never regenerate during
 * a test run — the test must read the committed snapshot, not overwrite it. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BoxType, SweepParams } from '@openisd/engine';
import { engine } from './load-engine.js';

const { deriveEngineDriver, sweep, maxCurves } = engine;

interface Design { name: string; driverRaw: Record<string, number>; box: BoxType; P: SweepParams }
const here   = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'fixtures', 'golden');
mkdirSync(outDir, { recursive: true });

const BASE_DRIVER = {
  Fs:37, Qts:0.38, Qes:0.40, Qms:7.0, Vas:0.030, Sd:0.0133,
  Re:5.6, Le:0.7e-3, Xmax:0.005, Pe:60, Znom:8,
};

/* The air every golden was produced in, written into each fixture rather than left to the
 * engine's defaults: ρ and c now follow temperature, humidity and pressure (air.ts), so a
 * fixture that did not name its environment would not say what it is a snapshot OF.
 * `ignoreHumidityAndPressure: false` is openisd's default — the physical model, NOT WinISD's
 * frozen constants. The QO8 side-by-side parity suite is the one that runs with it true. */
const ENV = { tempK: 293.15, humidityPct: 30, pressurePa: 101325, ignoreHumidityAndPressure: false };

const DESIGNS: Design[] = [
  {
    name: 'sealed-single',
    driverRaw: BASE_DRIVER,
    box: 'sealed',
    P: { ...ENV, Vb:0.020, Ql:7, eg:2.83, fmin:10, fmax:1000, N:200 },
  },
  {
    name: 'vented-single',
    driverRaw: BASE_DRIVER,
    box: 'vented',
    P: { ...ENV, Vb:0.020, Ql:7, Sp:Math.PI*0.025**2, Leff:0.12, eg:2.83, fmin:10, fmax:1000, N:200 },
  },
  {
    name: 'bandpass4-single',
    driverRaw: BASE_DRIVER,
    box: 'bandpass4',
    P: { ...ENV, Vb:0.015, Vf:0.020, Ql:7, Sp:Math.PI*0.025**2, Leff:0.15, eg:2.83, fmin:10, fmax:1000, N:200 },
  },
  {
    name: 'pr-single',
    driverRaw: BASE_DRIVER,
    box: 'pr',
    P: { ...ENV, Vb:0.020, Ql:7, prSd:0.0133, prMmd:0.030, prMadd:0, prCms:0.0008, prRms:1.0, prXmax:0.012,
         eg:2.83, fmin:10, fmax:1000, N:200 },
  },
  {
    name: 'sealed-2drv-parallel',
    driverRaw: BASE_DRIVER,
    box: 'sealed',
    P: { ...ENV, Vb:0.040, Ql:7, nDrivers:2, wiring:'parallel', eg:2.83, fmin:10, fmax:1000, N:200 },
  },
  {
    name: 'vented-2drv-series',
    driverRaw: BASE_DRIVER,
    box: 'vented',
    P: { ...ENV, Vb:0.040, Ql:7, nDrivers:2, wiring:'series', Sp:Math.PI*0.025**2, Leff:0.12,
         eg:2.83, fmin:10, fmax:1000, N:200 },
  },
];

let ok = true;
console.log('\nGenerating golden fixtures\n');

for (const d of DESIGNS) {
  // deriveEngineDriver returns { value, errors } — unwrap the driver before sweeping.
  const { value: drv, errors } = deriveEngineDriver(d.driverRaw);
  if (!drv) { console.error(`  ERROR  ${d.name}: driver invalid — ${errors.map(e => e.message).join('; ')}`); process.exit(1); }
  const sw  = sweep(drv, d.box, d.P);
  const mx  = maxCurves(drv, d.box, d.P);

  // Guard: JSON silently converts NaN/Infinity to null, corrupting the snapshot.
  const numArrays = [sw.fs, sw.spl, sw.phase, sw.exc, sw.excPR, sw.pv, sw.zmag, sw.zph, sw.gd,
                     mx.maxspl, mx.maxpwr];
  for (const arr of numArrays) {
    for (const v of arr) {
      if (!isFinite(v)) { console.error(`  ERROR  ${d.name}: non-finite value ${v}`); ok = false; }
    }
  }

  const fixture = {
    design: { driverRaw: d.driverRaw, box: d.box, P: d.P },
    sweep: {
      fs: sw.fs, spl: sw.spl, phase: sw.phase,
      exc: sw.exc, excPR: sw.excPR, pv: sw.pv,
      zmag: sw.zmag, zph: sw.zph, gd: sw.gd,
    },
    maxCurves: { maxspl: mx.maxspl, maxpwr: mx.maxpwr, xlim: mx.xlim },
  };

  writeFileSync(join(outDir, d.name + '.json'), JSON.stringify(fixture, null, 2));
  console.log(`  wrote  ${d.name}.json`);
}

if (!ok) { console.error('\nERROR: non-finite values — DO NOT COMMIT these fixtures'); process.exit(1); }
console.log('\nDone. Run `npm test` to confirm green, then commit.\n');
