/**
 * Unit tests for src/formulas.ts — the UI-facing closed-form derivations that were
 * previously copy-pasted across the skins/panels (PR Vas/Fs/Qms, drive voltage, sound
 * velocity). These are ADDITIONS consolidating existing duplicated formulas; the expected
 * values are computed independently here so the extraction is proven behaviour-preserving.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { RHO, C, prVas, prFs, prFsWithMass, prQms, driveVoltage, soundVelocity } from '../src/index.js';

describe('formulas — drive voltage V = √(Pin·Re)', () => {
  it('√(100·4) = 20 V', () => assert.equal(driveVoltage(100, 4), 20));
  it('√(1·8) = 2√2 V', () => assert.ok(Math.abs(driveVoltage(1, 8) - Math.sqrt(8)) < 1e-12));
});

describe('formulas — speed of sound c = 20.05·√(T[K])', () => {
  it('at 293.15 K ≈ 343.3 m/s', () => assert.ok(Math.abs(soundVelocity(293.15) - 20.05 * Math.sqrt(293.15)) < 1e-9));
  it('is ~343 m/s at room temperature', () => assert.ok(soundVelocity(293.15) > 342 && soundVelocity(293.15) < 344));
});

describe('formulas — passive radiator derivations', () => {
  const Cms = 0.0008, Sd = 0.0133, Mmd = 0.010, Madd = 0.005, Rms = 1.0;

  it('prVas = Cms·Sd²·ρ·c²·1000 (litres)', () => {
    assert.ok(Math.abs(prVas(Cms, Sd) - (Cms * Sd * Sd * RHO * C * C * 1000)) < 1e-9);
  });
  it('prFs = 1/(2π√(Mmd·Cms))', () => {
    assert.ok(Math.abs(prFs(Mmd, Cms) - 1 / (2 * Math.PI * Math.sqrt(Mmd * Cms))) < 1e-9);
  });
  it('prFsWithMass uses (Mmd + Madd) → a lower resonance than prFs', () => {
    assert.ok(Math.abs(prFsWithMass(Mmd, Madd, Cms) - 1 / (2 * Math.PI * Math.sqrt((Mmd + Madd) * Cms))) < 1e-9);
    assert.ok(prFsWithMass(Mmd, Madd, Cms) < prFs(Mmd, Cms));
  });
  it('prQms = √(Mmd/Cms)/Rms', () => {
    assert.ok(Math.abs(prQms(Mmd, Cms, Rms) - Math.sqrt(Mmd / Cms) / Rms) < 1e-9);
  });

  // Guards: undefined inputs return 0 (matches the UI computeds that showed a blank/0 readout).
  it('returns 0 when a required input is non-positive', () => {
    assert.equal(prFs(0, Cms), 0);
    assert.equal(prFs(Mmd, 0), 0);
    assert.equal(prFsWithMass(0, 0, Cms), 0);
    assert.equal(prQms(Mmd, Cms, 0), 0);
  });
});
