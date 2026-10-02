/**
 * Force flat response, matched to WinISD's own plotted SPL, excursion and transfer function.
 * Golden data: `../fixtures/winisdFlatResponseCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/sealed-w5-flatresponse.wpr`). bugs/archive/BUG_20260928_force-flat-response-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_FLAT_RESPONSE_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdFlatResponseCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-flatresponse.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(WPR_PATH, 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  project.forceFlatResponse.set(true);
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

describe('sealed box with force flat response matches WinISD by default (sealed-w5-flatresponse)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, relative(1e-12)));
  // OpenISD states excursion in mm; the ÷1000 back to m costs ~2e-12 relative.
  it('excursion (≤1e-11 relative)', () => assertMatches('excursion', sw.exc.map((mm) => mm / 1000), CAP.excursion_m, relative(1e-11)));
  // TF passes through 0 dB, where a relative bound means nothing.
  it('transfer function (≤1e-12 dB)', () => assertMatches('transfer function', sw.tfMag, CAP.tfMag_dB, absolute(1e-12)));
});
