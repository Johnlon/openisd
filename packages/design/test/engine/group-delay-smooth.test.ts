/**
 * Group delay is smooth at every frequency, for every box type.
 *
 * τg is −dφ/dω by central difference of the response's phase. A step fixed at 1e-10 Hz
 * (WinISD's) divides the response's rounding error by 2π·2e-10: about 3e-4 ms of staircase on
 * every box, and up to 0.16 ms on the 6th-order bandpass above 1.2 kHz, whose H carries
 * ~2e-13 rad of rounding. bugs/BUG_20261005_bp6-group-delay-noise-above-1k.md.
 *
 * Noise measure: |gd[i] − (gd[i−1] + gd[i+1]) / 2| on WinISD's 2086-point log grid. The real
 * curve's own curvature there is below 1e-6 ms above 1.2 kHz.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject, type FrequencyGrid} from '../../domain/index.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');
const GRID: FrequencyGrid = {fmin: 1.0, fmax: 20095.223453196217, N: 2086};
const FROM_HZ = 1200;
const NOISE_MS = 1e-5;

function project(wpr: string): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, wpr), 'utf8'));
  if (value === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  value.winisdDriverModel.set(true);
  value.rgAtDriverSide.set(false);
  return value;
}

describe('group delay above 1.2 kHz has no rounding noise', () => {
  it.each(['bp6-w5-base2.wpr', 'abc-w5-base2.wpr', 'bp4-w5-1.wpr', 'sealed-w5-dtvc20.wpr', 'vented-w5-2.wpr', 'pr-w5-1.wpr'])('%s', wpr => {
    const {values, issues} = project(wpr).sweep(GRID);
    if (values === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    const {fs, gd} = values;
    for (let i = 1; i < gd.length - 1; i++) {
      if (fs[i]! < FROM_HZ) continue;
      const noise = Math.abs(gd[i]! - (gd[i - 1]! + gd[i + 1]!) / 2);
      expect(noise, `${fs[i]} Hz: ${gd[i - 1]}, ${gd[i]}, ${gd[i + 1]} ms`).toBeLessThan(NOISE_MS);
    }
  });
});
