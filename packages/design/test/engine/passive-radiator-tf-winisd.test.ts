/**
 * Passive-radiator box: "Transfer function magnitude (PR)" / "Transfer function phase (PR)",
 * matched to WinISD's own logged charts (bugs/archive/BUG_20260927_winisd-charts-missing.md). Golden
 * data: `../fixtures/winisdPassiveRadiatorTfCapture.ts` (`WINISD_PR_TF_CAPTURE`) — WinISD
 * 0.7.0.950's own plotted dB/degrees, logged live by debugger from the SAME `.wpr` this test
 * imports (`../winisd/fixtures/pr-w5-tf-1.wpr`). That project carries a 4-filter chain — the
 * whole point of this chart is that it is NOT run through it.
 *
 * Model under test: `engine/sweep.ts` `prTfMag`/`prTfPhase` — jω·Upr on the `tfMag` reference,
 * no filter chain. Formula: winisd_research/GHIDRA_FINDINGS.md "Passive radiator box —
 * `0x45a960`", "Radiator transfer function" bullet.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_PR_TF_CAPTURE} from '../fixtures/winisdPassiveRadiatorTfCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_PATH = join(here, '..', 'winisd', 'fixtures', 'pr-w5-tf-1.wpr');

/** Smallest signed angle from `b` to `a`, in whatever unit both are already in — handles the
 *  wrap at ±180°/±360° that a plain subtraction gets wrong once in a while. */
function angleDiff(a: number, b: number, fullTurn: number): number {
  let d = (a - b) % fullTurn;
  if (d > fullTurn / 2) d -= fullTurn;
  if (d < -fullTurn / 2) d += fullTurn;
  return d;
}

function setUpProject(): OpenISDProject {
  const engine = createEngine();
  const text = readFileSync(WPR_PATH, 'utf8');
  const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  // WinISD Advanced/Compatibility switches this capture ran under (fixture header comment):
  // VCInd off (circuitModel stays its 'winisd' default — Le excluded), Rg NOT at driver side.
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  return project;
}

describe('passive-radiator box: "Transfer function (PR)" matches WinISD (pr-w5-tf-1/-2)', () => {
  it('matches WinISD\'s magnitude (≤1e-10 dB) — the fixture\'s own frequency grid', () => {
    const project = setUpProject();
    const grid = WINISD_PR_TF_CAPTURE.magnitude;
    const {values: sw, issues} = project.sweep({fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.ok(sw.prTfMag !== null, 'a box-passive-radiator sweep must produce prTfMag');
    let worst = 0;
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const rel = Math.abs(sw.fs[i]! - point.f) / point.f;
      assert.ok(rel <= 1e-12, `point ${i}: f ${sw.fs[i]} vs fixture ${point.f}`);
      const d = Math.abs(sw.prTfMag![i]! - point.dB);
      worst = Math.max(worst, d);
      assert.ok(d <= 1e-10, `${point.f} Hz: prTfMag err ${d.toExponential(3)} dB (got ${sw.prTfMag![i]}, want ${point.dB})`);
    }
  });

  it('matches WinISD\'s phase (≤1e-9 deg) — the fixture\'s own frequency grid', () => {
    const project = setUpProject();
    const grid = WINISD_PR_TF_CAPTURE.phase;
    const {values: sw, issues} = project.sweep({fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.ok(sw.prTfPhase !== null, 'a box-passive-radiator sweep must produce prTfPhase');
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const rel = Math.abs(sw.fs[i]! - point.f) / point.f;
      assert.ok(rel <= 1e-12, `point ${i}: f ${sw.fs[i]} vs fixture ${point.f}`);
      const gotDeg = sw.prTfPhase![i]! * 180 / Math.PI;
      const d = Math.abs(angleDiff(gotDeg, point.deg, 360));
      assert.ok(d <= 1e-9, `${point.f} Hz: prTfPhase err ${d.toExponential(3)} deg (got ${gotDeg}, want ${point.deg})`);
    }
  });

  it('is null for a box with no radiator — WinISD has no such chart there', () => {
    const project = setUpProject();
    project.box.boxType.set('sealed');
    const {values: sw, issues} = project.sweep({fmin: 20, fmax: 20000, N: 100});
    if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));
    assert.equal(sw.prTfMag, null);
    assert.equal(sw.prTfPhase, null);
  });
});
