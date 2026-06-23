/* Golden-master regression test.  Run: node test/golden.test.mjs
 * Reads committed fixtures from test/fixtures/golden/*.json and asserts the
 * engine reproduces every number exactly.  Exact === is intentional: the engine
 * is deterministic, JSON round-trips doubles losslessly, so any divergence after
 * a "pure move" is a real behaviour change.  Do not add tolerance. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { engine } from './load-engine.mjs';

const { deriveDriver, sweep, maxCurves } = engine;
const here        = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, 'fixtures', 'golden');

const NAMES = [
  'sealed-single',
  'vented-single',
  'bandpass4-single',
  'pr-single',
  'sealed-2drv-parallel',
  'vented-2drv-series',
];

let fails = 0;
const check = (label, pass, detail = '') => {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  —  ' + detail : ''}`);
  if (!pass) fails++;
};

console.log('\nResonate golden-master tests\n');

for (const name of NAMES) {
  const { design: { driverRaw, box, P }, sweep: expSw, maxCurves: expMx } =
    JSON.parse(readFileSync(join(fixturesDir, name + '.json'), 'utf8'));

  const drv = deriveDriver(driverRaw);
  const sw  = sweep(drv, box, P);
  const mx  = maxCurves(drv, box, P);

  const cmpNum = (label, got, exp) => {
    let pass = Array.isArray(got) && got.length === exp.length;
    if (pass) for (let i = 0; i < exp.length; i++) if (got[i] !== exp[i]) { pass = false; break; }
    check(`${name}  ${label}`, pass);
  };
  const cmpBool = (label, got, exp) => {
    let pass = Array.isArray(got) && got.length === exp.length;
    if (pass) for (let i = 0; i < exp.length; i++) if (got[i] !== exp[i]) { pass = false; break; }
    check(`${name}  ${label}`, pass);
  };

  for (const k of ['fs','spl','phase','exc','excPR','pv','zmag','zph','gd'])
    cmpNum(`sweep.${k}`, sw[k], expSw[k]);
  for (const k of ['maxspl','maxpwr'])
    cmpNum(`maxCurves.${k}`, mx[k], expMx[k]);
  cmpBool('maxCurves.xlim', mx.xlim, expMx.xlim);
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'All checks passed.'}\n`);
process.exit(fails ? 1 : 0);
