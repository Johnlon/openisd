import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {Air, DriverEngine, PrEngine, VentEngine} from '../../engine/index.js';
import {DEFAULT_P_REF_PA, DEFAULT_RH_REF_PCT, DEFAULT_T_REF_K, FixedAir} from '../../engine/index.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {driverParams} from './testSolver.js';

const engine = createEngine();

/** Compiles only when `Given` is exactly `Wanted`. */
type Is<Given, Wanted> = [Given] extends [Wanted] ? ([Wanted] extends [Given] ? true : false) : false;
/** The air parameter of a solver (its last), as the compiler sees it. */
type AirOf<F extends (...args: never[]) => unknown> = Parameters<F> extends [...unknown[], infer Last] ? Last : never;
/** Fails to compile unless the type argument is `true`. */
function proves<T extends true>(): T | undefined { return undefined; }

describe('a solver cannot be given an absent air (compile-time: the typecheck gate verifies each line)', () => {
  it('the driver, vent and radiator solvers take an Air, and there is no other kind of air', () => {
    const proofs = [
      proves<Is<AirOf<DriverEngine['solve']>, Air>>(),
      proves<Is<AirOf<DriverEngine['solveValues']>, Air>>(),
      proves<Is<AirOf<VentEngine['solve']>, Air>>(),
      proves<Is<AirOf<PrEngine['solve']>, Air>>(),
      proves<Is<AirOf<PrEngine['solveSpec']>, Air>>(),
      proves<Is<AirOf<PrEngine['checkSpec']>, Air>>(),
    ];
    expect(proofs).toHaveLength(6);
  });

  it('an Air is accepted', () => {
    const p = driverParams({Qes: 0.4, Qms: 3});
    engine.driver.solve(p, new FixedAir({c: REFERENCE_AIR.c(), rho: REFERENCE_AIR.rho()}));
    expect(p.Qts.calculated).toBe(true);
  });
});

describe('the chain for temperature, humidity and pressure: project value, app setting, built-in constant', () => {
  const blankApp = createEngine({
    ventedLimits: () => ({minVb_m3: 0.001, maxVb_m3: 1, minFb_hz: 10, maxFb_hz: 150}),
    envDefaults: () => ({tempK: NaN, humidityPct: NaN, pressurePa: NaN}),
  });
  const setApp = createEngine({
    ventedLimits: () => ({minVb_m3: 0.001, maxVb_m3: 1, minFb_hz: 10, maxFb_hz: 150}),
    envDefaults: () => ({tempK: 280, humidityPct: 50, pressurePa: 100000}),
  });

  it('step 1: a project value cleared takes the app setting, as calculated', () => {
    const project = ProjectBuilder.empty(setApp);
    project.envTempK.set(300);
    project.envTempK.clear();
    expect(project.envTempK.value).toBe(280);
    expect(project.envTempK.provenance).toBe('C');
    expect(project.air.c()).toBe(setApp.environment.solve({tempK: 280, humidityPct: 50, pressurePa: 100000}).values.c);
  });

  it('step 2: an app setting that is blank is the built-in constant', () => {
    expect([blankApp.environment.appAir.temperature(), blankApp.environment.appAir.humidity(), blankApp.environment.appAir.pressure()])
      .toEqual([DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA]);
  });

  it('step 2 reaches a project: cleared with the app setting blank, it takes the built-in constant', () => {
    const project = ProjectBuilder.empty(blankApp);
    project.envPressurePa.set(90000);
    project.envPressurePa.clear();
    expect(project.envPressurePa.value).toBe(DEFAULT_P_REF_PA);
    expect(project.envPressurePa.provenance).toBe('C');
  });

  it('c and rho are calculated from the three, never blank', () => {
    const project = ProjectBuilder.empty(blankApp);
    const wanted = blankApp.environment.solve({tempK: DEFAULT_T_REF_K, humidityPct: DEFAULT_RH_REF_PCT, pressurePa: DEFAULT_P_REF_PA}).values;
    expect([project.air.c(), project.air.rho()]).toEqual([wanted.c, wanted.rho]);
    project.envC_m_per_s.set(350);
    project.envC_m_per_s.clear();
    expect(project.envC_m_per_s.value).toBe(wanted.c);
    expect(project.envC_m_per_s.provenance).toBe('C');
  });
});

describe('a typed c the air cannot honour stays as typed and says why, on both boxes', () => {
  it('c = 900 needs a temperature above the model range: c stays E, T keeps the app value, both carry the reason', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.envTempK.clear();
    project.envC_m_per_s.set(900);
    expect(project.envC_m_per_s.value).toBe(900);
    expect(project.envC_m_per_s.provenance).toBe('E');
    expect(project.envTempK.provenance).toBe('C');
    for (const field of [project.envC_m_per_s, project.envTempK]) {
      expect(field.dq.map(issue => issue.text).join(' ')).toContain('no temperature in range gives this c');
    }
  });

  it('a c the model can honour solves T and carries no mark', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);
    const app = engine.environment.appAir;
    project.envTempK.clear();
    project.envC_m_per_s.set(engine.environment.solve({tempK: 290, humidityPct: app.humidity(), pressurePa: app.pressure()}).values.c);
    expect(project.envTempK.value).toBeCloseTo(290, 6);
    expect(project.envTempK.dq).toEqual([]);
    expect(project.envC_m_per_s.dq).toEqual([]);
  });
});
