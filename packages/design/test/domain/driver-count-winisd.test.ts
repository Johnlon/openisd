/**
 * Two drivers, matched to WinISD's own plotted SPL, excursion, impedance, transfer function and maximum power.
 * Golden data: `../fixtures/winisdTwoDriversCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/sealed-w5-nd2.wpr`). bugs/BUG_20260928_driver-count-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_TWO_DRIVERS_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdTwoDriversCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-nd2.wpr');

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
const absolute = (tol: number) => (): number => tol;

describe('sealed box with two drivers matches WinISD by default (sealed-w5-nd2)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;
  const mx = project.maxCurves(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, relative(1e-12)));
  // OpenISD states excursion in mm; the ÷1000 back to m costs ~2e-12 relative.
  it('excursion (≤1e-11 relative)', () => assertMatches('excursion', sw.exc.map((mm) => mm / 1000), CAP.excursion_m, relative(1e-11)));
  it('impedance (≤1e-12 relative)', () => assertMatches('impedance', sw.zmag, CAP.impedance_ohm, relative(1e-12)));
  // TF passes through 0 dB, where a relative bound means nothing.
  it('transfer function (≤1e-12 dB)', () => assertMatches('transfer function', sw.tfMag, CAP.tfMag_dB, absolute(1e-12)));
  it('maximum power (≤1e-12 relative)', () => assertMatches('max power', mx.maxpwr, CAP.maxPower_W, relative(1e-12)));
});
