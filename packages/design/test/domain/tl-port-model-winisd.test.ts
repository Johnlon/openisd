/**
 * Transmission-line port model, matched to WinISD's own plotted SPL, impedance, port velocity and transfer function.
 * Golden data: `../fixtures/winisdTlPortsCapture.ts`, logged from the same `.wpr` this test imports
 * (`../winisd/fixtures/vented-w5-tlports.wpr`). bugs/BUG_20260928_tl-port-model-not-winisd.md.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_TL_PORTS_CAPTURE as CAP, type WinIsdPlottedPoint} from '../fixtures/winisdTlPortsCapture.js';

const WPR_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'vented-w5-tlports.wpr');

function setUpProject(): OpenISDProject {
  const {value: project, errors} = OpenISDProject.fromWprText(readFileSync(WPR_PATH, 'utf8'), createEngine());
  if (project === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  project.useTransmissionLinePortModel.set(true);
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

describe('vented box with transmission-line ports matches WinISD (vented-w5-tlports)', () => {
  const project = setUpProject();
  const sw = project.sweep(CAP.grid).values!;

  it('SPL (≤1e-12 relative)', () => assertMatches('SPL', sw.spl, CAP.spl_dB, relative(1e-12)));
  // The line length is rebuilt from Fb; its last-bit rounding reaches the port flow at ~4e-11
  // (the closed-form fit, toys/w5_tl_port_model_check.py, bottoms out there too).
  it('port velocity (≤1e-10 relative)', () => assertMatches('port velocity', sw.pv, CAP.portVelocity_m_per_s, relative(1e-10)));
  it('impedance (≤1e-12 relative)', () => assertMatches('impedance', sw.zmag, CAP.impedance_ohm, relative(1e-12)));
  // TF passes through 0 dB, where a relative bound means nothing.
  it('transfer function (≤1e-12 dB)', () => assertMatches('transfer function', sw.tfMag, CAP.tfMag_dB, absolute(1e-12)));
});
