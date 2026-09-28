/**
 * Unit tests for src/formulas.ts — the UI-facing closed-form derivations shared by the UI
 * and panels (PR Vas/Fs/Qms, drive voltage). The expected values are computed independently
 * here, so a shared algebra error fails rather than agreeing with itself.
 *
 * Air properties live in air.ts and are pinned by air.test.ts.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

/** Free-air resonance with no added mass — the zero-Madd case of `prFsWithMass`. */
const prFs = (prMmd: number, prCms: number) => engine.pr.fsWithMass(prMmd, 0, prCms);

describe('formulas — drive voltage V = √(Pin·(Re+Rs))', () => {
  it('√(100·4) = 20 V with Rs=0', () => assert.equal(engine.driveVoltage(100, 4), 20));
  it('√(1·8) = 2√2 V with Rs=0', () => assert.ok(Math.abs(engine.driveVoltage(1, 8) - Math.sqrt(8)) < 1e-12));
  it('√(1·(3.4+0.1)) = √3.5 V with Rs=0.1 (WinISD convention)', () => assert.equal(engine.driveVoltage(1, 3.4, 0.1), Math.sqrt(3.5)));
});

describe('formulas — passive radiator derivations', () => {
  const Cms = 0.0008, Sd = 0.0133, Mmd = 0.010, Madd = 0.005, Rms = 1.0;

  // Expected values computed BY HAND (independent of the implementation), so a shared algebra
  // error in the formula would fail here rather than agree with a self-derived expectation.
  it('prVas ≈ 0.0200714 m³ for Cms=0.0008, Sd=0.0133 (hand-computed)', () => {
    // The same hand-computed figure as ever — 20.0714 litres — stated in the SI unit the
    // function now returns, with the tolerance converted alongside it (0.01 l = 1e-5 m³).
    assert.ok(Math.abs(engine.pr.vas(Cms, Sd) - 0.0200714) < 1e-5, `got ${engine.pr.vas(Cms, Sd)}`);
  });
  it('prFs ≈ 56.27 Hz for Mmd=0.010, Cms=0.0008 (hand-computed)', () => {
    assert.ok(Math.abs(prFs(Mmd, Cms) - 56.271) < 0.01, `got ${prFs(Mmd, Cms)}`);
  });
  it('prFsWithMass ≈ 45.94 Hz for +5 g mass, and is lower than prFs (hand-computed)', () => {
    assert.ok(Math.abs(engine.pr.fsWithMass(Mmd, Madd, Cms) - 45.944) < 0.01, `got ${engine.pr.fsWithMass(Mmd, Madd, Cms)}`);
    assert.ok(engine.pr.fsWithMass(Mmd, Madd, Cms) < prFs(Mmd, Cms));
  });
  it('prQms = √12.5 ≈ 3.5355 for Mmd=0.010, Cms=0.0008, Rms=1 (hand-computed)', () => {
    assert.ok(Math.abs(engine.pr.qms(Mmd, Cms, Rms) - 3.53553) < 1e-4, `got ${engine.pr.qms(Mmd, Cms, Rms)}`);
  });

  // Guards: undefined inputs return 0 (matches the UI computeds that showed a blank/0 readout).
  it('returns 0 when a required input is non-positive', () => {
    assert.equal(prFs(0, Cms), 0);
    assert.equal(prFs(Mmd, 0), 0);
    assert.equal(engine.pr.fsWithMass(0, 0, Cms), 0);
    assert.equal(engine.pr.qms(Mmd, Cms, 0), 0);
  });
});

describe('formulas — passive radiator inverses round-trip through their forward functions', () => {
  const Cms = 111111e-8, Sd = 222222e-6, Mmd = 333333e-6, Rms = 444444e-4;

  it('prCmsFromVas inverts prVas: prCmsFromVas(engine.pr.vas(Cms, Sd), Sd) === Cms', () => {
    const vas_m3 = engine.pr.vas(Cms, Sd);
    assert.ok(Math.abs(engine.pr.cmsFromVas(vas_m3, Sd) - Cms) / Cms < 1e-9,
      `got ${engine.pr.cmsFromVas(vas_m3, Sd)}, want ${Cms}`);
  });
  it('prCmsFromVas returns 0 when Sd is non-positive', () => {
    assert.equal(engine.pr.cmsFromVas(999999, 0), 0);
  });

  it('prMmdFromFs inverts prFs: prMmdFromFs(prFs(Mmd, Cms), Cms) === Mmd', () => {
    const fsHz = prFs(Mmd, Cms);
    assert.ok(Math.abs(engine.pr.mmdFromFs(fsHz, Cms) - Mmd) / Mmd < 1e-9,
      `got ${engine.pr.mmdFromFs(fsHz, Cms)}, want ${Mmd}`);
  });
  it('prMmdFromFs returns 0 when Fs or Cms is non-positive', () => {
    assert.equal(engine.pr.mmdFromFs(0, Cms), 0);
    assert.equal(engine.pr.mmdFromFs(999999, 0), 0);
  });

  it('prRmsFromQms inverts prQms: prRmsFromQms(engine.pr.qms(Mmd, Cms, Rms), Mmd, Cms) === Rms', () => {
    const qms = engine.pr.qms(Mmd, Cms, Rms);
    assert.ok(Math.abs(engine.pr.rmsFromQms(qms, Mmd, Cms) - Rms) / Rms < 1e-9,
      `got ${engine.pr.rmsFromQms(qms, Mmd, Cms)}, want ${Rms}`);
  });
  it('prRmsFromQms returns 0 when Qms is non-positive', () => {
    assert.equal(engine.pr.rmsFromQms(0, Mmd, Cms), 0);
  });
});
