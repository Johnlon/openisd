/**
 * 4th-order bandpass box, matched to WinISD's own logged charts
 * (bugs/BUG_20260927_bandpass4-box-not-winisd-form.md). Golden data:
 * `../fixtures/winisdBandpass4Capture.ts` (`WINISD_BANDPASS4_CAPTURE`) — WinISD 0.7.0.950's
 * impedance/transfer-function/front-port-velocity, logged live by debugger from the SAME
 * `.wpr` this test imports (`../winisd/fixtures/bp4-w5-1.wpr`).
 *
 * Model under test: `engine/boxes/Bandpass4Box.ts`, `lossMode: 'winisd-lossy'`.
 * Formula: winisd_research/GHIDRA_FINDINGS.md "4th-order bandpass — `0x457a30`".
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_BANDPASS4_CAPTURE} from '../fixtures/winisdBandpass4Capture.js';
import type {WinIsdComplexPoint} from '../fixtures/winisdVentedCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_PATH = join(here, '..', 'winisd', 'fixtures', 'bp4-w5-1.wpr');

/** Smallest signed angle from `b` to `a`, in whatever unit both are already in — handles the
 *  wrap at ±180°/±π that a plain subtraction gets wrong once in a while. */
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

describe('bandpass4 box, winisd-lossy: import gives the fixture\'s own numbers', () => {
  it('Vr, Vf, Ff, rear/front losses, vent diameter and Rs land as WinISD stated them', () => {
    const project = setUpProject();
    const rear = project.box.bandpass4.chambers.rear;
    const front = project.box.bandpass4.chambers.front;
    assert.equal(rear.volume_m3.value, 0.01);
    assert.equal(front.volume_m3.value, 0.005);
    assert.equal(front.tuning_goal_hz.value, 60);
    assert.equal(rear.losses.Ql.value, 7);
    assert.equal(rear.losses.Qa.value, 30);
    assert.equal(rear.losses.Qicl.value, 20);
    assert.equal(front.losses.Ql.value, 9);
    assert.equal(front.losses.Qa.value, 40);
    assert.equal(front.losses.Qp.value, 15);
    assert.equal(project.box.bandpass4.vents.front.diameter_m.value, 0.05);
    assert.equal(project.Rs_ohm.value, 0.1);
  });
});

describe('bandpass4 box, winisd-lossy: matches WinISD\'s own charts (bp4-w5-1)', () => {
  const project = setUpProject();
  const grid = WINISD_BANDPASS4_CAPTURE.impedance;
  const {values: sw, issues} = project.sweep({
    fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1,
  });
  if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));

  it('the swept grid lands on exactly the fixture\'s own frequencies', () => {
    assert.equal(sw.fs.length, grid.length);
    for (let i = 0; i < grid.length; i++) {
      const rel = Math.abs(sw.fs[i]! - grid[i]!.f) / grid[i]!.f;
      assert.ok(rel <= 1e-12, `point ${i}: f ${sw.fs[i]} vs fixture ${grid[i]!.f}`);
    }
  });

  it('impedance |Z| and phase match WinISD (≤1e-12 relative, ≤1e-10 deg)', () => {
    let worstMag = 0, worstPhase = 0;
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const wantMag = Math.hypot(point.re, point.im);
      const wantPhaseDeg = Math.atan2(point.im, point.re) * 180 / Math.PI;
      const relMag = Math.abs(sw.zmag[i]! - wantMag) / wantMag;
      const dPhase = Math.abs(angleDiff(sw.zph[i]!, wantPhaseDeg, 360));
      worstMag = Math.max(worstMag, relMag);
      worstPhase = Math.max(worstPhase, dPhase);
      assert.ok(relMag <= 1e-12, `${point.f} Hz: |Z| rel err ${relMag.toExponential(3)} (got ${sw.zmag[i]}, want ${wantMag})`);
      assert.ok(dPhase <= 1e-10, `${point.f} Hz: Z phase err ${dPhase.toExponential(3)} deg (got ${sw.zph[i]}, want ${wantPhaseDeg})`);
    }
  });

  it('transfer function tfMag and phase match WinISD (≤1e-10 dB, ≤1e-9 deg)', () => {
    const fixture: readonly WinIsdComplexPoint[] = WINISD_BANDPASS4_CAPTURE.transfer;
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const wantMag = Math.hypot(point.re, point.im);
      const wantDb = 20 * Math.log10(wantMag);
      const wantPhaseDeg = Math.atan2(point.im, point.re) * 180 / Math.PI;
      const gotPhaseDeg = sw.phase[i]! * 180 / Math.PI;
      const dDb = Math.abs(sw.tfMag[i]! - wantDb);
      const dPhase = Math.abs(angleDiff(gotPhaseDeg, wantPhaseDeg, 360));
      assert.ok(dDb <= 1e-10, `${point.f} Hz: tfMag err ${dDb.toExponential(3)} dB (got ${sw.tfMag[i]}, want ${wantDb})`);
      assert.ok(dPhase <= 1e-9, `${point.f} Hz: transfer phase err ${dPhase.toExponential(3)} deg (got ${gotPhaseDeg}, want ${wantPhaseDeg})`);
    }
  });

  it('front port velocity matches WinISD\'s Up/Sp, scaled by √2 (≤1e-12 relative)', () => {
    const fixture: readonly WinIsdComplexPoint[] = WINISD_BANDPASS4_CAPTURE.frontPortVelocity;
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const want = Math.SQRT2 * Math.hypot(point.re, point.im);
      const rel = Math.abs(sw.pv[i]! - want) / want;
      assert.ok(rel <= 1e-12, `${point.f} Hz: pv rel err ${rel.toExponential(3)} (got ${sw.pv[i]}, want ${want})`);
    }
  });
});
