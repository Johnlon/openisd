/**
 * A vented box with Ql = Qa = 1e6 and the transmission-line port model off, matched to WinISD's own plotted SPL and
 * impedance. WinISD has one fixed-loss vented form whatever Ql and Qa are (bugs/BUG_20261119_vented-lossless-branch-not-winisd-form.md).
 * Golden data: `../fixtures/winisdVentedTl0LosslessCapture.ts`, logged from the `.wpr` files this test imports
 * (`../winisd/fixtures/vented-w5-tl0-ql1e6-qp{15,100}.wpr`; winisd_research runs/vented-w5-tl0-ql1e6-qp15 and -qp100).
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {WINISD_VENTED_TL0_LOSSLESS_CAPTURE as CAPTURE, type VentedCapturePoint} from '../fixtures/winisdVentedTl0LosslessCapture.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures');
/** OpenISD's fixed-loss form reproduces WinISD to ~3e-14 (RESULT.md); the old lossless branch missed by up to 8.9 %. */
const RELATIVE = 1e-12;

interface Case {
  readonly wpr: string;
  readonly Qp: number;
  readonly points: readonly VentedCapturePoint[];
}

const CASES: readonly Case[] = [
  {wpr: 'vented-w5-tl0-ql1e6-qp15', Qp: 15, points: CAPTURE.qp15},
  {wpr: 'vented-w5-tl0-ql1e6-qp100', Qp: 100, points: CAPTURE.qp100},
];

function loadProject(wpr: string): OpenISDProject {
  const {value: project, errors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(readFileSync(join(FIXTURES, `${wpr}.wpr`), 'utf8'));
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  project.winisdDriverModel.set(true);
  project.winisdChartFromFsVasQms.set(true);
  project.rgAtDriverSide.set(false);
  return project;
}

describe('vented box, Ql = Qa = 1e6, TL port model off, matches WinISD', () => {
  for (const c of CASES) {
    describe(c.wpr, () => {
      const project = loadProject(c.wpr);
      it('takes the 1e6 losses from the .wpr and leaves the TL port model off', () => {
        const losses = project.box.vented.losses;
        assert.deepEqual([losses.Ql.value, losses.Qa.value, losses.Qp.value], [1e6, 1e6, c.Qp]);
        assert.equal(project.useTransmissionLinePortModel.value, false);
      });
      const sw = project.sweep(CAPTURE.grid).values!;
      for (const p of c.points) {
        it(`SPL and impedance at ${p.f.toPrecision(4)} Hz (≤${RELATIVE} relative)`, () => {
          const spl = sw.spl[p.i]!;
          const z = sw.zmag[p.i]!;
          assert.ok(Math.abs(spl - p.spl_dB) <= RELATIVE * Math.abs(p.spl_dB), `SPL @ ${p.f} Hz: got ${spl}, WinISD ${p.spl_dB}`);
          assert.ok(Math.abs(z - p.impedance_ohm) <= RELATIVE * Math.abs(p.impedance_ohm), `impedance @ ${p.f} Hz: got ${z}, WinISD ${p.impedance_ohm}`);
        });
      }
    });
  }
});
