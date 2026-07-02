/**
 * Direct unit tests for src/core/alignments.js
 *
 * Each test describes the physical scenario and the expected outcome in terms
 * a loudspeaker designer would recognise.  All numeric constants are named
 * and explained — no magic numbers.
 *
 * References used in this file (verified to exist):
 *   [T71]  Thiele, A.N. "Loudspeakers in Vented Boxes, Part I." JAES 19(5) 1971.
 *          https://aes.org/e-lib/browse.cfm?elib=1967
 *   [S72a] Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
 *          https://aes.org/e-lib/browse.cfm?elib=2062
 *   [S73]  Small, R.H. "Vented-Box Loudspeaker Systems — Part I." JAES 21(5) 1973.
 *          https://aes.org/e-lib/browse.cfm?elib=2149
 *   [S74]  Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
 *          https://aes.org/e-lib/browse.cfm?elib=2223
 *   [Wiki-TS] https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   [Wiki-Hz] https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * Run: node --test test/alignments.test.mjs
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  ebp,
  sealedFromQtc,
  ventedAlignment,
  ventLength,
  tuningFromLength,
  prTuning,
  prMassForFp,
} from '@resonate/engine';
import { RHO, C } from '@resonate/engine';

// ---------------------------------------------------------------------------
// Test driver: a typical 6.5" mid-woofer — same parameters used throughout
// the test suite so results are comparable.  All SI units.
// ---------------------------------------------------------------------------
const DRIVER = {
  Fs:  37,     // Hz
  Qts: 0.38,   // —
  Qes: 0.40,   // —
  Qms: 7.0,    // —
  Vas: 0.030,  // m³  (30 L)
  Sd:  0.0133, // m²
  Re:  5.6,    // Ω
};

// ---------------------------------------------------------------------------
// Tolerance constants — each is documented with its justification.
// ---------------------------------------------------------------------------

// 1e-9: floating-point result that should be analytically exact.
const EXACT = 1e-9;

// 0.01 Hz: sub-cent precision for computed frequencies.
// Speaker alignment frequencies are typically quoted to 1 Hz; this is 100× tighter.
const FREQ_TOLERANCE_HZ = 0.01;

// 0.001 L: volume precision.  Real enclosures are built to ±1 L at best.
const _VOL_TOLERANCE_LITRES = 0.001;

// 1 mm: vent-length precision.  Ports are cut to ±2 mm in practice.
const _VENT_LENGTH_TOLERANCE_MM = 1;


// ===========================================================================
// Efficiency Bandwidth Product (EBP)
// ===========================================================================

describe('Efficiency Bandwidth Product (EBP = Fs / Qes)', () => {

  it('calculates EBP = Fs / Qes for a typical vented-candidate driver', () => {
    // EBP = Fs / Qes is a quick screen:
    //   EBP < 50  → sealed preferred
    //   EBP > 100 → vented preferred
    //   50–100    → either works
    // Ref: [Wiki-TS]
    // For our test driver: Fs=37 Hz, Qes=0.40 → EBP = 92.5
    const EXPECTED_EBP = 37 / 0.40; // = 92.5
    assert.ok(Math.abs(ebp(DRIVER) - EXPECTED_EBP) < EXACT,
      `EBP should be Fs/Qes = ${EXPECTED_EBP}, got ${ebp(DRIVER)}`);
  });

  it('a driver with EBP = 37/0.40 = 92.5 sits in the borderline zone (50 < EBP < 100)', () => {
    // This is a sanity check that the result is physically meaningful.
    const result = ebp(DRIVER);
    assert.ok(result > 50 && result < 100,
      `EBP ${result.toFixed(1)} should be in the 50–100 borderline zone for this driver`);
  });

  it('a woofer with very low Qes (high Bl) has a high EBP — strongly vented-preferred', () => {
    // Very high Bl → very low Qes → very high EBP → strong vented preference.
    const highBlDriver = { ...DRIVER, Qes: 0.10 }; // Qes=0.10 is very high Bl
    const result = ebp(highBlDriver);
    assert.ok(result > 100,
      `High-Bl driver EBP ${result.toFixed(1)} should exceed 100 (vented preferred)`);
  });

});


// ===========================================================================
// Sealed box volume from target Qtc
// ===========================================================================

describe('Sealed box volume for a target system Q (sealedFromQtc)', () => {

  // Formula: Qtc = Qts·√(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
  // Ref: [S72a], [Wiki-TS]

  it('the Butterworth alignment (Qtc = 0.707 = 1/√2) gives the maximally-flat sealed box volume', () => {
    // For our driver: Qts=0.38, Vas=30 L
    //   Vb = 0.030 / ((0.707/0.38)² − 1)
    //      = 0.030 / (3.4636 − 1)  ≈ 0.01217 m³ ≈ 12.17 L
    const QTC_BUTTERWORTH = Math.SQRT1_2; // 1/√2 = 0.7071
    const Vb = sealedFromQtc(DRIVER, QTC_BUTTERWORTH);
    assert.ok(Vb !== null,
      'Butterworth alignment should be physically realisable for this driver');
    // Verify by rounding: Qtc from resulting Vb should equal 0.7071
    const Qtc_check = DRIVER.Qts * Math.sqrt(1 + DRIVER.Vas / Vb);
    assert.ok(Math.abs(Qtc_check - QTC_BUTTERWORTH) < EXACT,
      `Vb=${(Vb * 1000).toFixed(2)} L → Qtc=${Qtc_check.toFixed(6)} (expected ${QTC_BUTTERWORTH.toFixed(6)})`);
  });

  it('a higher Qtc target gives a smaller enclosure (less box compliance needed)', () => {
    // Higher Qtc = more boost = smaller box.
    // Qtc 0.9 > 0.707, so Vb(0.9) < Vb(0.707).
    const Vb_707 = sealedFromQtc(DRIVER, Math.SQRT1_2);
    const Vb_090 = sealedFromQtc(DRIVER, 0.9);
    assert.ok(Vb_090 < Vb_707,
      `Vb for Qtc=0.9 (${(Vb_090 * 1000).toFixed(1)} L) should be less than Vb for Qtc=0.707 (${(Vb_707 * 1000).toFixed(1)} L)`);
  });

  it('returns null when the target Qtc is below the driver Qts (physically impossible)', () => {
    // Qtc < Qts is not realisable — any finite box raises Qtc, not lowers it.
    // The formula gives (Qtc/Qts)² < 1, so the denominator is negative → null.
    const QTC_BELOW_QTS = DRIVER.Qts - 0.01; // just below Qts
    const result = sealedFromQtc(DRIVER, QTC_BELOW_QTS);
    assert.equal(result, null,
      `Qtc=${QTC_BELOW_QTS} < Qts=${DRIVER.Qts} should return null (unrealisable)`);
  });

  it('returns null when the target Qtc equals the driver Qts (infinite box — open baffle)', () => {
    // At Qtc = Qts exactly, the formula gives Vb = Vas / 0 → undefined (infinite box).
    const result = sealedFromQtc(DRIVER, DRIVER.Qts);
    assert.equal(result, null,
      `Qtc = Qts should return null (would require infinite box)`);
  });

});


// ===========================================================================
// QB3 vented alignment
// ===========================================================================

describe('QB3 vented alignment (ventedAlignment)', () => {

  // QB3 is a polynomial fit to Thiele's alignment tables.
  //   Vb = 15 · Vas · Qts^2.87
  //   Fb = Fs · √(Vas/Vb)
  // Ref: [T71], [S73]

  it('computes a non-zero box volume and tuning frequency', () => {
    const { Vb, Fb } = ventedAlignment(DRIVER);
    assert.ok(Vb > 0, `Vb should be positive, got ${Vb}`);
    assert.ok(Fb > 0, `Fb should be positive, got ${Fb}`);
  });

  it('QB3 box volume for this driver matches the formula Vb = 15·Vas·Qts^2.87', () => {
    const EXPECTED_Vb = 15 * DRIVER.Vas * Math.pow(DRIVER.Qts, 2.87);
    const { Vb } = ventedAlignment(DRIVER);
    assert.ok(Math.abs(Vb - EXPECTED_Vb) < EXACT,
      `Vb=${(Vb * 1000).toFixed(3)} L, expected ${(EXPECTED_Vb * 1000).toFixed(3)} L`);
  });

  it('tuning frequency Fb is in the same region as the driver free-air resonance Fs', () => {
    // The QB3 alignment tunes the port near Fs — the port frequency is on the order of Fs.
    // Whether Fb is above or below Fs depends on whether Vb < or > Vas respectively:
    //   Fb = Fs·√(Vas/Vb) → Fb > Fs when Vb < Vas, Fb < Fs when Vb > Vas.
    // We verify Fb is within a 2× range of Fs (i.e. between Fs/2 and 2·Fs).
    const { Fb } = ventedAlignment(DRIVER);
    assert.ok(Fb > DRIVER.Fs / 2 && Fb < DRIVER.Fs * 2,
      `QB3 Fb (${Fb.toFixed(1)} Hz) should be within 2× of Fs (${DRIVER.Fs} Hz)`);
  });

  it('the computed Fb satisfies Fb = Fs·√(Vas/Vb)', () => {
    const { Vb, Fb } = ventedAlignment(DRIVER);
    const EXPECTED_Fb = DRIVER.Fs * Math.sqrt(DRIVER.Vas / Vb);
    assert.ok(Math.abs(Fb - EXPECTED_Fb) < EXACT,
      `Fb=${Fb.toFixed(4)} Hz, formula gives ${EXPECTED_Fb.toFixed(4)} Hz`);
  });

});


// ===========================================================================
// Vent physical length from box + tuning frequency
// ===========================================================================

describe('Port / vent length calculation (ventLength)', () => {

  // Helmholtz resonator: f = (c/2π)·√(Sp/(Vb·L_eq))
  //   L_eq = L + 0.85·d  (end correction for one flanged open end)
  //   → L = Map·Sp/ρ − 0.85·d
  // Ref: [Wiki-Hz]

  const Vb_m3  = 0.020;  // m³ = 20 L
  const Fb_Hz  = 30;     // Hz target tuning
  const PORT_D_M = 0.050; // m = 50 mm diameter port
  const Sp_m2  = Math.PI * (PORT_D_M / 2) ** 2; // circular port area

  it('computes a positive vent length greater than 5 mm (physical minimum enforced)', () => {
    const L = ventLength(Vb_m3, Fb_Hz, Sp_m2);
    assert.ok(L >= 0.005,
      `Vent length ${(L * 1000).toFixed(1)} mm should be ≥ 5 mm (practical minimum)`);
  });

  it('a longer vent results in a lower tuning frequency (Fb ∝ 1/√Leff)', () => {
    // More duct length → more acoustic mass Map → lower resonance frequency.
    const L_short = ventLength(Vb_m3, 40, Sp_m2); // 40 Hz tuning
    const L_long  = ventLength(Vb_m3, 25, Sp_m2); // 25 Hz tuning (lower → longer vent)
    assert.ok(L_long > L_short,
      `Vent for 25 Hz (${(L_long * 1000).toFixed(0)} mm) should be longer than for 40 Hz (${(L_short * 1000).toFixed(0)} mm)`);
  });

  it('the computed vent length, fed back into tuningFromLength, reproduces the target Fb', () => {
    // This is the round-trip test: ventLength() and tuningFromLength() are inverses.
    const L       = ventLength(Vb_m3, Fb_Hz, Sp_m2);
    const Fb_back = tuningFromLength(Vb_m3, L, Sp_m2);
    assert.ok(Math.abs(Fb_back - Fb_Hz) < FREQ_TOLERANCE_HZ,
      `ventLength(${Fb_Hz} Hz) → ${(L * 1000).toFixed(1)} mm → tuningFromLength → ${Fb_back.toFixed(3)} Hz`);
  });

});


// ===========================================================================
// Port tuning frequency from physical vent dimensions
// ===========================================================================

describe('Port tuning frequency from vent dimensions (tuningFromLength)', () => {

  // Helmholtz formula: f = (c/2π)·√(Sp/(Vb·Leff)),  Leff = L + 0.85·d
  // Ref: [Wiki-Hz]

  const Vb_m3   = 0.020; // m³
  const PORT_D_M = 0.050; // m
  const Sp_m2   = Math.PI * (PORT_D_M / 2) ** 2;

  it('a shorter vent gives a higher tuning frequency', () => {
    const Fb_short = tuningFromLength(Vb_m3, 0.05, Sp_m2); // 50 mm vent
    const Fb_long  = tuningFromLength(Vb_m3, 0.20, Sp_m2); // 200 mm vent
    assert.ok(Fb_short > Fb_long,
      `50 mm vent Fb=${Fb_short.toFixed(1)} Hz should be higher than 200 mm vent Fb=${Fb_long.toFixed(1)} Hz`);
  });

  it('a larger box with the same vent gives a lower tuning frequency', () => {
    // Larger box → more compliance → lower resonance.
    const Fb_small = tuningFromLength(0.010, 0.10, Sp_m2); // 10 L box
    const Fb_large = tuningFromLength(0.040, 0.10, Sp_m2); // 40 L box
    assert.ok(Fb_small > Fb_large,
      `10 L box Fb=${Fb_small.toFixed(1)} Hz should be higher than 40 L box Fb=${Fb_large.toFixed(1)} Hz`);
  });

  it('matches the Helmholtz formula directly with the same vent dimensions', () => {
    // Manually compute the expected Fb using the Helmholtz formula.
    const L_m = 0.12; // 120 mm vent
    const d   = 2 * Math.sqrt(Sp_m2 / Math.PI);
    const Leff = L_m + 0.85 * d; // end correction
    const Cab  = Vb_m3 / (RHO * C * C);
    const Map  = RHO * Leff / Sp_m2;
    const EXPECTED_Fb = 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
    const actual = tuningFromLength(Vb_m3, L_m, Sp_m2);
    assert.ok(Math.abs(actual - EXPECTED_Fb) < EXACT,
      `actual ${actual.toFixed(6)} Hz vs expected ${EXPECTED_Fb.toFixed(6)} Hz`);
  });

});


// ===========================================================================
// Passive radiator tuning frequency
// ===========================================================================

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
  };

  it('in a very large box Fp approaches the PR free-air resonance Fs (lower bound)', () => {
    // As Cab → ∞ (huge box): Cpar = Cab·Cap/(Cab+Cap) → Cap.
    // So Fp → Fs_pr = 1/(2π·√(Mmd·Cms)) from above.
    // 1000 m³ is many orders of magnitude above any real enclosure.
    const VERY_LARGE_BOX = { ...BASE_PR, Vb: 1000 }; // 1000 m³ ≈ acoustically infinite
    const Fs_pr = 1 / (2 * Math.PI * Math.sqrt(BASE_PR.prMmd * BASE_PR.prCms));
    const Fp    = prTuning(VERY_LARGE_BOX);
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
    const Fp    = prTuning(BASE_PR);
    assert.ok(Fp > Fs_pr,
      `In-box Fp=${Fp.toFixed(1)} Hz should be above free-air Fs=${Fs_pr.toFixed(1)} Hz ` +
      `(box stiffness raises resonance)`);
  });

  it('adding mass to the PR reduces Fp (more mass → lower resonance)', () => {
    // Map = (Mmd + Madd) / Sd²; more mass → higher Map → lower Fp.
    const Fp_no_mass  = prTuning({ ...BASE_PR, prMadd: 0 });
    const Fp_20g_mass = prTuning({ ...BASE_PR, prMadd: 0.020 }); // add 20 g
    assert.ok(Fp_20g_mass < Fp_no_mass,
      `Adding 20 g lowers Fp from ${Fp_no_mass.toFixed(1)} Hz to ${Fp_20g_mass.toFixed(1)} Hz`);
  });

});


// ===========================================================================
// PR mass for target Fp (inverse of prTuning)
// ===========================================================================

describe('PR added-mass auto-tune (prMassForFp)', () => {

  const PR_PARAMS = {
    Vb:    0.020,
    prSd:  0.0133,
    prMmd: 0.010,
    prCms: 0.0008,
    prMadd: 0, // will be ignored — prMassForFp computes total mass
  };

  it('prMassForFp and prTuning are exact inverses — hitting 30 Hz target', () => {
    const TARGET_FP = 30; // Hz
    const total     = prMassForFp(PR_PARAMS, TARGET_FP);
    const achieved  = prTuning({ ...PR_PARAMS, prMadd: total - PR_PARAMS.prMmd });
    assert.ok(Math.abs(achieved - TARGET_FP) < 1e-6,
      `prMassForFp(30 Hz) → Madd=${((total - PR_PARAMS.prMmd) * 1000).toFixed(2)} g → prTuning → ${achieved.toFixed(6)} Hz`);
  });

  it('prMassForFp and prTuning are exact inverses — hitting 50 Hz target', () => {
    const TARGET_FP = 50; // Hz — higher target → less mass needed
    const total     = prMassForFp(PR_PARAMS, TARGET_FP);
    const achieved  = prTuning({ ...PR_PARAMS, prMadd: total - PR_PARAMS.prMmd });
    assert.ok(Math.abs(achieved - TARGET_FP) < 1e-6,
      `prMassForFp(50 Hz) → prTuning → ${achieved.toFixed(6)} Hz`);
  });

  it('a higher target Fp requires less added mass (less mass → higher resonance)', () => {
    const mass_30Hz = prMassForFp(PR_PARAMS, 30) - PR_PARAMS.prMmd;
    const mass_50Hz = prMassForFp(PR_PARAMS, 50) - PR_PARAMS.prMmd;
    assert.ok(mass_30Hz > mass_50Hz,
      `30 Hz needs ${(mass_30Hz * 1000).toFixed(1)} g > 50 Hz needs ${(mass_50Hz * 1000).toFixed(1)} g`);
  });

});
