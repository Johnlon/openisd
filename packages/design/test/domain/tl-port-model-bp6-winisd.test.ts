/**
 * Transmission-line port model in a 6th-order bandpass box, matched to WinISD's own plotted SPL, impedance and transfer function.
 * Golden data: `../fixtures/winisdBp6TlPortsCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/bp6-w5-tlports.wpr`). bugs/BUG_20260929_bp6-abc-tl-ports-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_BP6_TL_PORTS_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdBp6TlPortsCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'bp6-w5-tlports.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(WPR_PATH, 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
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

describe('6th-order bandpass box with transmission-line ports matches WinISD (bp6-w5-tlports)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, relative(1e-12)));
  it('impedance (≤1e-12 relative)', () => assertMatches('impedance', sw.zmag, CAP.impedance_ohm, relative(1e-12)));
  // TF passes through 0 dB, where a relative bound means nothing. Near the line's first
  // resonance (~10.6 kHz) the rebuilt line length's last-bit rounding reaches 1.5e-12 dB.
  it('transfer function (≤1e-11 dB)', () => assertMatches('transfer function', sw.tfMag, CAP.tfMag_dB, absolute(1e-11)));
});
