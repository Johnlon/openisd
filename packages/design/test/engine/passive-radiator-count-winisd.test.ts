/**
 * Passive-radiator box, radiator count (Npr), matched to WinISD's own logged charts
 * (bugs/archive/BUG_20260928_pr-added-mass-or-count-not-winisd.md). Golden data:
 * `../fixtures/winisdPassiveRadiatorCountCapture.ts` — WinISD 0.7.0.950's impedance/transfer/
 * radiator-excursion, logged live by debugger from the SAME `.wpr` files this test imports
 * (`../winisd/fixtures/pr-w5-npr-1.wpr`, `pr-w5-me-npr-1.wpr`).
 *
 * Model under test: `engine/boxes/PassiveRadiatorBox.ts`, `lossMode: 'winisd-lossy'`. Formula:
 * winisd_research/GHIDRA_FINDINGS.md "4th-order bandpass" § "Added mass and radiator count" —
 * the fixed-loss frequency omega_r = 1/sqrt(Npr*Map*(Cab || Npr*Cap)), reproducing WinISD's own
 * bug (omega_r is Npr times too low; invisible at Npr = 1).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {
  WINISD_PR_NPR_CAPTURE, WINISD_PR_ME_NPR_CAPTURE,
} from '../fixtures/winisdPassiveRadiatorCountCapture.js';
import type {WinIsdComplexPoint} from '../fixtures/winisdVentedCapture.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Smallest signed angle from `b` to `a` — handles the wrap at ±180°/±π a plain subtraction gets
 *  wrong once in a while. */
function angleDiff(a: number, b: number, fullTurn: number): number {
  let d = (a - b) % fullTurn;
  if (d > fullTurn / 2) d -= fullTurn;
  if (d < -fullTurn / 2) d += fullTurn;
  return d;
}

function setUpProject(wprFile: string): OpenISDProject {
  const engine = createEngine();
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', wprFile), 'utf8');
  const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (project === null) throw new Error('winIsdProjectToOpenIsdProject returned problems: ' + JSON.stringify(errors));
  // Same Advanced/Compatibility switches the captures ran under as passive-radiator-winisd.test.ts.
  project.winisdDriverModel.set(true);
  project.rgAtDriverSide.set(false);
  return project;
}

for (const [label, wprFile, capture] of [
  ['Npr alone (Npr=2, Me=0)', 'pr-w5-npr-1.wpr', WINISD_PR_NPR_CAPTURE],
  ['Npr and Me together (Npr=2, Me=0.01)', 'pr-w5-me-npr-1.wpr', WINISD_PR_ME_NPR_CAPTURE],
] as const) {
  describe(`passive-radiator box, winisd-lossy, ${label}: matches WinISD's own charts`, () => {
    const project = setUpProject(wprFile);
    const grid = capture.impedance;
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
      const fixture: readonly WinIsdComplexPoint[] = capture.transfer;
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
      const fixture: readonly WinIsdComplexPoint[] = capture.radiatorExcursion;
      for (let i = 0; i < fixture.length; i++) {
        const point = fixture[i]!;
        // Fixture is metres; sw.excPR is millimetres (engine/sweep.ts).
        const wantMm = Math.SQRT2 * Math.hypot(point.re, point.im) * 1000;
        const rel = Math.abs(sw.excPR[i]! - wantMm) / wantMm;
        assert.ok(rel <= 1e-12, `${point.f} Hz: excPR rel err ${rel.toExponential(3)} (got ${sw.excPR[i]}, want ${wantMm})`);
      }
    });
  });
}
