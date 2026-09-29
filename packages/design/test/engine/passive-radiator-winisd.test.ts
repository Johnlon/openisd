/**
 * Passive-radiator box, matched to WinISD's own logged charts
 * (bugs/BUG_20260927_passive-radiator-losses-not-winisd-form.md). Golden data:
 * `../fixtures/winisdPassiveRadiatorCapture.ts` (`WINISD_PASSIVE_RADIATOR_CAPTURE`) — WinISD
 * 0.7.0.950's impedance/transfer-function/radiator-excursion, logged live by debugger from the
 * SAME `.wpr` this test imports (`../winisd/fixtures/pr-w5-1.wpr`).
 *
 * Model under test: `engine/circuit.ts` `solve`, `box === 'box-passive-radiator'`,
 * `lossMode: 'winisd-lossy'`. Formula: winisd_research/GHIDRA_FINDINGS.md "Passive radiator
 * box — `0x45a960`".
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_PASSIVE_RADIATOR_CAPTURE} from '../fixtures/winisdPassiveRadiatorCapture.js';
import type {WinIsdComplexPoint} from '../fixtures/winisdVentedCapture.js';

const here = dirname(fileURLToPath(import.meta.url));
const WPR_PATH = join(here, '..', 'winisd', 'fixtures', 'pr-w5-1.wpr');

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
  const {value: project, errors} = OpenISDProject.fromWprText(text, engine);
  if (project === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(errors));
  // WinISD Advanced/Compatibility switches this capture ran under (fixture header comment):
  // VCInd off (circuitModel stays its 'winisd' default — Le excluded), Rg NOT at driver side.
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  return project;
}

describe('passive-radiator box, winisd-lossy: import gives the fixture\'s own numbers', () => {
  it('Vb, Fr, Ql, Qa, radiator Fs/Qms/Vas/Sd/Me and Rs land as WinISD stated them', () => {
    const project = setUpProject();
    assert.equal(project.box.passiveRadiator.volume_m3.value, 0.01);
    assert.ok(Math.abs(project.box.passiveRadiator.systemTuning_hz.value! - 36.49657518178932) < 1e-8,
      `Fr ${project.box.passiveRadiator.systemTuning_hz.value} vs WinISD 36.4966`);
    assert.equal(project.box.passiveRadiator.losses.Ql.value, 7);
    assert.equal(project.box.passiveRadiator.losses.Qa.value, 30);
    const r = project.box.passiveRadiator.radiator.spec;
    assert.equal(r.Fs_hz.value, 30);
    assert.equal(r.Qms.value, 3.3);
    assert.equal(r.Vas_m3.value, 0.0048);
    assert.equal(r.Sd_m2.value, 0.0095);
    assert.equal(project.box.passiveRadiator.addedMass_kg.value, 0, 'the .wpr\'s [PassiveRadiator] Me — the radiator carries no added mass in this box');
    assert.equal(project.Rs_ohm.value, 0.1);
  });
});

describe('passive-radiator box, winisd-lossy: matches WinISD\'s own charts (pr-w5-1/pr-w5-2)', () => {
  const project = setUpProject();
  const grid = WINISD_PASSIVE_RADIATOR_CAPTURE.impedance;
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
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const wantMag = Math.hypot(point.re, point.im);
      const wantPhaseDeg = Math.atan2(point.im, point.re) * 180 / Math.PI;
      const relMag = Math.abs(sw.zmag[i]! - wantMag) / wantMag;
      const dPhase = Math.abs(angleDiff(sw.zph[i]!, wantPhaseDeg, 360));
      assert.ok(relMag <= 1e-12, `${point.f} Hz: |Z| rel err ${relMag.toExponential(3)} (got ${sw.zmag[i]}, want ${wantMag})`);
      assert.ok(dPhase <= 1e-10, `${point.f} Hz: Z phase err ${dPhase.toExponential(3)} deg (got ${sw.zph[i]}, want ${wantPhaseDeg})`);
    }
  });

  it('transfer function tfMag and phase match WinISD (≤1e-10 dB, ≤1e-9 deg)', () => {
    const fixture: readonly WinIsdComplexPoint[] = WINISD_PASSIVE_RADIATOR_CAPTURE.transfer;
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

  it('radiator excursion matches WinISD\'s Upr/(jω·Sd_pr), scaled by √2 (≤1e-12 relative)', () => {
    const fixture: readonly WinIsdComplexPoint[] = WINISD_PASSIVE_RADIATOR_CAPTURE.radiatorExcursion;
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      // Fixture is metres; sw.excPR is millimetres (engine/sweep.ts).
      const wantMm = Math.SQRT2 * Math.hypot(point.re, point.im) * 1000;
      const rel = Math.abs(sw.excPR[i]! - wantMm) / wantMm;
      assert.ok(rel <= 1e-12, `${point.f} Hz: excPR rel err ${rel.toExponential(3)} (got ${sw.excPR[i]}, want ${wantMm})`);
    }
  });
});
