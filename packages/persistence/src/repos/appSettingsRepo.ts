/** REPO: domain access to the application settings the user set. Takes a storage, returns
 *  domain values. */
import {DEFAULT_VENTED_DESIGN_LIMITS, DEFAULT_ENV_DEFAULTS} from '@openisd/design/engine';
import type {AppSettings, EnvDefaults, VentedDesignLimits} from '@openisd/design/engine';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {OPENISD_APP_SETTINGS_KEY} from './storageKeys.js';

// What the user configured for the application itself — today, the band that decides which
// designed values get a DQ mark, and the environment defaults a project falls back to when it
// has none of its own. Browser-local, so it follows the person and never a project file. THE
// one place that knows this setting's storage key and its stored shape; the same object is
// what the composition root hands `new Engine(...)`.
//
// Nothing read back is trusted. A stored band that is absent, unparseable, incomplete,
// non-numeric, not positive or inside out (min above max) reads as the factory band: a corrupt
// setting must not be able to break a cell's DQ, and there is no partial band worth keeping —
// half a band is not a band. Same rule for the environment defaults: a corrupt or out-of-range
// record reads as the factory defaults.

export const APP_SETTINGS_KEY = OPENISD_APP_SETTINGS_KEY;

export interface AppSettingsRepo extends AppSettings {
  setVentedLimits(limits: VentedDesignLimits): void;
  setEnvDefaults(defaults: EnvDefaults): void;
}

/** The stored record — one member per setting, so the next app-level setting is an added
 *  member rather than a second key. */
interface StoredAppSettings {
  readonly vented: VentedDesignLimits;
  readonly env?: EnvDefaults;
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** Parse at the boundary: an unknown blob becomes a `VentedDesignLimits` or nothing. */
function parseVented(raw: unknown): VentedDesignLimits | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if (!('minVb_m3' in raw) || !('maxVb_m3' in raw)) return null;
  if (!('minFb_hz' in raw) || !('maxFb_hz' in raw)) return null;
  const {minVb_m3, maxVb_m3, minFb_hz, maxFb_hz} = raw;
  if (!isPositiveNumber(minVb_m3) || !isPositiveNumber(maxVb_m3)) return null;
  if (!isPositiveNumber(minFb_hz) || !isPositiveNumber(maxFb_hz)) return null;
  if (minVb_m3 > maxVb_m3 || minFb_hz > maxFb_hz) return null;
  return {minVb_m3, maxVb_m3, minFb_hz, maxFb_hz};
}

/** Parse at the boundary: an unknown blob becomes an `EnvDefaults` or nothing. Temperature and
 *  pressure just need to be positive; humidity has its own 0-100 range check. */
function parseEnv(raw: unknown): EnvDefaults | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if (!('tempK' in raw) || !('humidityPct' in raw) || !('pressurePa' in raw)) return null;
  const {tempK, humidityPct, pressurePa} = raw;
  if (!isPositiveNumber(tempK) || !isPositiveNumber(pressurePa)) return null;
  if (typeof humidityPct !== 'number' || !Number.isFinite(humidityPct)) return null;
  if (humidityPct < 0 || humidityPct > 100) return null;
  return {tempK, humidityPct, pressurePa};
}

function parseStored(text: string | null): StoredAppSettings | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || !('vented' in parsed)) return null;
    const vented = parseVented(parsed.vented);
    if (vented === null) return null;
    const env = 'env' in parsed ? parseEnv(parsed.env) : null;
    return env === null ? {vented} : {vented, env};
  } catch { return null; }
}

export function createAppSettingsRepo(storage: KeyValueStorage): AppSettingsRepo {
  return {
    ventedLimits(): VentedDesignLimits {
      return parseStored(storage.get(APP_SETTINGS_KEY))?.vented ?? DEFAULT_VENTED_DESIGN_LIMITS;
    },
    envDefaults(): EnvDefaults {
      return parseStored(storage.get(APP_SETTINGS_KEY))?.env ?? DEFAULT_ENV_DEFAULTS;
    },
    setVentedLimits(limits: VentedDesignLimits): void {
      const current = parseStored(storage.get(APP_SETTINGS_KEY));
      const stored: StoredAppSettings = current?.env === undefined
        ? {vented: limits} : {vented: limits, env: current.env};
      storage.set(APP_SETTINGS_KEY, JSON.stringify(stored));
    },
    setEnvDefaults(defaults: EnvDefaults): void {
      const current = parseStored(storage.get(APP_SETTINGS_KEY));
      const stored: StoredAppSettings = {vented: current?.vented ?? DEFAULT_VENTED_DESIGN_LIMITS, env: defaults};
      storage.set(APP_SETTINGS_KEY, JSON.stringify(stored));
    },
  };
}
