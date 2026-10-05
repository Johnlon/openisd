/**
 * John's ruling (2026-10-05): a driver record's own speed of sound `c` and air density `roo` feed no
 * calculation. Every driver calculation uses the air of the project the driver sits in, or, with no
 * project, the project's delegate: the app's environment defaults (what a new project would get).
 * bugs/BUG_20260820_s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule.md.
 */
import {describe, expect, it} from 'vitest';
import {createEngine, DEFAULT_VENTED_DESIGN_LIMITS} from '../../engine/index.js';
import type {Engine} from '../../engine/index.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const TS = {Fs_hz: 32, Qes: 0.42, Qms: 4.1, Vas_m3: 0.055, Sd_m2: 0.0214, Re_ohm: 5.6} as const;
const STRANGE_AIR = {c_m_per_s: 350, roo_kg_per_m3: 1.1} as const;
/** The quantities the air reaches: compliance from Vas, and the efficiency figures. */
const AIR_DERIVED = ['Cms_m_per_N', 'Mms_kg', 'BL_Tm', 'no', 'SPL_dB'] as const;

function derived(driver: ReturnType<typeof driverFromSpec>): number[] {
  driver.resolve();
  return AIR_DERIVED.map(field => {
    const value = driver.specField(field).value;
    if (value === null) throw new Error(`${field} did not solve`);
    return value;
  });
}

function warmEngine(): Engine {
  return createEngine({ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS, envDefaults: () => ({tempK: 313.15, humidityPct: 50, pressurePa: 101325})});
}

describe('a driver file\'s own c and roo feed no calculation', () => {
  it('a driver stating c=350, roo=1.1 derives what one stating no air derives', () => {
    const engine = createEngine();
    expect(derived(driverFromSpec(engine, {...TS, ...STRANGE_AIR}))).toEqual(derived(driverFromSpec(engine, TS)));
  });

  it('the solver over plain values ignores stated c and roo too', () => {
    const engine = createEngine();
    const air = engine.environment.solve(engine.environment.defaults()).values;
    const withAir = engine.driver.solveValues({...TS, ...STRANGE_AIR}, air);
    const without = engine.driver.solveValues(TS, air);
    expect(withAir.Cms_m_per_N).toBe(without.Cms_m_per_N);
    expect(withAir.no).toBe(without.no);
    expect(withAir.c_m_per_s).toBe(air.c);
    expect(withAir.roo_kg_per_m3).toBe(air.rho);
  });

  it('a driver with no project uses the app\'s environment defaults', () => {
    const warm = warmEngine();
    const air = warm.environment.solve(warm.environment.defaults()).values;
    const driver = driverFromSpec(warm, {...TS, ...STRANGE_AIR});
    driver.resolve();
    expect(driver.specField('c_m_per_s').value).toBe(air.c);
    expect(driver.specField('roo_kg_per_m3').value).toBe(air.rho);
    expect(derived(driver)).not.toEqual(derived(driverFromSpec(createEngine(), TS)));
  });

  it('in a project, both drivers derive the same, and the project temperature moves them', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);
    project.setDriver(driverFromSpec(engine, {...TS, ...STRANGE_AIR}));
    const strange = AIR_DERIVED.map(f => project.driver.specField(f).value);
    project.setDriver(driverFromSpec(engine, TS));
    const plain = AIR_DERIVED.map(f => project.driver.specField(f).value);
    expect(strange).toEqual(plain);

    project.envTempK.set(318.15);
    const warm = AIR_DERIVED.map(f => project.driver.specField(f).value);
    expect(warm).not.toEqual(plain);
  });
});
