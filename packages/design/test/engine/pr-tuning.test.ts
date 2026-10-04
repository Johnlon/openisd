import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// The reference air pair, passed explicitly to every ventLength/tuningFromLength/prTuning/
// prMassForFp call below — these tests are about the Helmholtz/PR formulas, not air-sensitivity
// (see the air sensitivity block below for that), so every one of them runs at the same reference
// condition `refRho()`/`refC()` above already assume.
const AIR = engine.environment.solve({}).values;

// 0.01 Hz: sub-cent precision for computed frequencies.
// Speaker alignment frequencies are typically quoted to 1 Hz; this is 100× tighter.
const FREQ_TOLERANCE_HZ = 0.01;

// Two genuinely different air conditions — reference (20 °C) vs. a hot, humid one — so any
// function reading `air` must give a DIFFERENT answer for the two, and the reference case must
// match what the function gave before it took `air` explicitly (regression safety).
const REFERENCE_AIR = engine.environment.solve({}).values;

const HOT_AIR = engine.environment.solve({ tempK: 313.15, humidityPct: 90, pressurePa: 95000 }).values;

describe('passive radiator tuning', () => {
  describe('Passive radiator tuning frequency (prTuning)', () => {

    // Fp is the system resonance of the PR in the box:
    //   Map = (Mmd + Madd) / Sd²
    //   Cap = Cms · Sd²
    //   Cpar = Cab·Cap / (Cab + Cap)  (box and PR compliance in series)
    //   Fp  = 1 / (2π·√(Map·Cpar))
    // Ref: [S74], [Wiki-Hz]

    const BASE_PR = {
      Vb:     0.020,  // m³
      prSd:   0.0133, // m²
      prMmd:  0.010,  // kg — PR moving mass without added weight
      prMadd: 0,      // kg — no added mass initially
      prCms:  0.0008, // m/N
      prNum:  1,
    };

    it('in a very large box Fp approaches the PR free-air resonance Fs (lower bound)', () => {
      // As Cab → ∞ (huge box): Cpar = Cab·Cap/(Cab+Cap) → Cap.
      // So Fp → Fs_pr = 1/(2π·√(Mmd·Cms)) from above.
      // 1000 m³ is many orders of magnitude above any real enclosure.
      const VERY_LARGE_BOX = { ...BASE_PR, Vb: 1000 }; // 1000 m³ ≈ acoustically infinite
      const Fs_pr = 1 / (2 * Math.PI * Math.sqrt(BASE_PR.prMmd * BASE_PR.prCms));
      const Fp    = engine.pr.tuning(VERY_LARGE_BOX, AIR);
      assert.ok(Fp > Fs_pr,
        `Even in a huge box, Fp=${Fp.toFixed(4)} Hz should still be ≥ Fs_pr=${Fs_pr.toFixed(4)} Hz`);
      assert.ok(Math.abs(Fp - Fs_pr) < FREQ_TOLERANCE_HZ,
        `In a 1000 m³ box, Fp=${Fp.toFixed(4)} Hz should be within ${FREQ_TOLERANCE_HZ} Hz of Fs_pr=${Fs_pr.toFixed(4)} Hz`);
    });

    it('in-box Fp is always higher than the PR free-air resonance Fs', () => {
      // The box compliance Cab is in series with PR compliance Cap:
      //   Cpar = Cab·Cap/(Cab+Cap) < Cap  (series always less than either component alone)
      // Less total compliance → higher stiffness → higher resonance frequency.
      // So Fp > Fs_pr for any finite enclosure.
      const Fs_pr = 1 / (2 * Math.PI * Math.sqrt(BASE_PR.prMmd * BASE_PR.prCms));
      const Fp    = engine.pr.tuning(BASE_PR, AIR);
      assert.ok(Fp > Fs_pr,
        `In-box Fp=${Fp.toFixed(1)} Hz should be above free-air Fs=${Fs_pr.toFixed(1)} Hz ` +
        `(box stiffness raises resonance)`);
    });

    it('adding mass to the PR reduces Fp (more mass → lower resonance)', () => {
      // Map = (Mmd + Madd) / Sd²; more mass → higher Map → lower Fp.
      const Fp_no_mass  = engine.pr.tuning({ ...BASE_PR, prMadd: 0 }, AIR);
      const Fp_20g_mass = engine.pr.tuning({ ...BASE_PR, prMadd: 0.020 }, AIR); // add 20 g
      assert.ok(Fp_20g_mass < Fp_no_mass,
        `Adding 20 g lowers Fp from ${Fp_no_mass.toFixed(1)} Hz to ${Fp_20g_mass.toFixed(1)} Hz`);
    });

  });

  describe('PR added-mass auto-tune (prMassForFp)', () => {

    const PR_PARAMS = {
      Vb:    0.020,
      prSd:  0.0133,
      prMmd: 0.010,
      prCms: 0.0008,
      prMadd: 0, // will be ignored — prMassForFp computes total mass
      prNum: 1,
    };

    it('prMassForFp and prTuning are exact inverses — hitting 30 Hz target', () => {
      const TARGET_FP = 30; // Hz
      const total     = engine.pr.massForFp(PR_PARAMS, TARGET_FP, AIR);
      const achieved  = engine.pr.tuning({ ...PR_PARAMS, prMadd: total - PR_PARAMS.prMmd }, AIR);
      assert.ok(Math.abs(achieved - TARGET_FP) < 1e-6,
        `engine.pr.massForFp(30 Hz) → Madd=${((total - PR_PARAMS.prMmd) * 1000).toFixed(2)} g → prTuning → ${achieved.toFixed(6)} Hz`);
    });

    it('prMassForFp and prTuning are exact inverses — hitting 50 Hz target', () => {
      const TARGET_FP = 50; // Hz — higher target → less mass needed
      const total     = engine.pr.massForFp(PR_PARAMS, TARGET_FP, AIR);
      const achieved  = engine.pr.tuning({ ...PR_PARAMS, prMadd: total - PR_PARAMS.prMmd }, AIR);
      assert.ok(Math.abs(achieved - TARGET_FP) < 1e-6,
        `engine.pr.massForFp(50 Hz) → prTuning → ${achieved.toFixed(6)} Hz`);
    });

    it('a higher target Fp requires less added mass (less mass → higher resonance)', () => {
      const mass_30Hz = engine.pr.massForFp(PR_PARAMS, 30, AIR) - PR_PARAMS.prMmd;
      const mass_50Hz = engine.pr.massForFp(PR_PARAMS, 50, AIR) - PR_PARAMS.prMmd;
      assert.ok(mass_30Hz > mass_50Hz,
        `30 Hz needs ${(mass_30Hz * 1000).toFixed(1)} g > 50 Hz needs ${(mass_50Hz * 1000).toFixed(1)} g`);
    });

  });

  describe('air sensitivity', () => {

    it('prTuning gives a different tuning at a non-reference air pair', () => {
      const P = { Vb: 0.03, prMmd: 0.02, prMadd: 0, prSd: 0.02, prCms: 0.0008, prNum: 1 };
      const atReference = engine.pr.tuning(P, REFERENCE_AIR);
      const atHot = engine.pr.tuning(P, HOT_AIR);
      expect(atHot).not.toBeCloseTo(atReference, 6);
    });

    it('prMassForFp gives a different mass at a non-reference air pair', () => {
      const P = { Vb: 0.03, prMmd: 0.02, prMadd: 0, prSd: 0.02, prCms: 0.0008, prNum: 1 };
      const atReference = engine.pr.massForFp(P, 30, REFERENCE_AIR);
      const atHot = engine.pr.massForFp(P, 30, HOT_AIR);
      expect(atHot).not.toBeCloseTo(atReference, 6);
    });
  });
});
