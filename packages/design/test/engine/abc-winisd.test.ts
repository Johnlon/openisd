/**
 * ABC (Aperiodic Bi-Chamber) box, matched to WinISD's own logged charts.
 * Golden data: `../fixtures/winisdAbcCapture.ts` (`WINISD_ABC_CAPTURE`) — WinISD 0.7.0.950's
 * impedance/transfer-function/rear-front-intra-port-velocity, logged live by debugger
 * (winisd_research runs/abc-w5-1).
 *
 * Model under test: `engine/boxes/AbcBox.ts`, `lossMode: 'winisd-lossy'`.
 * Formula: winisd_research/GHIDRA_FINDINGS.md "ABC (Aperiodic Bi-Chamber) — `0x4591b0`".
 *
 * Chart-21 wart (leader's "Gotcha 2", also `docs/research/ACCURACY_IMPROVEMENTS.md`): the intra
 * port velocity chart is `V/(jωMai + Zf)`, dropping `Ricl` — the load `Zbox` and every other
 * chart keep it. `AbcBox.ts` reproduces this by returning it separately as `UPi`, never folding
 * it into `Zbox`.
 *
 * Goes through `OpenISDProject.fromWprText` + `Engine`/`project.sweep()` — the SAME
 * `../winisd/fixtures/abc-w5-1.wpr` this fixture's own numbers were captured from (the `.wpr`
 * carries the driver, box, vent and signal-source values verbatim, so there is no separate
 * manual driver-quantity reconstruction here, unlike this file's own previous revision — see
 * `passive-radiator-count-winisd.test.ts` for the same pattern, and `bandpass6-winisd.test.ts`
 * for the sibling box type).
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';
import {OpenISDProject} from '../../domain/index.js';
import {WINISD_ABC_CAPTURE} from '../fixtures/winisdAbcCapture.js';
import type {WinIsdComplexPoint} from '../fixtures/winisdVentedCapture.js';

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
  const engine = new Engine();
  const text = readFileSync(join(here, '..', 'winisd', 'fixtures', wprFile), 'utf8');
  const {value: project, errors} = OpenISDProject.fromWprText(text, engine);
  if (project === null) throw new Error('fromWprText returned problems: ' + JSON.stringify(errors));
  // The capture's own condition (this file's header, and the fixture's own doc comment): VCInd
  // off, "Use WinISD driver calculations" on, winisd-lossy, WinISD's own air model, Rg NOT at
  // driver side. `applyWinisdSettings()` covers every one of those except `rgAtDriverSide`
  // (a native control it deliberately leaves alone — its own doc comment).
  project.applyWinisdSettings();
  project.rgAtDriverSide.set(false);
  return project;
}

const F = WINISD_ABC_CAPTURE;

describe('ABC box, winisd-lossy: matches WinISD\'s own charts (abc-w5-1)', () => {
  const project = setUpProject('abc-w5-1.wpr');
  const grid = F.impedance;
  const {values: sw, issues} = project.sweep({
    fmin: grid[0]!.f, fmax: grid[grid.length - 1]!.f, N: grid.length - 1,
  });
  if (sw === null) throw new Error('sweep refused: ' + JSON.stringify(issues));

  it('the swept grid lands on exactly the fixture\'s own frequencies', () => {
    assert.equal(sw.fs.length, grid.length);
    for (let i = 0; i < grid.length; i++) {
      const rel = Math.abs(sw.fs[i]! - grid[i]!.f) / grid[i]!.f;
      assert.ok(rel <= 1e-9, `point ${i}: grid frequency ${sw.fs[i]} vs fixture ${grid[i]!.f}`);
    }
  });

  it('impedance |Z| and phase match WinISD (≤1e-8 relative, ≤1e-6 deg)', () => {
    for (let i = 0; i < grid.length; i++) {
      const point = grid[i]!;
      const wantMag = Math.hypot(point.re, point.im);
      const wantPhaseDeg = Math.atan2(point.im, point.re) * 180 / Math.PI;
      const gotMag = sw.zmag[i]!;
      const gotPhaseDeg = sw.zph[i]!;
      const relMag = Math.abs(gotMag - wantMag) / wantMag;
      const dPhase = Math.abs(angleDiff(gotPhaseDeg, wantPhaseDeg, 360));
      assert.ok(relMag <= 1e-8, `${point.f} Hz: |Z| rel err ${relMag.toExponential(3)} (got ${gotMag}, want ${wantMag})`);
      assert.ok(dPhase <= 1e-6, `${point.f} Hz: Z phase err ${dPhase.toExponential(3)} deg (got ${gotPhaseDeg}, want ${wantPhaseDeg})`);
    }
  });

  it('transfer function tfMag matches WinISD (≤1e-6 dB)', () => {
    const fixture: readonly WinIsdComplexPoint[] = F.transfer;
    assert.equal(fixture.length, grid.length);
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const wantDb = 20 * Math.log10(Math.hypot(point.re, point.im));
      const gotDb = sw.tfMag[i]!;
      const dDb = Math.abs(gotDb - wantDb);
      assert.ok(dDb <= 1e-6, `${point.f} Hz: tfMag err ${dDb.toExponential(3)} dB (got ${gotDb}, want ${wantDb})`);
    }
  });

  // `sw.pv`/`sw.pvRear`/`sw.pvIntra` carry WinISD's own √2 (`vented-winisd.test.ts`'s own "port
  // velocity matches WinISD's Up/Sp, scaled by √2" convention, confirmed for bandpass6 in
  // `bandpass6-winisd.test.ts`): the fixture stores the un-scaled magnitude.
  it('front port velocity (pv) matches the fixture, scaled by √2', () => {
    const fixture: readonly WinIsdComplexPoint[] = F.frontPortVelocity;
    assert.equal(fixture.length, grid.length);
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const want = Math.SQRT2 * Math.hypot(point.re, point.im);
      const got = sw.pv[i]!;
      const rel = Math.abs(got - want) / want;
      assert.ok(rel <= 1e-9, `${point.f} Hz: front port velocity rel err ${rel.toExponential(3)} (got ${got}, want ${want})`);
    }
  });

  it('rear port velocity (pvRear) matches the fixture, scaled by √2', () => {
    const fixture: readonly WinIsdComplexPoint[] = F.rearPortVelocity;
    assert.equal(fixture.length, grid.length);
    assert.ok(sw.pvRear !== null, 'abc must produce a rear-port velocity curve');
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const want = Math.SQRT2 * Math.hypot(point.re, point.im);
      const got = sw.pvRear![i]!;
      const rel = Math.abs(got - want) / want;
      assert.ok(rel <= 1e-9, `${point.f} Hz: rear port velocity rel err ${rel.toExponential(3)} (got ${got}, want ${want})`);
    }
  });

  it('intra port velocity (pvIntra) matches WinISD\'s own chart-21 wart, scaled by √2 (Ricl left out — V/(jωMai+Zf), not the correct Zi)', () => {
    const fixture: readonly WinIsdComplexPoint[] = F.intraPortVelocity;
    assert.equal(fixture.length, grid.length);
    assert.ok(sw.pvIntra !== null, 'abc must produce an intra-port velocity curve');
    for (let i = 0; i < fixture.length; i++) {
      const point = fixture[i]!;
      const want = Math.SQRT2 * Math.hypot(point.re, point.im);
      const got = sw.pvIntra![i]!;
      const rel = Math.abs(got - want) / want;
      assert.ok(rel <= 1e-9, `${point.f} Hz: intra port velocity rel err ${rel.toExponential(3)} (got ${got}, want ${want})`);
    }
  });
});
