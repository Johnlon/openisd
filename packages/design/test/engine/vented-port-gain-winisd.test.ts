/**
 * Vented box: "Rear port - Gain", matched to WinISD's own logged chart
 * (bugs/BUG_20260927_winisd-charts-missing.md). Golden data:
 * `../fixtures/winisdVentedPortGainCapture.ts` (`WINISD_VENTED_PORT_GAIN_CAPTURE`) — WinISD
 * 0.7.0.950's own plotted dB, logged live by debugger from the SAME `.wpr` this test imports
 * (`../winisd/fixtures/vented-gain-1.wpr`). That project carries a 4-filter chain — unlike the
 * PR transfer charts, THIS chart IS run through it.
 *
 * Model under test: `engine/sweep.ts` `rearPortGain` — the port's own pressure (K·ω·Up·Hf, ω
 * real, no j) on the SAME `tfMag` reference as `tfMag`/`prTfMag`. Formula:
 * winisd_research/GHIDRA_FINDINGS.md "Passive radiator box — `0x45a960`", "Rear port gain"
 * bullet (found against this vented capture — the formula is box-agnostic).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_VENTED_PORT_GAIN_CAPTURE} from '../fixtures/winisdVentedPortGainCapture.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_PATH = join(here, '..', 'winisd', 'fixtures', 'vented-gain-1.wpr');

function setUpProject(): OpenISDProject {
  const engine = new Engine();
  const text = readFileSync(WPR_PATH, 'utf8');
  const {value: project, errors} = OpenISDProject.fromWprText(text, engine);
  if (project === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(errors));
  // WinISD Advanced/Compatibility switches this capture ran under (fixture header comment):
  // VCInd off (circuitModel stays its 'winisd' default — Le excluded), Rg AT driver side
  // (WinISD's own default — unlike the PR transfer capture, this one was not toggled).
  project.winisdDriverModel.set(true);
  return project;
}

describe('vented box: "Rear port - Gain" matches WinISD (vented-gain-1)', () => {
  it('matches WinISD\'s magnitude (≤1e-10 dB) — the fixture\'s own frequency grid', () => {
    const project = setUpProject();
    const grid = WINISD_VENTED_PORT_GAIN_CAPTURE.magnitude;
    const {values: sw, issues} = project.sweep({fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.ok(sw.rearPortGain !== null, 'a vented sweep must produce rearPortGain');
    let worst = 0;
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const rel = Math.abs(sw.fs[i]! - point.f) / point.f;
      assert.ok(rel <= 1e-12, `point ${i}: f ${sw.fs[i]} vs fixture ${point.f}`);
      const d = Math.abs(sw.rearPortGain![i]! - point.dB);
      worst = Math.max(worst, d);
      assert.ok(d <= 1e-10, `${point.f} Hz: rearPortGain err ${d.toExponential(3)} dB (got ${sw.rearPortGain![i]}, want ${point.dB})`);
    }
  });

  it('is null for a box with no rear port — WinISD has no such chart there', () => {
    const project = setUpProject();
    project.box.boxType.set('sealed');
    const {values: sw, issues} = project.sweep({fmin: 20, fmax: 20000, N: 100});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.equal(sw.rearPortGain, null);
  });
});
