import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {DEFAULT_VENTED_DESIGN_LIMITS} from '../../engine/appSettings.js';
import type {EnvDefaults} from '../../engine/appSettings.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {driverFrom, spec, specSection} from '../fixtures/domainBuilders.js';

/**
 * The project's five air quantities (T, RH, p, c, ρ): each E or C through the air solver. A new
 * project copies the app's T, RH and p in as E; a quantity with no calculation path takes the
 * app's value as C (follows Options until typed); clearing just empties.
 * Golden numbers: air.test.ts / air-solver.test.ts (T 293.15, RH 30, p 101325 -> c 343.684120962153,
 * rho 1.20095217714682; p 95000 -> rho 1.12578858900353).
 */
const REF: EnvDefaults = {tempK: 293.15, humidityPct: 30, pressurePa: 101325};
const GOLDEN_C = 343.684120962153;
const GOLDEN_RHO = 1.20095217714682;

function engineOver(defaults: () => EnvDefaults) {
  return createEngine({ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS, envDefaults: defaults});
}

const driver = () => driverFrom({
  brand: 'Dayton', model: 'RS225', section: 'woofer',
  spec: {...specSection({Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008}), Re_ohm: spec(6), Qes: spec(0.45), Qms: spec(3.6)},
});

function sealed(engine: ReturnType<typeof createEngine>): OpenISDProject {
  return new ProjectBuilder(driver(), engine).sealed().volume_m3(0.03).build();
}

function loaded(text: string, engine: ReturnType<typeof createEngine>): OpenISDProject {
  const project = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(project)) throw new Error(project.join('; '));
  return project;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reads `saved.environment` out of `.owpr` text, narrowing instead of casting. */
function environmentOf(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !isRecord(parsed.saved) || !isRecord(parsed.saved.environment)) throw new Error('no saved.environment');
  return parsed.saved.environment;
}

/** `.owpr` text with `saved.environment` (and `edited`'s) replaced. */
function withEnvironment(text: string, environment: Record<string, unknown>): string {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !isRecord(parsed.saved)) throw new Error('not a session');
  parsed.saved.environment = environment;
  if (isRecord(parsed.edited)) parsed.edited.environment = environment;
  return JSON.stringify(parsed);
}

const GRID: FrequencyGrid = {fmin: 20, fmax: 2000, N: 40};

describe('a new project', () => {
  it('copies the app T, RH, p in as entered; c and rho are calculated from them (test 5)', () => {
    const p = sealed(createEngine());
    expect(p.envTempK.provenance).toBe('E');
    expect(p.envHumidityPct.provenance).toBe('E');
    expect(p.envPressurePa.provenance).toBe('E');
    expect([p.envTempK.value, p.envHumidityPct.value, p.envPressurePa.value]).toEqual([293.15, 30, 101325]);
    expect(p.envC_m_per_s.provenance).toBe('C');
    expect(p.envRoo_kg_per_m3.provenance).toBe('C');
    expect(p.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
    expect(p.envRoo_kg_per_m3.value).toBeCloseTo(GOLDEN_RHO, 9);
    expect(p.air.c()).toBeCloseTo(GOLDEN_C, 9);
    expect(p.isModified()).toBe(false);
  });

  it('uses the app\'s own constants, not the reference ones (test 6)', () => {
    const p = sealed(engineOver(() => ({...REF, pressurePa: 95000})));
    expect(p.envPressurePa.value).toBe(95000);
    expect(p.envRoo_kg_per_m3.value).toBeCloseTo(1.12578858900353, 9);
    expect(p.envC_m_per_s.value).toBeCloseTo(343.714140348792, 9);
  });
});

describe('Options never move an entered air value', () => {
  it('a project built under A keeps A after Options become B; a project built after gets B (test 7)', () => {
    let defaults: EnvDefaults = REF;
    const engine = engineOver(() => defaults);
    const before = sealed(engine);
    defaults = {tempK: 250, humidityPct: 10, pressurePa: 90000};
    before.appSettingsChanged();
    expect([before.envTempK.value, before.envHumidityPct.value, before.envPressurePa.value]).toEqual([293.15, 30, 101325]);
    expect(before.envTempK.provenance).toBe('E');
    expect(before.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
    const after = sealed(engine);
    expect([after.envTempK.value, after.envHumidityPct.value, after.envPressurePa.value]).toEqual([250, 10, 90000]);
  });

  it('a cleared value is calculated from the app, so it follows Options until it is typed again', () => {
    let defaults: EnvDefaults = REF;
    const p = sealed(engineOver(() => defaults));
    p.envTempK.clear();
    expect(p.envTempK.provenance).toBe('C');
    expect(p.envTempK.value).toBe(293.15);
    defaults = {...REF, tempK: 300};
    p.appSettingsChanged();
    expect(p.envTempK.value).toBe(300);
    p.envTempK.set(280);
    defaults = {...REF, tempK: 310};
    p.appSettingsChanged();
    expect(p.envTempK.value).toBe(280);
  });
});

describe('loading', () => {
  it('a file with no air loads empty and the solver fills it as calculated; not modified (test 8)', () => {
    const engine = engineOver(() => ({...REF, tempK: 300.15}));
    const text = sealed(engine).toOwprText();
    const back = loaded(withEnvironment(text, {}), engine);
    expect(back.envTempK.provenance).toBe('C');
    expect(back.envTempK.value).toBe(300.15);
    expect(back.envC_m_per_s.provenance).toBe('C');
    expect(back.air.c()).toBeGreaterThan(0);
    expect(back.isModified()).toBe(false);
  });

  it('T, RH, p entered and no c, rho keys: unchanged, c and rho calculated (test 9)', () => {
    const engine = createEngine();
    const text = sealed(engine).toOwprText();
    const env = environmentOf(text);
    const old = withEnvironment(text, {temperature_K: {state: 'E', value: 300.15}, humidity_pct: env.humidity_pct, pressure_Pa: env.pressure_Pa});
    const back = loaded(old, engine);
    expect(back.envTempK.value).toBe(300.15);
    expect(back.envTempK.provenance).toBe('E');
    expect(back.envC_m_per_s.provenance).toBe('C');
    expect(back.envC_m_per_s.value).toBeCloseTo(engine.environment.solve({tempK: 300.15, humidityPct: 30, pressurePa: 101325}).values.c, 9);
    expect(back.isModified()).toBe(false);
  });

  it('stored C temperature, humidity and pressure (the old layout) load as entered with the file\'s own value (test 10)', () => {
    const engine = engineOver(() => ({tempK: 250, humidityPct: 10, pressurePa: 90000}));
    const text = sealed(createEngine()).toOwprText();
    const old = withEnvironment(text, {
      temperature_K: {state: 'C', value: 293.15}, humidity_pct: {state: 'C', value: 30}, pressure_Pa: {state: 'C', value: 101325},
    });
    const back = loaded(old, engine);
    expect([back.envTempK.value, back.envHumidityPct.value, back.envPressurePa.value]).toEqual([293.15, 30, 101325]);
    expect(back.envTempK.provenance).toBe('E');
    expect(back.envPressurePa.provenance).toBe('E');
    expect(back.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
    expect(back.isModified()).toBe(false);
  });

  it('a temperature stored C in the current layout (it has c and rho) stays calculated', () => {
    const engine = createEngine();
    const p = sealed(engine);
    p.envC_m_per_s.set(343.0, 0.05);
    p.envTempK.clear();
    expect(p.envTempK.provenance).toBe('C');
    p.save();
    const back = loaded(p.toOwprText(), engine);
    expect(back.envTempK.provenance).toBe('C');
    expect(back.envC_m_per_s.provenance).toBe('E');
  });
});

describe('clearing', () => {
  it('clear T with c and rho calculated: T is the app value as calculated, c/rho recalculated, the sweep runs (test 11)', () => {
    const engine = createEngine();
    const p = sealed(engine);
    p.envTempK.set(310);
    expect(p.envC_m_per_s.value).not.toBeCloseTo(GOLDEN_C, 3);
    p.envTempK.clear();
    expect(p.envTempK.value).toBe(293.15);
    expect(p.envTempK.provenance).toBe('C');
    expect(p.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
    expect(p.air.c()).toBeCloseTo(GOLDEN_C, 9);
    expect(p.sweep(GRID).issues.map(i => i.text)).toEqual([]);
    expect(p.sweep(GRID).values).not.toBeNull();
  });

  it('clear T with c typed: T is calculated from c, not the app value (test 12)', () => {
    const engine = createEngine();
    const p = sealed(engine);
    p.envC_m_per_s.set(343.0, 0.05);
    p.envTempK.clear();
    expect(p.envTempK.provenance).toBe('C');
    const T = p.envTempK.value ?? NaN;
    expect(T).not.toBe(293.15);
    expect(engine.environment.solve({tempK: T, humidityPct: 30, pressurePa: 101325}).values.c).toBeCloseTo(343.0, 1);
    expect(p.envRoo_kg_per_m3.provenance).toBe('C');
  });

  it('clear T with rho typed: T, c and p come from the rest', () => {
    const engine = createEngine();
    const p = sealed(engine);
    p.envRoo_kg_per_m3.set(1.19, 0.0005);
    p.envPressurePa.clear();
    expect(p.envPressurePa.provenance).toBe('C');
    expect(p.envRoo_kg_per_m3.value).toBe(1.19);
  });

  it('clear c with T, RH, p present: c is calculated again; typing it first pins it', () => {
    const p = sealed(createEngine());
    p.envC_m_per_s.set(340);
    expect(p.envC_m_per_s.provenance).toBe('E');
    p.envC_m_per_s.clear();
    expect(p.envC_m_per_s.provenance).toBe('C');
    expect(p.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
  });

  it('clearAir empties all five: the app levels come back as calculated and a typed c is gone', () => {
    const p = sealed(createEngine());
    p.envTempK.set(250);
    p.envHumidityPct.set(80);
    p.envPressurePa.set(90000);
    p.clearAir();
    expect([p.envTempK.value, p.envHumidityPct.value, p.envPressurePa.value]).toEqual([293.15, 30, 101325]);
    for (const f of [p.envTempK, p.envHumidityPct, p.envPressurePa, p.envC_m_per_s, p.envRoo_kg_per_m3]) expect(f.provenance).toBe('C');
    expect(p.envC_m_per_s.value).toBeCloseTo(GOLDEN_C, 9);
  });
});

describe('conflicts and round trips', () => {
  it('all five entered with c 1 m/s off: dq on c, T, RH, p; the air takes the typed c (test 13)', () => {
    const p = sealed(createEngine());
    p.envC_m_per_s.set(GOLDEN_C + 1, 0.0005);
    p.envRoo_kg_per_m3.set(GOLDEN_RHO, 0.0000005);
    for (const f of [p.envC_m_per_s, p.envTempK, p.envHumidityPct, p.envPressurePa]) {
      expect(f.dq.some(i => i.kind === 'inconsistent-inputs'), f.name).toBe(true);
    }
    expect(p.air.c()).toBe(GOLDEN_C + 1);
  });

  it('round trip keeps every mark, value and precision; the stored text recomputes its dq (test 14)', () => {
    const engine = createEngine();
    const p = sealed(engine);
    p.envC_m_per_s.set(343.0, 0.05);
    p.envTempK.clear();
    p.save();
    for (const text of [p.toOwprText(), p.toStoredText()]) {
      const back = loaded(text, engine);
      for (const [a, b] of [[p.envTempK, back.envTempK], [p.envHumidityPct, back.envHumidityPct], [p.envPressurePa, back.envPressurePa],
        [p.envC_m_per_s, back.envC_m_per_s], [p.envRoo_kg_per_m3, back.envRoo_kg_per_m3]] as const) {
        expect(b.provenance, a.name).toBe(a.provenance);
        expect(b.value, a.name).toBe(a.value);
        expect(b.precision, a.name).toBe(a.precision);
      }
    }
  });

  it('a corrupt c entry is repaired: the project loads and c is calculated again (test 15)', () => {
    const engine = createEngine();
    const text = sealed(engine).toOwprText();
    const env = environmentOf(text);
    const corrupt = withEnvironment(text, {...env, c_m_per_s: {state: 'X'}});
    expect(OpenISDProject.fromOwprText(corrupt, engine)).toBeInstanceOf(Array);
    const repaired = OpenISDProject.fromOwprTextRepairing(corrupt, engine);
    if (Array.isArray(repaired)) throw new Error(repaired.join('; '));
    expect(repaired.repaired.length).toBeGreaterThan(0);
    expect(repaired.project.envC_m_per_s.provenance).toBe('C');
    expect(repaired.project.envTempK.provenance).toBe('E');
  });
});

describe('the sweep', () => {
  it('runs in the project\'s own c and rho: a typed c changes the response', () => {
    const p = sealed(createEngine());
    const base = JSON.stringify(p.sweep(GRID).values);
    p.envC_m_per_s.set(330, 0.5);
    expect(JSON.stringify(p.sweep(GRID).values)).not.toBe(base);
  });

  it('is blocked by an entered temperature the air model does not support', () => {
    const p = sealed(createEngine());
    p.envTempK.set(5000);
    expect(p.sweep(GRID).values).toBeNull();
    expect(p.sweep(GRID).issues.length).toBeGreaterThan(0);
  });
});
