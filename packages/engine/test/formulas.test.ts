/**
 * Unit tests for src/formulas.ts — the UI-facing closed-form derivations shared by the UI
 * and panels (PR Vas/Fs/Qms, drive voltage). The expected values are computed independently
 * here, so a shared algebra error fails rather than agreeing with itself.
 *
 * Air properties live in air.ts and are pinned by air.test.ts.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  prVas, prFs, prFsWithMass, prQms, driveVoltage,
  prCmsFromVas, prMmdFromFs, prRmsFromQms,
} from '../src/index.js';

describe('formulas — drive voltage V = √(Pin·Re)', () => {
  it('√(100·4) = 20 V', () => assert.equal(driveVoltage(100, 4), 20));
  it('√(1·8) = 2√2 V', () => assert.ok(Math.abs(driveVoltage(1, 8) - Math.sqrt(8)) < 1e-12));
});

describe('formulas — passive radiator derivations', () => {
  const Cms = 0.0008, Sd = 0.0133, Mmd = 0.010, Madd = 0.005, Rms = 1.0;

  // Expected values computed BY HAND (independent of the implementation), so a shared algebra
  // error in the formula would fail here rather than agree with a self-derived expectation.
  it('prVas ≈ 20.07 l for Cms=0.0008, Sd=0.0133 (hand-computed)', () => {
    assert.ok(Math.abs(prVas(Cms, Sd) - 20.0714) < 0.01, `got ${prVas(Cms, Sd)}`);
  });
  it('prFs ≈ 56.27 Hz for Mmd=0.010, Cms=0.0008 (hand-computed)', () => {
    assert.ok(Math.abs(prFs(Mmd, Cms) - 56.271) < 0.01, `got ${prFs(Mmd, Cms)}`);
  });
  it('prFsWithMass ≈ 45.94 Hz for +5 g mass, and is lower than prFs (hand-computed)', () => {
    assert.ok(Math.abs(prFsWithMass(Mmd, Madd, Cms) - 45.944) < 0.01, `got ${prFsWithMass(Mmd, Madd, Cms)}`);
    assert.ok(prFsWithMass(Mmd, Madd, Cms) < prFs(Mmd, Cms));
  });
  it('prQms = √12.5 ≈ 3.5355 for Mmd=0.010, Cms=0.0008, Rms=1 (hand-computed)', () => {
    assert.ok(Math.abs(prQms(Mmd, Cms, Rms) - 3.53553) < 1e-4, `got ${prQms(Mmd, Cms, Rms)}`);
  });

  // Guards: undefined inputs return 0 (matches the UI computeds that showed a blank/0 readout).
  it('returns 0 when a required input is non-positive', () => {
    assert.equal(prFs(0, Cms), 0);
    assert.equal(prFs(Mmd, 0), 0);
    assert.equal(prFsWithMass(0, 0, Cms), 0);
    assert.equal(prQms(Mmd, Cms, 0), 0);
  });
});

describe('formulas — passive radiator inverses round-trip through their forward functions', () => {
  const Cms = 111111e-8, Sd = 222222e-6, Mmd = 333333e-6, Rms = 444444e-4;

  it('prCmsFromVas inverts prVas: prCmsFromVas(prVas(Cms, Sd), Sd) === Cms', () => {
    const vasL = prVas(Cms, Sd);
    assert.ok(Math.abs(prCmsFromVas(vasL, Sd) - Cms) / Cms < 1e-9,
      `got ${prCmsFromVas(vasL, Sd)}, want ${Cms}`);
  });
  it('prCmsFromVas returns 0 when Sd is non-positive', () => {
    assert.equal(prCmsFromVas(999999, 0), 0);
  });

  it('prMmdFromFs inverts prFs: prMmdFromFs(prFs(Mmd, Cms), Cms) === Mmd', () => {
    const fsHz = prFs(Mmd, Cms);
    assert.ok(Math.abs(prMmdFromFs(fsHz, Cms) - Mmd) / Mmd < 1e-9,
      `got ${prMmdFromFs(fsHz, Cms)}, want ${Mmd}`);
  });
  it('prMmdFromFs returns 0 when Fs or Cms is non-positive', () => {
    assert.equal(prMmdFromFs(0, Cms), 0);
    assert.equal(prMmdFromFs(999999, 0), 0);
  });

  it('prRmsFromQms inverts prQms: prRmsFromQms(prQms(Mmd, Cms, Rms), Mmd, Cms) === Rms', () => {
    const qms = prQms(Mmd, Cms, Rms);
    assert.ok(Math.abs(prRmsFromQms(qms, Mmd, Cms) - Rms) / Rms < 1e-9,
      `got ${prRmsFromQms(qms, Mmd, Cms)}, want ${Rms}`);
  });
  it('prRmsFromQms returns 0 when Qms is non-positive', () => {
    assert.equal(prRmsFromQms(0, Mmd, Cms), 0);
  });
});
