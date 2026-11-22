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

/** The factory plausibility band's top volume: 100 L. It is the band's own value, not the Vb box's
 *  input top (`NumberField.BOX_VB_L.limits.max`, 10 m3), so changing what the box accepts never
 *  moves the band (T850). */
const DEFAULT_VENTED_MAX_VB_M3 = 0.1;

export const DEFAULT_VENTED_DESIGN_LIMITS: VentedDesignLimits = Object.freeze({
  minVb_m3: 0.001, maxVb_m3: DEFAULT_VENTED_MAX_VB_M3, minFb_hz: 10, maxFb_hz: 150,
});

export const DEFAULT_ENV_DEFAULTS: EnvDefaults = Object.freeze({
  tempK: DEFAULT_T_REF_K, humidityPct: DEFAULT_RH_REF_PCT, pressurePa: DEFAULT_P_REF_PA,
});

export const defaultAppSettings: AppSettings = Object.freeze({
  ventedLimits: (): VentedDesignLimits => DEFAULT_VENTED_DESIGN_LIMITS,
  envDefaults: (): EnvDefaults => DEFAULT_ENV_DEFAULTS,
});
