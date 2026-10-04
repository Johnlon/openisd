import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

// Port end correction for a vent flanged at one end (baffle) and free at the other — WinISD's
// own default (Vents tab "End Correction"; docs/images/winisd/vents-tab.png), and the
// value the engine applies when a caller states none.
const END_CORRECTION = 0.732;

// No environment reaches these test's own reimplementation of the formula under test, so ρ/c
// are computed live at the reference environment — matching production (no stored constant).
const refRho = (): number => engine.environment.solve({}).values.rho;

const refC = (): number => engine.environment.solve({}).values.c;

// The reference air pair, passed explicitly to every ventLength/tuningFromLength/prTuning/
// prMassForFp call below — these tests are about the Helmholtz/PR formulas, not air-sensitivity
// (see the air sensitivity block below for that), so every one of them runs at the same reference
// condition `refRho()`/`refC()` above already assume.
const AIR = engine.environment.solve({}).values;

// 1e-9: floating-point result that should be analytically exact.
const EXACT = 1e-9;

// 0.01 Hz: sub-cent precision for computed frequencies.
// Speaker alignment frequencies are typically quoted to 1 Hz; this is 100× tighter.
const FREQ_TOLERANCE_HZ = 0.01;

// Two genuinely different air conditions — reference (20 °C) vs. a hot, humid one — so any
// function reading `air` must give a DIFFERENT answer for the two, and the reference case must
// match what the function gave before it took `air` explicitly (regression safety).
const REFERENCE_AIR = engine.environment.solve({}).values;

const HOT_AIR = engine.environment.solve({ tempK: 313.15, humidityPct: 90, pressurePa: 95000 }).values;

describe('vent length and tuning', () => {
  describe('Port / vent length calculation (ventLength)', () => {

    // Helmholtz resonator: f = (c/2π)·√(Sp/(Vb·L_eq))
    //   L_eq = L + END_CORRECTION·d  (flanged at the baffle, free into the box)
    //   → L = Map·Sp/ρ − END_CORRECTION·d
    // Ref: [Wiki-Hz]

    const Vb_m3  = 0.020;  // m³ = 20 L
    const Fb_Hz  = 30;     // Hz target tuning
    const PORT_D_M = 0.050; // m = 50 mm diameter port
    const Sp_m2  = Math.PI * (PORT_D_M / 2) ** 2; // circular port area

    it('returns the exact closed form L = Map·Sp/ρ − k·d, with nothing clamped', () => {
      const L = engine.vent.lengthForTuning(Vb_m3, Fb_Hz, Sp_m2, 1, AIR);
      const Cab = Vb_m3 / (refRho() * refC() * refC());
      const Map = 1 / ((2 * Math.PI * Fb_Hz) ** 2 * Cab);
      const d   = 2 * Math.sqrt(Sp_m2 / Math.PI);
      assert.ok(Math.abs(L - (Map * Sp_m2 / refRho() - END_CORRECTION * d)) < 1e-15,
        `Vent length ${(L * 1000).toFixed(3)} mm must be the raw solve`);
    });

    // N identical ports: the moving air mass sees the TOTAL opening n·Sp, but each port's own
    // end correction is still that of ONE port's diameter — so the formula is
    //   L = Map·(n·Sp)/ρ − k·d(Sp),  never d(n·Sp).
    it('with two ports the mass term doubles and the end correction stays that of one port', () => {
      const L1 = engine.vent.lengthForTuning(Vb_m3, Fb_Hz, Sp_m2, 1, AIR);
      const L2 = engine.vent.lengthForTuning(Vb_m3, Fb_Hz, Sp_m2, 2, AIR);
      const Cab = Vb_m3 / (refRho() * refC() * refC());
      const Map = 1 / ((2 * Math.PI * Fb_Hz) ** 2 * Cab);
      const d   = 2 * Math.sqrt(Sp_m2 / Math.PI);
      assert.ok(Math.abs(L2 - (Map * 2 * Sp_m2 / refRho() - END_CORRECTION * d)) < 1e-15,
        `two-port length ${(L2 * 1000).toFixed(3)} mm must be the raw solve on the total area`);
      assert.ok(L2 > L1, 'two ports of the same size need a LONGER port for the same tuning');
    });

    it('tuningFromLength inverts ventLength at every port count', () => {
      for (const n of [1, 2, 3]) {
        const L = engine.vent.lengthForTuning(Vb_m3, Fb_Hz, Sp_m2, n, AIR);
        const back = engine.vent.tuningFromLength(Vb_m3, L, Sp_m2, n, AIR);
        assert.ok(Math.abs(back - Fb_Hz) < 1e-9, `count ${n}: ${back} Hz must round-trip to ${Fb_Hz} Hz`);
      }
    });

    it('ventEffectiveLength adds ONE port\'s end correction whatever the count — it is per port', () => {
      assert.equal(engine.vent.effectiveLength(0.2, Sp_m2, 2, END_CORRECTION), engine.vent.effectiveLength(0.2, Sp_m2, 1, END_CORRECTION));
    });

    // A tuning above the L = 0 ceiling has no non-negative solution. The solver returns the
    // raw negative root — the honest answer, and the one the UI's reachability detector reads.
    // A floor would replace it with a buildable-looking vent that tunes somewhere else.
    const CEIL_Vb = 0.030;                          // 30 L
    const CEIL_Sp = Math.PI * 0.025 ** 2;           // 5 cm round vent
    const CEIL_K  = 0.6;

    it('an impossible target returns a NEGATIVE length, not a floored one', () => {
      const L = engine.vent.lengthForTuning(CEIL_Vb, 90, CEIL_Sp, 1, AIR, CEIL_K);
      assert.ok(L < 0,
        `90 Hz in 30 L through a 5 cm vent needs L = ${(L * 1000).toFixed(2)} mm — must stay negative`);
      assert.ok(Math.abs(engine.vent.tuningFromLength(CEIL_Vb, L, CEIL_Sp, 1, AIR, CEIL_K) - 90) < 1e-9,
        'the negative root is still an exact root: tuningFromLength must invert it');
    });

    it('the reachable boundary is L = 0 — just below it positive, just above it negative', () => {
      const ceiling = engine.vent.tuningFromLength(CEIL_Vb, 0, CEIL_Sp, 1, AIR, CEIL_K); // 80.79 Hz for this geometry
      assert.ok(Math.abs(ceiling - 80.79) < 0.01, `ceiling ${ceiling.toFixed(4)} Hz`);
      assert.ok(engine.vent.lengthForTuning(CEIL_Vb, ceiling * 0.999, CEIL_Sp, 1, AIR, CEIL_K) > 0,
        'a target just BELOW the ceiling is reachable with a positive length');
      assert.ok(engine.vent.lengthForTuning(CEIL_Vb, ceiling * 1.001, CEIL_Sp, 1, AIR, CEIL_K) < 0,
        'a target just ABOVE the ceiling has no non-negative length');
      assert.ok(Math.abs(engine.vent.lengthForTuning(CEIL_Vb, ceiling, CEIL_Sp, 1, AIR, CEIL_K)) < 1e-12,
        'at the ceiling exactly the length is zero');
    });

    it('a longer vent results in a lower tuning frequency (Fb ∝ 1/√Leff)', () => {
      // More duct length → more acoustic mass Map → lower resonance frequency.
      const L_short = engine.vent.lengthForTuning(Vb_m3, 40, Sp_m2, 1, AIR); // 40 Hz tuning
      const L_long  = engine.vent.lengthForTuning(Vb_m3, 25, Sp_m2, 1, AIR); // 25 Hz tuning (lower → longer vent)
      assert.ok(L_long > L_short,
        `Vent for 25 Hz (${(L_long * 1000).toFixed(0)} mm) should be longer than for 40 Hz (${(L_short * 1000).toFixed(0)} mm)`);
    });

    it('the computed vent length, fed back into tuningFromLength, reproduces the target Fb', () => {
      // This is the round-trip test: engine.vent.lengthForTuning() and engine.vent.tuningFromLength() are inverses.
      const L       = engine.vent.lengthForTuning(Vb_m3, Fb_Hz, Sp_m2, 1, AIR);
      const Fb_back = engine.vent.tuningFromLength(Vb_m3, L, Sp_m2, 1, AIR);
      assert.ok(Math.abs(Fb_back - Fb_Hz) < FREQ_TOLERANCE_HZ,
        `engine.vent.lengthForTuning(${Fb_Hz} Hz) → ${(L * 1000).toFixed(1)} mm → tuningFromLength → ${Fb_back.toFixed(3)} Hz`);
    });

  });

  describe('Port tuning frequency from vent dimensions (tuningFromLength)', () => {

    // Helmholtz formula: f = (c/2π)·√(Sp/(Vb·Leff)),  Leff = L + END_CORRECTION·d
    // Ref: [Wiki-Hz]

    const Vb_m3   = 0.020; // m³
    const PORT_D_M = 0.050; // m
    const Sp_m2   = Math.PI * (PORT_D_M / 2) ** 2;

    it('a shorter vent gives a higher tuning frequency', () => {
      const Fb_short = engine.vent.tuningFromLength(Vb_m3, 0.05, Sp_m2, 1, AIR); // 50 mm vent
      const Fb_long  = engine.vent.tuningFromLength(Vb_m3, 0.20, Sp_m2, 1, AIR); // 200 mm vent
      assert.ok(Fb_short > Fb_long,
        `50 mm vent Fb=${Fb_short.toFixed(1)} Hz should be higher than 200 mm vent Fb=${Fb_long.toFixed(1)} Hz`);
    });

    it('a larger box with the same vent gives a lower tuning frequency', () => {
      // Larger box → more compliance → lower resonance.
      const Fb_small = engine.vent.tuningFromLength(0.010, 0.10, Sp_m2, 1, AIR); // 10 L box
      const Fb_large = engine.vent.tuningFromLength(0.040, 0.10, Sp_m2, 1, AIR); // 40 L box
      assert.ok(Fb_small > Fb_large,
        `10 L box Fb=${Fb_small.toFixed(1)} Hz should be higher than 40 L box Fb=${Fb_large.toFixed(1)} Hz`);
    });

    it('matches the Helmholtz formula directly with the same vent dimensions', () => {
      // Manually compute the expected Fb using the Helmholtz formula.
      const L_m = 0.12; // 120 mm vent
      const d   = 2 * Math.sqrt(Sp_m2 / Math.PI);
      const Leff = L_m + END_CORRECTION * d; // end correction
      const Cab  = Vb_m3 / (refRho() * refC() * refC());
      const Map  = refRho() * Leff / Sp_m2;
      const EXPECTED_Fb = 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
      const actual = engine.vent.tuningFromLength(Vb_m3, L_m, Sp_m2, 1, AIR);
      assert.ok(Math.abs(actual - EXPECTED_Fb) < EXACT,
        `actual ${actual.toFixed(6)} Hz vs expected ${EXPECTED_Fb.toFixed(6)} Hz`);
    });

  });

  describe('air sensitivity', () => {
    it('ventLength gives a different length at a non-reference air pair', () => {
      const atReference = engine.vent.lengthForTuning(0.03, 35, 0.002, 1, REFERENCE_AIR);
      const atHot = engine.vent.lengthForTuning(0.03, 35, 0.002, 1, HOT_AIR);
      expect(atHot).not.toBeCloseTo(atReference, 6);
    });

    it('tuningFromLength gives a different tuning at a non-reference air pair', () => {
      const atReference = engine.vent.tuningFromLength(0.03, 0.1, 0.002, 1, REFERENCE_AIR);
      const atHot = engine.vent.tuningFromLength(0.03, 0.1, 0.002, 1, HOT_AIR);
      expect(atHot).not.toBeCloseTo(atReference, 6);
    });

    it('ventLength and tuningFromLength still round-trip at a fixed, explicit air pair', () => {
      const L = engine.vent.lengthForTuning(0.03, 35, 0.002, 1, HOT_AIR);
      const back = engine.vent.tuningFromLength(0.03, L, 0.002, 1, HOT_AIR);
      expect(back).toBeCloseTo(35, 6);
    });
  });
});
