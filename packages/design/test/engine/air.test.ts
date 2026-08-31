/**
 * Moist-air properties — the ONE model of ρ and c from temperature, relative humidity and
 * static pressure, and the WinISD-parity mode that swaps in WinISD's air equation set
 * for the parity calculation (ledger QO7/QO24.8).
 *
 * 🔒 ORACLE: WinISD's own stored pair, `c = 343.684120962152 m/s` and
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
import { Engine } from '../../engine/index.js';
import type { SweepParams } from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = undefined;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

/** WinISD's own stored air, to all 15 digits it writes. */
const WINISD_C   = 343.684120962152;
const WINISD_RHO = 1.20095217714682;

/** WinISD's Advanced-pane defaults, the point at which the two must agree. */
const T0 = 293.15, RH0 = 30, P_ATM = 101325;

/** Ratio of specific heats for air — the constant the oracle's own ρ·c² = γ·p holds against. */
const GAMMA = 1.4;

const ppm = (got: number, expected: number) => Math.abs((got - expected) / expected) * 1e6;

/** K, the additive constant of `SPL = K + 10·log₁₀(η₀)`: at η₀ = 1 the log term is 0, so the
 *  engine's own SPL conversion reports K itself. */
const kDb = (air: { rho: number; c: number }) => engine.splFromEfficiency(1, air);

describe('moist air — ρ and c from T, RH, p', () => {
  it('reproduces WinISD c to under 5 ppm and ρ to under 10 ppm at 293.15 K / 30 % / 101325 Pa', () => {
    const { rho, c } = engine.airFor({ tempK: T0, humidityPct: RH0, pressurePa: P_ATM });
    assert.ok(ppm(c,   WINISD_C)   < 5,  `c is ${c} — ${ppm(c, WINISD_C).toFixed(2)} ppm from WinISD's ${WINISD_C}`);
    assert.ok(ppm(rho, WINISD_RHO) < 10, `ρ is ${rho} — ${ppm(rho, WINISD_RHO).toFixed(2)} ppm from WinISD's ${WINISD_RHO}`);
  });

  it('satisfies ρ·c² = γ·p exactly — the relation WinISD\'s own files hold to 1.2e-15', () => {
    for (const [T, rh, p] of [[T0, RH0, P_ATM], [303.15, 80, 90000], [278.15, 0, 105000]]) {
      const { rho, c } = engine.airFor({ tempK: T, humidityPct: rh, pressurePa: p });
      assert.ok(Math.abs(rho * c * c / (GAMMA * p!) - 1) < 1e-14, `ρc²/γp at ${T} K ${rh} % ${p} Pa`);
    }
  });

  it('drier and higher-pressure air is denser; humidity raises c', () => {
    const dry    = engine.airFor({ tempK: T0, humidityPct: 0,   pressurePa: P_ATM });
    const wet    = engine.airFor({ tempK: T0, humidityPct: 100, pressurePa: P_ATM });
    const high   = engine.airFor({ tempK: T0, humidityPct: RH0, pressurePa: 105000 });
    const low    = engine.airFor({ tempK: T0, humidityPct: RH0, pressurePa: 90000 });
    assert.ok(dry.rho > wet.rho);
    assert.ok(high.rho > low.rho);
    assert.ok(wet.c > dry.c);
  });

  it('20 °C → 30 °C at 30 % RH moves the SPL constant K by about 0.077 dB', () => {
    const dK = kDb(engine.airFor({ tempK: 303.15, humidityPct: RH0, pressurePa: P_ATM }))
             - kDb(engine.airFor({ tempK: T0,     humidityPct: RH0, pressurePa: P_ATM }));
    assert.ok(Math.abs(dK) > 0.06 && Math.abs(dK) < 0.09, `ΔK = ${dK} dB — expected the ~0.073 dB order recorded in CALC_FINDINGS`);
  });
});

describe('airFor — the single dispatch every sweep and circuit call goes through', () => {
  it('defaults to the physical model: absent env fields mean 293.15 K / 30 % / 101325 Pa', () => {
    const a = engine.airFor({});
    const stated = engine.airFor({ tempK: T0, humidityPct: RH0, pressurePa: P_ATM });
    assert.equal(a.rho, stated.rho);
    assert.equal(a.c,   stated.c);
  });

  it('honours humidity and pressure by default', () => {
    const dry  = engine.airFor({ humidityPct: 0,   pressurePa: P_ATM });
    const wet  = engine.airFor({ humidityPct: 100, pressurePa: P_ATM });
    const low  = engine.airFor({ humidityPct: RH0, pressurePa: 90000 });
    assert.ok(dry.rho > wet.rho, 'humidity must change ρ');
    assert.ok(low.rho < dry.rho, 'pressure must change ρ');
  });

  // EVERY ROW HERE WAS MEASURED, not derived. `winisd_research` FINDING-008: the app-level
  // environment was written into WinISD's own settings.ini before the launch that observed it,
  // and c/roo were read out of the .wpr it wrote, at 15 significant digits
  // (runs/qo93_air_output/results.jsonl, toys/qo93_air_output_probe.py).
  //
  // Six environments, each moving ONE input away from the factory point, so a model that gets
  // one input's dependence wrong cannot pass by getting another's right.
  const MEASURED = [
    { T: 293.15, RH: 30, P: 101325, c: 343.684120962153, rho: 1.20095217714682 },
    { T: 313.15, RH: 30, P: 101325, c: 356.223844028178, rho: 1.11788898381182 },
    { T: 273.15, RH: 30, P: 101325, c: 331.432207160196, rho: 1.29138349092275 },
    { T: 293.15, RH: 80, P: 101325, c: 344.437969001986, rho: 1.19570104456042 },
    { T: 293.15, RH:  0, P: 101325, c: 343.234181075929, rho: 1.20410285669867 },
    { T: 293.15, RH: 30, P:  95000, c: 343.714140348792, rho: 1.12578858900353 },
  ];

  it('useWinisdAirModel reproduces REAL WinISD at every measured environment, EXACTLY', () => {
    // 1e-6 ppm is 1e-12 relative. Not a tolerance chosen to let the implementation through: the
    // worst residual across all six is 2.5e-15, so there are nearly three orders of magnitude of
    // headroom, and anything that actually changes the model fails.
    //
    // Two earlier implementations fail this by a wide margin, which is the point of the bar:
    // the constant-multiplier version is out by up to 12 ppm, and using Hyland-Wexler's LIQUID
    // constants at 273.15 K instead of its ICE set is out by 23 ppb.
    for (const m of MEASURED) {
      const air = engine.airFor({
        useWinisdAirModel: true, tempK: m.T, humidityPct: m.RH, pressurePa: m.P,
      });
      assert.ok(ppm(air.c, m.c) < 1e-6,
        `c at T=${m.T} RH=${m.RH} P=${m.P} is ${air.c} — ${ppm(air.c, m.c).toFixed(4)} ppm from the measured ${m.c}`);
      assert.ok(ppm(air.rho, m.rho) < 1e-6,
        `rho at T=${m.T} RH=${m.RH} P=${m.P} is ${air.rho} — ${ppm(air.rho, m.rho).toFixed(4)} ppm from the measured ${m.rho}`);
    }
  });

  it('in WinISD-parity mode density is derived from c by gamma*p/c^2, not from an air model', () => {
    // The structural finding, and the reason five candidate DENSITY models were all rejected:
    // WinISD never computes density from air at all. Real WinISD's own saved pairs satisfy this
    // to ~2e-15, so the implementation must satisfy it exactly rather than approximately.
    for (const m of MEASURED) {
      const air = engine.airFor({
        useWinisdAirModel: true, tempK: m.T, humidityPct: m.RH, pressurePa: m.P,
      });
      assert.ok(ppm(air.rho, 1.4 * m.P / (air.c * air.c)) < 1e-6,
        `rho at T=${m.T} is ${air.rho}, but gamma*p/c^2 gives ${1.4 * m.P / (air.c * air.c)}`);
    }
  });

  it('the PHYSICAL model is NOT the WinISD one — they must not have been quietly merged', () => {
    // Non-vacuity for the pair of tests above: if both branches returned the same thing, every
    // parity assertion here would pass while the default mode silently stopped doing CIPM-2007.
    const physics = engine.airFor({ tempK: T0, humidityPct: RH0, pressurePa: P_ATM });
    const winisd = engine.airFor({ useWinisdAirModel: true, tempK: T0, humidityPct: RH0, pressurePa: P_ATM });
    assert.notEqual(physics.c, winisd.c);
    assert.notEqual(physics.rho, winisd.rho);
  });

  it('useWinisdAirModel still varies with humidity, pressure AND temperature away from the reference conditions — the engine computes from whatever environment the caller supplies (the UI supplies its app-level Options-equivalent in this mode, §12/§13), and divergence from the bridge constant off-defaults is ruled correct, not a defect (QO88)', () => {
    const atRef = engine.airFor({ useWinisdAirModel: true });
    const humid = engine.airFor({ useWinisdAirModel: true, humidityPct: 95, pressurePa: 88000 });
    assert.notEqual(humid.rho, atRef.rho, 'humidity/pressure must move the WinISD parity result away from the reference conditions');
    assert.notEqual(humid.c,   atRef.c);
    const hot = engine.airFor({ useWinisdAirModel: true, tempK: 303.15 });
    assert.ok(hot.rho < atRef.rho && hot.c > atRef.c);
  });
});

describe('the sweep actually consumes humidity and pressure', () => {
  const RAW = { Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas: 0.030, Sd: 0.0133, Re: 5.6, Xmax: 0.005, Pe: 60 };
  const BASE: SweepParams = { Vb: 0.020, Ql: 7, eg: 2.83, fmin: 20, fmax: 200, N: 40 };
  const drv = engine.deriveEngineDriver(RAW).value!;
  const splAt = (P: SweepParams) => engine.sweep(drv, LE_H, 'sealed', P).value!.spl;
  const maxAbsDelta = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

  it('changing relative humidity changes SPL — the input is not inert', () => {
    const d = maxAbsDelta(splAt({ ...BASE, humidityPct: 0 }), splAt({ ...BASE, humidityPct: 100 }));
    assert.ok(d > 1e-4, `humidity moved SPL by ${d} dB — an inert input moves it by 0`);
  });

  it('changing air pressure changes SPL — the input is not inert', () => {
    const d = maxAbsDelta(splAt({ ...BASE, pressurePa: 90000 }), splAt({ ...BASE, pressurePa: 105000 }));
    assert.ok(d > 0.1, `pressure moved SPL by ${d} dB`);
  });

  it('with the WinISD toggle on, the humidity and pressure the sweep is HANDED still move SPL (QO88) — the engine ignores nothing itself; the UI decides which environment (app-level Options-equivalent) reaches it in this mode', () => {
    const a = splAt({ ...BASE, useWinisdAirModel: true, humidityPct: 0,   pressurePa: 90000 });
    const b = splAt({ ...BASE, useWinisdAirModel: true, humidityPct: 100, pressurePa: 105000 });
    const d = maxAbsDelta(a, b);
    assert.ok(d > 0, `humidity/pressure moved SPL by ${d} dB under the toggle — an inert input moves it by exactly 0`);
  });

  it('the cost of the toggle is the ~0.073 dB order the ledger predicts, at 30 °C', () => {
    const hot  = { ...BASE, tempK: 303.15 };
    const d = maxAbsDelta(splAt(hot), splAt({ ...hot, useWinisdAirModel: true }));
    assert.ok(d < 0.15, `physical vs WinISD air differ by ${d} dB at 30 °C — far more than the predicted 0.073 dB`);
  });
});
