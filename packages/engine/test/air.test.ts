/**
 * Moist-air properties — the ONE model of ρ and c from temperature, relative humidity and
 * static pressure, and the WinISD-parity mode that ignores the last two (ledger QO7/QO24.8).
 *
 * 🔒 ORACLE: WinISD's own stored pair, `c = 343.684120962153 m/s` and
 * `roo = 1.20095217714682 kg/m³` (winisd_research/CALC_FINDINGS_FOR_REVIEW.md §"WinISD
 * persists temperature, air pressure and relative humidity, and does not use them",
 * files `runs/env_sample1.wpr` … `runs/env_sample7.wpr`). Those 15 digits satisfy
 * `ρ·c² = γ·p` with γ = 1.4 to 1.2e-15 relative, which is the relation this model is built on.
 *
 * Reproducing that pair from 293.15 K / 30 % RH / 101325 Pa IS the correctness test for the
 * formulation: agreement is a few parts per million, not a fit.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  moistAirDensity, moistAirSoundVelocity, airFor, GAMMA,
  saturationVapourPressure, waterVapourMoleFraction,
  splReferenceConstantDb, RHO, C,
  sweep, deriveDriver,
  type SweepParams, type DriverRaw,
} from '@openisd/engine';

/** WinISD's own stored air, to all 15 digits it writes. */
const WINISD_C   = 343.684120962153;
const WINISD_RHO = 1.20095217714682;

/** WinISD's Advanced-pane defaults, the point at which the two must agree. */
const T0 = 293.15, RH0 = 30, P_ATM = 101325;

const ppm = (got: number, expected: number) => Math.abs((got - expected) / expected) * 1e6;

describe('moist air — ρ and c from T, RH, p', () => {
  it('reproduces WinISD c to under 5 ppm and ρ to under 10 ppm at 293.15 K / 30 % / 101325 Pa', () => {
    const rho = moistAirDensity(T0, RH0, P_ATM);
    const c   = moistAirSoundVelocity(T0, RH0, P_ATM);
    assert.ok(ppm(c,   WINISD_C)   < 5,  `c is ${c} — ${ppm(c, WINISD_C).toFixed(2)} ppm from WinISD's ${WINISD_C}`);
    assert.ok(ppm(rho, WINISD_RHO) < 10, `ρ is ${rho} — ${ppm(rho, WINISD_RHO).toFixed(2)} ppm from WinISD's ${WINISD_RHO}`);
  });

  it('satisfies ρ·c² = γ·p exactly — the relation WinISD\'s own files hold to 1.2e-15', () => {
    for (const [T, rh, p] of [[T0, RH0, P_ATM], [303.15, 80, 90000], [278.15, 0, 105000]]) {
      const rho = moistAirDensity(T, rh, p);
      const c   = moistAirSoundVelocity(T, rh, p);
      assert.ok(Math.abs(rho * c * c / (GAMMA * p) - 1) < 1e-14, `ρc²/γp at ${T} K ${rh} % ${p} Pa`);
    }
  });

  it('saturation vapour pressure at 20 °C is ~2339 Pa, and mole fraction scales with RH', () => {
    assert.ok(Math.abs(saturationVapourPressure(T0) - 2339) < 1, `psv = ${saturationVapourPressure(T0)}`);
    assert.equal(waterVapourMoleFraction(T0, 0, P_ATM), 0);
    const x30 = waterVapourMoleFraction(T0, 30, P_ATM);
    const x60 = waterVapourMoleFraction(T0, 60, P_ATM);
    assert.ok(Math.abs(x60 / x30 - 2) < 1e-12, 'mole fraction is linear in relative humidity');
  });

  it('drier and higher-pressure air is denser; humidity raises c', () => {
    assert.ok(moistAirDensity(T0, 0, P_ATM)   > moistAirDensity(T0, 100, P_ATM));
    assert.ok(moistAirDensity(T0, RH0, 105000) > moistAirDensity(T0, RH0, 90000));
    assert.ok(moistAirSoundVelocity(T0, 100, P_ATM) > moistAirSoundVelocity(T0, 0, P_ATM));
  });

  it('20 °C → 30 °C at 30 % RH moves the SPL constant K by about 0.077 dB', () => {
    const k = (T: number) => splReferenceConstantDb(moistAirDensity(T, RH0, P_ATM), moistAirSoundVelocity(T, RH0, P_ATM));
    const dK = k(303.15) - k(T0);
    assert.ok(Math.abs(dK) > 0.06 && Math.abs(dK) < 0.09, `ΔK = ${dK} dB — expected the ~0.073 dB order recorded in CALC_FINDINGS`);
  });
});

describe('airFor — the single dispatch every sweep and circuit call goes through', () => {
  it('defaults to the physical model: absent env fields mean 293.15 K / 30 % / 101325 Pa', () => {
    const a = airFor({});
    assert.equal(a.rho, moistAirDensity(T0, RH0, P_ATM));
    assert.equal(a.c,   moistAirSoundVelocity(T0, RH0, P_ATM));
  });

  it('honours humidity and pressure by default', () => {
    const dry  = airFor({ humidityPct: 0,   pressurePa: P_ATM });
    const wet  = airFor({ humidityPct: 100, pressurePa: P_ATM });
    const low  = airFor({ humidityPct: RH0, pressurePa: 90000 });
    assert.ok(dry.rho > wet.rho, 'humidity must change ρ');
    assert.ok(low.rho < dry.rho, 'pressure must change ρ');
  });

  it('ignoreHumidityAndPressure reproduces WinISD: the constants, scaled by temperature only', () => {
    const a = airFor({ ignoreHumidityAndPressure: true });
    assert.equal(a.rho, RHO);
    assert.equal(a.c,   C);
    // Humidity and pressure are then inert — the whole point of the toggle.
    const b = airFor({ ignoreHumidityAndPressure: true, humidityPct: 95, pressurePa: 88000 });
    assert.equal(b.rho, a.rho);
    assert.equal(b.c,   a.c);
    // Temperature still scales it, which is openisd's pre-existing behaviour.
    const hot = airFor({ ignoreHumidityAndPressure: true, tempK: 303.15 });
    assert.ok(hot.rho < a.rho && hot.c > a.c);
  });
});

describe('the sweep actually consumes humidity and pressure', () => {
  const RAW: DriverRaw = { Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas: 0.030, Sd: 0.0133, Re: 5.6, Xmax: 0.005, Pe: 60 };
  const BASE: SweepParams = { Vb: 0.020, Ql: 7, eg: 2.83, fmin: 20, fmax: 200, N: 40 };
  const drv = deriveDriver(RAW).value!;
  const splAt = (P: SweepParams) => sweep(drv, 'sealed', P).spl;
  const maxAbsDelta = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

  it('changing relative humidity changes SPL — the input is not inert', () => {
    const d = maxAbsDelta(splAt({ ...BASE, humidityPct: 0 }), splAt({ ...BASE, humidityPct: 100 }));
    assert.ok(d > 1e-4, `humidity moved SPL by ${d} dB — an inert input moves it by 0`);
  });

  it('changing air pressure changes SPL — the input is not inert', () => {
    const d = maxAbsDelta(splAt({ ...BASE, pressurePa: 90000 }), splAt({ ...BASE, pressurePa: 105000 }));
    assert.ok(d > 0.1, `pressure moved SPL by ${d} dB`);
  });

  it('with the WinISD toggle on, humidity and pressure move nothing at all', () => {
    const a = splAt({ ...BASE, ignoreHumidityAndPressure: true, humidityPct: 0,   pressurePa: 90000 });
    const b = splAt({ ...BASE, ignoreHumidityAndPressure: true, humidityPct: 100, pressurePa: 105000 });
    assert.deepEqual(a, b);
  });

  it('the cost of the toggle is the ~0.073 dB order the ledger predicts, at 30 °C', () => {
    const hot  = { ...BASE, tempK: 303.15 };
    const d = maxAbsDelta(splAt(hot), splAt({ ...hot, ignoreHumidityAndPressure: true }));
    assert.ok(d < 0.15, `physical vs WinISD air differ by ${d} dB at 30 °C — far more than the predicted 0.073 dB`);
  });
});
