/**
 * Two drivers in a vented box, matched to WinISD's own plotted SPL and maximum power.
 * Golden data: `../fixtures/winisdTwoDriversVentedCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/vented-w5-nd2.wpr`). bugs/BUG_20260928_driver-count-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_TWO_DRIVERS_VENTED_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdTwoDriversVentedCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'vented-w5-nd2.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(WPR_PATH, 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  project.nDrivers.set(2);
  return project;
}

/** `bound(v)`: the largest difference allowed from WinISD's value `v`. */
function assertMatches(name: string, got: readonly number[], want: readonly WinIsdPlottedPoint[], bound: (v: number) => number): void {
  want.forEach((point, k) => {
    const v = got[k * CAP.step]!;
    assert.ok(Math.abs(v - point.v) <= bound(point.v), `${name} @ ${point.f} Hz: got ${v}, WinISD ${point.v}`);
  });
}

const relative = (tol: number) => (v: number): number => tol * Math.abs(v);

describe('vented box with two drivers matches WinISD by default (vented-w5-nd2)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;
  const mx = project.maxCurves(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, relative(1e-12)));
  it('maximum power (≤1e-12 relative)', () => assertMatches('max power', mx.maxpwr, CAP.maxPower_W, relative(1e-12)));
});
