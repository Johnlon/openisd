/**
 * Voice-coil temperature rise, matched to WinISD's own plotted SPL, maximum power and impedance.
 * Golden data: `../fixtures/winisdVcTempRiseCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/sealed-w5-dtvc20.wpr`). bugs/archive/BUG_20260928_vc-temperature-drive-uses-hot-re.md:
 * WinISD drives from the hot Re and plots max power into it.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_VC_TEMP_RISE_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdVcTempRiseCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-dtvc20.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(WPR_PATH, 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  project.vcTempRise_K.set(CAP.vcTempRise_K);
  return project;
}

function assertMatches(name: string, got: readonly number[], want: readonly WinIsdPlottedPoint[], tol: number): void {
  want.forEach((point, k) => {
    const v = got[k * CAP.step]!;
    assert.ok(Math.abs(v - point.v) <= tol, `${name} @ ${point.f} Hz: got ${v}, WinISD ${point.v}`);
  });
}

describe('sealed box with a 20 K voice-coil temperature rise matches WinISD (sealed-w5-dtvc20)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;
  const mx = project.maxCurves(CAP.grid).values!;

  it('impedance (≤1e-12 Ω)', () => assertMatches('impedance', sw.zmag, CAP.impedance_ohm, 1e-12));
  it('SPL (≤1e-12 dB)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, 1e-12));
  it('maximum power (≤1e-12 W)', () => assertMatches('max power', mx.maxpwr, CAP.maxPower_W, 1e-12));
});
