/**
 * Unit tests for src/core/circuit.js — targeting the branch coverage gaps
 * not covered by engine.test.mjs:
 *   - circuitModel = 'gyrator' (Le included in acoustic circuit)
 *   - Ql / Qa parameter defaults (10 and 100 respectively)
 *   - prRms = 0 (lossless passive radiator mechanical damping)
 *   - prNum > 1 (multiple PRs in parallel)
 *
 * Run: node --test test/circuit.test.mjs
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { solve } from '@resonate/engine';
import { deriveDriver } from '@resonate/engine';
import { cAbs } from '@resonate/engine';

// Reference driver: synthetic 6.5" mid-woofer, identical to engine.test.mjs
const RAW_DRIVER = {
  Fs:   37,       // Hz  — free-air resonance
  Qts:  0.38,     // —   — total Q at Fs
  Qes:  0.40,     // —   — electrical Q at Fs
  Qms:  7.0,      // —   — mechanical Q at Fs
  Vas:  0.030,    // m³  — equivalent compliance volume (= 30 L)
  Sd:   0.0133,   // m²  — effective piston area
  Re:   5.6,      // Ω   — voice-coil DC resistance
  Le:   0.7e-3,   // H   — voice-coil inductance (0.7 mH — significant above ~1 kHz)
  Xmax: 0.005,    // m   — peak linear excursion
  Pe:   60,       // W   — rated power
  Z:    8,        // Ω   — nominal impedance
};
const { value: DRV, errors: _drvErrors } = deriveDriver(RAW_DRIVER);
if (!DRV) throw new Error('RAW_DRIVER derivation failed — check T/S params: ' + _drvErrors.map(e => e.message).join('; '));

// Sealed box parameters for most tests — lossless (Ql → ∞) to isolate circuit model effects
const VB_M3 = 0.030;  // 30 L — equal to Vas for Qtc ≈ 0.537

// Test frequency where Le has appreciable effect: ωLe = 2π×1000×0.7e-3 ≈ 4.4 Ω
// This is ~79% of Re = 5.6 Ω, making gyrator vs. non-gyrator diverge noticeably.
const FREQ_LE_SIGNIFICANT_HZ = 1000;

// Test frequency in the passband where gyrator effect is small
const FREQ_PASSBAND_HZ = 100;

// Voltage excitation — 1 W into 8 Ω = 2.83 V (IEC 60268-5 sensitivity standard)
const EG = 2.83;

// Finite but non-physical Ql (Ql → ∞ = lossless)
const QL_LOSSLESS = 1e6;

// Tolerance for raw volume velocity comparisons — the gyrator and default models
// should differ by more than 1% at 1 kHz (Le dominates the difference).
const RELATIVE_DIFFER_THRESHOLD = 0.01;  // 1 % minimum expected divergence

// ── wiring = 'series' ────────────────────────────────────────────────────────

describe("solve — wiring = 'series' scales ZcoilAC × n and Bl × n", () => {
  it('two drivers in series produce a different acoustic output than two in parallel — '
   + 'series doubles coil impedance and Bl, shifting output', () => {
    // Series: ZcoilAC = ZcoilAC_single × n, Bl = Bl_single × n.
    // Parallel (default): ZcoilAC = ZcoilAC_single / n, Bl = Bl_single.
    // At the same voltage, two drivers in series and parallel behave differently
    // (series pair has 2× the Bl contribution from each driver but also 2× impedance).
    const N_DRIVERS = 2;  // two drivers — ensures the branch is exercised
    const P = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG, nDrivers: N_DRIVERS };
    const rParallel = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', { ...P, wiring: 'parallel' });
    const rSeries   = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', { ...P, wiring: 'series'   });
    const u0Parallel = cAbs(rParallel.U0);
    const u0Series   = cAbs(rSeries.U0);
    assert(isFinite(u0Parallel) && isFinite(u0Series),
      'both wiring modes must produce finite U0');
    // Series and parallel give different output — exact ratio depends on Re/Bl/Zel interaction
    assert.notEqual(
      u0Parallel.toFixed(10), u0Series.toFixed(10),
      "series wiring must produce a different acoustic output than parallel at the same voltage",
    );
  });
});

// ── circuitModel = 'gyrator' ──────────────────────────────────────────────────

describe('solve — circuitModel = gyrator includes Le in the acoustic circuit', () => {
  it('gyrator model returns a finite volume velocity at passband frequencies — basic sanity', () => {
    // In the gyrator model, Le is part of the acoustic path (ZcoilForAC = Zcoil, not ZcoilAC).
    // At 100 Hz, ωLe ≈ 0.44 Ω — small but the model must still converge.
    const r = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG, circuitModel: 'gyrator',
    });
    const u0 = cAbs(r.U0);
    assert(isFinite(u0) && u0 > 0, `gyrator U0 magnitude must be positive finite, got ${u0}`);
  });

  it('gyrator model produces a different acoustic response than the default model at 1 kHz — '
   + 'Le = 0.7 mH causes ≥1% divergence at 1 kHz where ωLe ≈ 4.4 Ω ≈ 79% of Re', () => {
    const P = { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG };
    const rDefault = solve(FREQ_LE_SIGNIFICANT_HZ, DRV, 'sealed', P);
    const rGyrator = solve(FREQ_LE_SIGNIFICANT_HZ, DRV, 'sealed', { ...P, circuitModel: 'gyrator' });
    const u0Default = cAbs(rDefault.U0);
    const u0Gyrator = cAbs(rGyrator.U0);
    const relativeDiff = Math.abs(u0Default - u0Gyrator) / u0Default;
    assert(
      relativeDiff > RELATIVE_DIFFER_THRESHOLD,
      `gyrator and default must diverge by >${RELATIVE_DIFFER_THRESHOLD * 100}% at ${FREQ_LE_SIGNIFICANT_HZ} Hz; `
    + `got ${(relativeDiff * 100).toFixed(2)}% (default U0=${u0Default.toExponential(3)}, `
    + `gyrator U0=${u0Gyrator.toExponential(3)})`,
    );
  });
});

// ── Ql and Qa parameter defaults ─────────────────────────────────────────────

describe('solve — Ql and Qa parameter defaults', () => {
  it('omitting Ql gives the same result as Ql=10 — Ql defaults to 10 when absent', () => {
    // The guard `P.Ql || 10` makes solve() behave identically whether the caller
    // omits Ql or explicitly passes 10. Both must produce the same U0.
    const P_explicit = { Vb: VB_M3, Ql: 10, Qa: 100, eg: EG };
    const P_default  = { Vb: VB_M3,          Qa: 100, eg: EG };  // Ql absent → defaults to 10
    const rExplicit = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', P_explicit);
    const rDefault  = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', P_default);
    assert.equal(
      cAbs(rExplicit.U0).toFixed(15),
      cAbs(rDefault.U0).toFixed(15),
      'Ql=10 explicit must equal Ql absent (default 10)',
    );
  });

  it('omitting Qa gives the same result as Qa=100 — Qa defaults to 100 when absent', () => {
    // The guard `P.Qa || 100` makes Qa=100 the default absorption Q.
    const P_explicit = { Vb: VB_M3, Ql: 10, Qa: 100, eg: EG };
    const P_default  = { Vb: VB_M3, Ql: 10,          eg: EG };  // Qa absent → defaults to 100
    const rExplicit = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', P_explicit);
    const rDefault  = solve(FREQ_PASSBAND_HZ, DRV, 'sealed', P_default);
    assert.equal(
      cAbs(rExplicit.U0).toFixed(15),
      cAbs(rDefault.U0).toFixed(15),
      'Qa=100 explicit must equal Qa absent (default 100)',
    );
  });
});

// ── Passive radiator: multiple PRs and zero damping ───────────────────────────

// PR parameters: same piston area as driver, mass chosen so Fp ≈ Fs = 37 Hz
// Using driver Cms so Fp = 1/(2π·√(Map·Cap)) ≈ Fs when prMmd and prCms are set appropriately.
const PR_BASE = {
  Vb:     VB_M3,        // m³ — rear box volume
  Ql:     QL_LOSSLESS,  // lossless box leakage
  Qa:     100,          // —  — box absorption Q
  eg:     EG,           // V  — excitation voltage
  prSd:   DRV.Sd,       // m² — PR piston area = driver piston area
  prMmd:  0.050,        // kg — PR moving mass (lighter than driver → higher Fp)
  prMadd: 0.000,        // kg — no added mass
  prCms:  DRV.Cms,      // m/N — PR compliance (same as driver)
  prRms:  1.0,          // kg/s — PR mechanical damping
};

describe('solve — passive radiator with multiple PRs (prNum > 1)', () => {
  it('prNum=2 gives a different response than prNum=1 — '
   + 'two PRs in parallel halve the combined acoustic mass, shifting Fp up', () => {
    const r1 = solve(FREQ_PASSBAND_HZ, DRV, 'pr', { ...PR_BASE, prNum: 1 });
    const r2 = solve(FREQ_PASSBAND_HZ, DRV, 'pr', { ...PR_BASE, prNum: 2 });
    const u0_1 = cAbs(r1.U0), u0_2 = cAbs(r2.U0);
    assert(isFinite(u0_1) && isFinite(u0_2), 'both prNum=1 and prNum=2 must produce finite U0');
    assert.notEqual(
      u0_1.toFixed(10), u0_2.toFixed(10),
      'prNum=2 must produce a different acoustic response than prNum=1',
    );
  });
});

// ── bandpass4 box type ────────────────────────────────────────────────────────

describe('solve — 4th-order bandpass box (rear sealed + front vented)', () => {
  it('bandpass4 produces a finite output volume velocity from the front vent — '
   + 'U0 = UP (vent output, not UD), both must be non-zero', () => {
    // Bandpass4: driver fires into a sealed rear chamber (Vb) and a vented front
    // chamber (Vf). U0 = UP (port output) — the driver is entirely enclosed.
    // Parameters from the golden fixture bandpass4-single.json.
    const VB_REAR_M3  = 0.015;   // m³ — rear sealed chamber (15 L)
    const VF_FRONT_M3 = 0.020;   // m³ — front vented chamber (20 L)
    const SP_M2 = 0.001963495408493621;  // m² — port area (ø50mm round port)
    const LEFF_M = 0.15;         // m — effective port length (150 mm)
    const QL = 7;                // —  — box leakage Q
    const EG_V = 2.83;           // V  — standard sensitivity excitation

    const r = solve(FREQ_PASSBAND_HZ, DRV, 'bandpass4', {
      Vb: VB_REAR_M3, Vf: VF_FRONT_M3,
      Ql: QL, Sp: SP_M2, Leff: LEFF_M,
      eg: EG_V,
    });

    const u0 = cAbs(r.U0);
    const up = cAbs(r.UP);
    assert(isFinite(u0), `bandpass4 U0 must be finite, got ${u0}`);
    assert(isFinite(up), `bandpass4 UP must be finite, got ${up}`);
    // In bandpass4, U0 === UP (output is entirely from the vent)
    assert.equal(u0, up, 'bandpass4 U0 must equal UP (output comes from the front vent only)');
  });
});

describe('solve — passive radiator with no mechanical damping (prRms absent)', () => {
  it('absent prRms (= no PR mechanical damping) uses 0 — result must still be finite', () => {
    // `(P.prRms || 0)` → Rap = 0/Sd² = 0 — lossless PR mechanical damping.
    // The acoustic circuit remains well-formed (Ral/Raa still provide damping).
    const P_noRms = { ...PR_BASE };
    delete P_noRms.prRms;  // triggers (P.prRms || 0) → 0
    const r = solve(FREQ_PASSBAND_HZ, DRV, 'pr', P_noRms);
    const u0 = cAbs(r.U0);
    assert(isFinite(u0) && u0 > 0, `U0 must be finite and positive without prRms, got ${u0}`);
  });
});
