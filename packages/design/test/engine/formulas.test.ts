/**
 * Unit tests for src/formulas.ts — the UI-facing closed-form derivations shared by the UI
 * and panels (PR Vas/Fs/Qms, drive voltage). The expected values are computed independently
 * here, so a shared algebra error fails rather than agreeing with itself.
 *
 * Air properties live in air.ts and are pinned by air.test.ts.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();
/** An explicit air for the tests: WinISD's reference conditions, stated here, not defaulted by a calc. */
const air = REFERENCE_AIR;

/** Free-air resonance with no added mass — the zero-Madd case of `prFsWithMass`. */
const prFs = (prMmd: number, prCms: number) => engine.pr.fsWithMass(prMmd, 0, prCms);

describe('formulas — drive voltage V = √(Pin·(Re+Rs))', () => {
  it('√(100·4) = 20 V with Rs=0', () => assert.equal(engine.signal.driveVoltage(100, 4), 20));
  it('√(1·8) = 2√2 V with Rs=0', () => assert.ok(Math.abs(engine.signal.driveVoltage(1, 8) - Math.sqrt(8)) < 1e-12));
  it('√(1·(3.4+0.1)) = √3.5 V with Rs=0.1 (WinISD convention)', () => assert.equal(engine.signal.driveVoltage(1, 3.4, 0.1), Math.sqrt(3.5)));
});

describe('formulas — passive radiator derivations', () => {
  const Cms = 0.0008, Sd = 0.0133, Mmd = 0.010, Madd = 0.005, Rms = 1.0;

  // Expected values computed BY HAND (independent of the implementation), so a shared algebra
  // error in the formula would fail here rather than agree with a self-derived expectation.
  it('prVas ≈ 0.0200714 m³ for Cms=0.0008, Sd=0.0133 (hand-computed)', () => {
    // The same hand-computed figure as ever — 20.0714 litres — stated in the SI unit the
    // function now returns, with the tolerance converted alongside it (0.01 l = 1e-5 m³).
    const Vas = engine.pr.solveSpec({Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: Sd, Mms_kg: null, Cms_m_per_N: Cms, Rms_kg_per_s: null}, air).Vas_m3;
    assert.ok(Vas !== null && Math.abs(Vas - 0.0200714) < 1e-5, `got ${Vas}`);
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

describe('formulas — passive radiator inverse routes', () => {
  const Cms = 111111e-8, Sd = 222222e-6, Mmd = 333333e-6, Rms = 444444e-4;
  const blank = {Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: null, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};

  it('solveSpec recovers Cms from Vas and Sd', () => {
    const {Vas_m3} = engine.pr.solveSpec({...blank, Sd_m2: Sd, Cms_m_per_N: Cms}, air);
    assert.ok(Vas_m3 !== null);
    const solved = engine.pr.solveSpec({...blank, Sd_m2: Sd, Vas_m3}, air);
    assert.ok(solved.Cms_m_per_N !== null && Math.abs(solved.Cms_m_per_N - Cms) / Cms < 1e-9);
  });

  it.each([0, -Sd])('solveSpec leaves Cms unsolved when Sd is %s', invalidSd => {
    const {Cms_m_per_N} = engine.pr.solveSpec({...blank, Vas_m3: 999999, Sd_m2: invalidSd}, air);
    assert.equal(Cms_m_per_N, null);
  });

  it('solveSpec recovers moving mass from free-air Fs and Cms', () => {
    const {Mms_kg} = engine.pr.solveSpec({...blank, Fs_hz: prFs(Mmd, Cms), Cms_m_per_N: Cms}, air);
    assert.ok(Mms_kg !== null && Math.abs(Mms_kg - Mmd) / Mmd < 1e-9);
  });

  it.each([
    ['Fs is zero', 0, Cms],
    ['Fs is negative', -1, Cms],
    ['Cms is zero', 999999, 0],
    ['Cms is negative', 999999, -Cms],
  ])('solveSpec leaves moving mass unsolved when %s', (_condition, Fs_hz, Cms_m_per_N) => {
    const {Mms_kg} = engine.pr.solveSpec({...blank, Fs_hz, Cms_m_per_N}, air);
    assert.equal(Mms_kg, null);
  });

  it('solveSpec recovers Rms from Qms, Cms and moving mass', () => {
    const Qms = engine.pr.qms(Mmd, Cms, Rms);
    const {Rms_kg_per_s} = engine.pr.solveSpec({...blank, Qms, Cms_m_per_N: Cms, Mms_kg: Mmd}, air);
    assert.ok(Rms_kg_per_s !== null && Math.abs(Rms_kg_per_s - Rms) / Rms < 1e-9);
  });

  it.each([0, -1])('solveSpec leaves Rms unsolved when Qms is %s', invalidQms => {
    const {Rms_kg_per_s} = engine.pr.solveSpec({...blank, Qms: invalidQms, Cms_m_per_N: Cms, Mms_kg: Mmd}, air);
    assert.equal(Rms_kg_per_s, null);
  });
});
