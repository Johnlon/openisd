import { describe, it, expect } from 'vitest';
import { resolveAirEnvironment } from '../../src/logic/environment.js';
import { airConstantsAppDefaults } from '../../src/logic/presentationState.js';

describe('airConstantsAppDefaults', () => {
  it('returns the canonical Environment default values', () => {
    expect(airConstantsAppDefaults()).toEqual({ tempK: 293.15, pressurePa: 101325.0, humidityPct: 30.0 });
  });

  it('returns a fresh copy each call, not an alias', () => {
    const first = airConstantsAppDefaults();
    first.tempK = 111111;
    const second = airConstantsAppDefaults();
    expect(second.tempK).toBe(293.15);
  });

  it('resets a draft that was mutated away from the canonical values', () => {
    const draft = { envDefaults: { tempK: 111111, pressurePa: 999, humidityPct: 1 } };
    draft.envDefaults = airConstantsAppDefaults();
    expect(draft.envDefaults).toEqual({ tempK: 293.15, pressurePa: 101325.0, humidityPct: 30.0 });
  });
});

describe('resolveAirEnvironment', () => {
  it('separates the WinISD air-model choice from the app-level environment source', () => {
    const projectEnv = {
      tempK: 298.15,
      humidityPct: 45,
      pressurePa: 100000,
      useWinisdAirModel: true,
      useAppLevelAirEnvironment: false,
    };

    expect(resolveAirEnvironment(projectEnv, { humidityPct: 60, pressurePa: 98000 })).toEqual(projectEnv);
    expect(resolveAirEnvironment({ ...projectEnv, useAppLevelAirEnvironment: true }, { humidityPct: 60, pressurePa: 98000 })).toEqual({
      ...projectEnv,
      humidityPct: 60,
      pressurePa: 98000,
      useAppLevelAirEnvironment: true,
    });
    expect(resolveAirEnvironment({ ...projectEnv, useWinisdAirModel: false, useAppLevelAirEnvironment: true }, { humidityPct: 60, pressurePa: 98000 })).toEqual({
      ...projectEnv,
      useWinisdAirModel: false,
      useAppLevelAirEnvironment: true,
    });
  });
});
