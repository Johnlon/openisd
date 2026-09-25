import type {VentedDesignLimits} from './plausibility.js';
import {DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA} from './air.js';

/** The application's environment defaults — Options → Environment, or the reference
 *  constants when nothing has been configured. */
export interface EnvDefaults {
  readonly tempK: number;
  readonly humidityPct: number;
  readonly pressurePa: number;
}

export interface AppSettings {
  ventedLimits(): VentedDesignLimits;
  envDefaults(): EnvDefaults;
}

export const DEFAULT_VENTED_DESIGN_LIMITS: VentedDesignLimits = Object.freeze({
  minVb_m3: 0.001, maxVb_m3: 1.0, minFb_hz: 10, maxFb_hz: 150,
});

export const DEFAULT_ENV_DEFAULTS: EnvDefaults = Object.freeze({
  tempK: DEFAULT_T_REF_K, humidityPct: DEFAULT_RH_REF_PCT, pressurePa: DEFAULT_P_REF_PA,
});

export const defaultAppSettings: AppSettings = Object.freeze({
  ventedLimits: (): VentedDesignLimits => DEFAULT_VENTED_DESIGN_LIMITS,
  envDefaults: (): EnvDefaults => DEFAULT_ENV_DEFAULTS,
});
