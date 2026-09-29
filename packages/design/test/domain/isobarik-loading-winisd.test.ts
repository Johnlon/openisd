/**
 * Iso-barik loading, matched to WinISD's own plotted SPL, excursion, impedance and transfer function.
 * Golden data: `../fixtures/winisdIsobarikCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/sealed-w5-isobarik.wpr`). bugs/BUG_20260928_isobarik-loading-not-simulated.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_ISOBARIK_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdIsobarikCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-isobarik.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(WPR_PATH, 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  project.loading.set('isobaric');
  return project;
}

function assertMatches(name: string, got: readonly number[], want: readonly WinIsdPlottedPoint[], relTol: number): void {
  want.forEach((point, k) => {
    const v = got[k * CAP.step]!;
    assert.ok(Math.abs(v - point.v) <= relTol * Math.abs(point.v), `${name} @ ${point.f} Hz: got ${v}, WinISD ${point.v}`);
  });
}

describe('sealed box with iso-barik loading matches WinISD (sealed-w5-isobarik)', () => {
  const sw = setUpProject().sweep(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, 1e-12));
  // OpenISD states excursion in mm; the ÷1000 back to m costs ~2e-12 relative.
  it('excursion (≤1e-11 relative)', () => assertMatches('excursion', sw.exc.map((mm) => mm / 1000), CAP.excursion_m, 1e-11));
  it('impedance (≤1e-12 relative)', () => assertMatches('impedance', sw.zmag, CAP.impedance_ohm, 1e-12));
  it('transfer function (≤1e-12 relative)', () => assertMatches('transfer function', sw.tfMag, CAP.tfMag_dB, 1e-12));
});
