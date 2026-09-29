/**
 * 4th-order-bandpass box: "Front port - Gain", matched to WinISD's own logged chart
 * (bugs/BUG_20260927_winisd-charts-missing.md). Golden data:
 * `../fixtures/winisdBp4PortGainCapture.ts` (`WINISD_BP4_PORT_GAIN_CAPTURE`) — WinISD
 * 0.7.0.950's own plotted dB, logged live by debugger from the SAME `.wpr` this test imports
 * (`../winisd/fixtures/bp4-w5-chain-1.wpr`). That project carries a 4-filter chain — same as
 * the vented sibling (vented-port-gain-winisd.test.ts), THIS chart IS run through it.
 *
 * Model under test: `engine/sweep.ts` `frontPortGain` — the front port's own pressure
 * (K·jω·Up·Hf) on the SAME `tfMag` reference as `tfMag`/`prTfMag`/`rearPortGain`. Formula:
 * winisd_research/GHIDRA_FINDINGS.md "4th-order bandpass — `0x457a30`", "Front port gain"
 * bullet — the j is kept there (unlike the vented sibling's kind 11), but the chart plots
 * magnitude only, so |jω·Up·Hf| = |ω·Up·Hf|: the same computation as `rearPortGain` reused,
 * never a second copy.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_BP4_PORT_GAIN_CAPTURE} from '../fixtures/winisdBp4PortGainCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_PATH = join(here, '..', 'winisd', 'fixtures', 'bp4-w5-chain-1.wpr');

function setUpProject(): OpenISDProject {
  const engine = createEngine();
  const text = readFileSync(WPR_PATH, 'utf8');
  const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  // WinISD Advanced/Compatibility switches this capture ran under (fixture header comment):
  // VCInd off (circuitModel stays its 'winisd' default — Le excluded), Rg AT driver side
  // (WinISD's own default — not toggled for this capture).
  project.winisdDriverModel.set(true);
  return project;
}

describe('4th-order-bandpass box: "Front port - Gain" matches WinISD (bp4-w5-chain-1)', () => {
  it('matches WinISD\'s magnitude (≤1e-10 dB) — the fixture\'s own frequency grid', () => {
    const project = setUpProject();
    const grid = WINISD_BP4_PORT_GAIN_CAPTURE.magnitude;
    const {values: sw, issues} = project.sweep({fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.ok(sw.frontPortGain !== null, 'a bandpass4 sweep must produce frontPortGain');
    let worst = 0;
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const rel = Math.abs(sw.fs[i]! - point.f) / point.f;
      assert.ok(rel <= 1e-12, `point ${i}: f ${sw.fs[i]} vs fixture ${point.f}`);
      const d = Math.abs(sw.frontPortGain![i]! - point.dB);
      worst = Math.max(worst, d);
      assert.ok(d <= 1e-10, `${point.f} Hz: frontPortGain err ${d.toExponential(3)} dB (got ${sw.frontPortGain![i]}, want ${point.dB})`);
    }
  });

  it('is null for a box with no front port — WinISD has no such chart there', () => {
    const project = setUpProject();
    project.box.boxType.set('sealed');
    const {values: sw, issues} = project.sweep({fmin: 20, fmax: 20000, N: 100});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.equal(sw.frontPortGain, null);
  });
});
