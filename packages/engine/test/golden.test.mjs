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

const cmpArray = (label, got, exp) => {
  assert.ok(Array.isArray(got), `${label}: expected an array`);
  assert.equal(got.length, exp.length, `${label}: length ${got.length} !== ${exp.length}`);
  for (let i = 0; i < exp.length; i++)
    assert.equal(got[i], exp[i], `${label}[${i}]: ${got[i]} !== ${exp[i]}`);
};

describe('golden-master — engine reproduces committed fixtures exactly', () => {
  for (const name of NAMES) {
    it(`${name} — sweep + maxCurves are byte-identical to the fixture`, () => {
      const { design: { driverRaw, box, P }, sweep: expSw, maxCurves: expMx } =
        JSON.parse(readFileSync(join(fixturesDir, name + '.json'), 'utf8'));

      const { value: drv, errors } = deriveDriver(driverRaw);
      assert.ok(drv, `${name}: driver failed to derive — ${errors.map(e => e.message).join('; ')}`);
      const sw = sweep(drv, box, P);
      const mx = maxCurves(drv, box, P);

      for (const k of ['fs', 'spl', 'phase', 'exc', 'excPR', 'pv', 'zmag', 'zph', 'gd'])
        cmpArray(`${name} sweep.${k}`, sw[k], expSw[k]);
      for (const k of ['maxspl', 'maxpwr'])
        cmpArray(`${name} maxCurves.${k}`, mx[k], expMx[k]);
      cmpArray(`${name} maxCurves.xlim`, mx.xlim, expMx.xlim);
    });
  }
});
