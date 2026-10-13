/** REPO: domain access to the application settings the user set. Takes a storage, returns
 *  domain values. */
import {DEFAULT_VENTED_DESIGN_LIMITS, DEFAULT_ENV_DEFAULTS} from '@openisd/design/engine';
import type {AppSettings, EnvDefaults, VentedDesignLimits} from '@openisd/design/engine';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import type {StorageBackup} from './storageBackup.js';
import {OPENISD_APP_SETTINGS_KEY, OPENISD_BACKUP_KEYS, OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY} from './storageKeys.js';
import {createStoredDataFault, type StoredDataFault} from './storedDataFault.js';

// What the user configured for the application itself — today, the band that decides which
// designed values get a DQ mark, and the environment defaults a project falls back to when it
// has none of its own. Browser-local, so it follows the person and never a project file. THE
// one place that knows this setting's storage key and its stored shape; the same object is
// what the composition root hands `createEngine(...)`.
//
// Nothing read back is trusted. A stored band that is absent, unparseable, incomplete,
// non-numeric, not positive or inside out (min above max) reads as the factory band: a corrupt
// setting must not be able to break a cell's DQ, and there is no partial band worth keeping —
// half a band is not a band. Same rule for the environment defaults: a corrupt or out-of-range
// record reads as the factory defaults.

export const APP_SETTINGS_KEY = OPENISD_APP_SETTINGS_KEY;

export interface SingletonDocRepo {
  readonly kind: 'settings' | 'favourites';
  readDoc(): { readonly kind: 'ok'; readonly body: string | null } | { readonly kind: 'unreadable' };
  replaceDoc(body: string): 'done' | 'refused';
  removeDoc(): 'done' | 'refused';
}

export interface AppSettingsRepo extends AppSettings, SingletonDocRepo {
  readonly kind: 'settings';
  setVentedLimits(limits: VentedDesignLimits): void;
  setEnvDefaults(defaults: EnvDefaults): void;
  /** The WinISD difference markers (≠W) show (Options → General). Shown unless the user hid them. */
  differenceCuesShown(): boolean;
  setDifferenceCuesShown(shown: boolean): void;
  /** The stored text verbatim, or null when none — what a backup saves. */
  exportRaw(): string | null;
  /** Forget the stored settings; every setting reads its factory value. False when the store
   *  could not be backed up first, and the settings were kept. */
  reset(): boolean;
}

export interface FavouritesRepo extends SingletonDocRepo {
  readonly kind: 'favourites';
}

/** The stored record — one member per setting, so the next app-level setting is an added
 *  member rather than a second key. */
interface StoredAppSettings {
  readonly vented: VentedDesignLimits;
  readonly env?: EnvDefaults;
  readonly differenceCues?: boolean;
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

/** The stored record, each member parsed on its own: a bad member reads as absent (its factory
 *  value) without costing the others. `clean` is false when stored text had anything that did
 *  not parse — the text a write must back up before replacing it. */
interface ParsedAppSettings {
  readonly vented: VentedDesignLimits | null;
  readonly env: EnvDefaults | null;
  readonly differenceCues: boolean | null;
  readonly clean: boolean;
}

function parseStored(text: string | null): ParsedAppSettings {
  if (text === null) return {vented: null, env: null, differenceCues: null, clean: true};
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return {vented: null, env: null, differenceCues: null, clean: false}; }
  if (typeof parsed !== 'object' || parsed === null) return {vented: null, env: null, differenceCues: null, clean: false};
  const vented = 'vented' in parsed ? parseVented(parsed.vented) : null;
  const env = 'env' in parsed ? parseEnv(parsed.env) : null;
  const differenceCues = 'differenceCues' in parsed && typeof parsed.differenceCues === 'boolean' ? parsed.differenceCues : null;
  const clean = ('vented' in parsed) === (vented !== null) && ('env' in parsed) === (env !== null)
    && ('differenceCues' in parsed) === (differenceCues !== null);
  return {vented, env, differenceCues, clean};
}

/** The record to store: the parsed members, an absent one left out (the band always written). */
function recordOf(p: ParsedAppSettings): StoredAppSettings {
  return {
    vented: p.vented ?? DEFAULT_VENTED_DESIGN_LIMITS,
    ...(p.env === null ? {} : {env: p.env}),
    ...(p.differenceCues === null ? {} : {differenceCues: p.differenceCues}),
  };
}

/** `onUnreadable` hears each distinct stored text that did not parse, once — the composition root
 *  routes it to the fault log so the user is told which store, not left with silent defaults. */
export function createAppSettingsRepo(
  storage: KeyValueStorage,
  backup: StorageBackup,
  onUnreadable: ((fault: StoredDataFault) => void) | undefined = () => undefined,
  onReplaced: () => void,
): AppSettingsRepo {
  let reportedText: string | null = null;
  /** Parse the stored text, reporting it once if any of it could not be read. */
  function readStored(): ParsedAppSettings {
    const text = storage.get(APP_SETTINGS_KEY);
    const parsed = parseStored(text);
    if (text !== null && !parsed.clean && text !== reportedText) {
      reportedText = text;
      onUnreadable(createStoredDataFault('options', 'stored Options could not be fully read; unreadable settings use their defaults'));
    }
    return parsed;
  }
  /** Replace the record with `next(current)`, backing the old text up first when part of it
   *  could not be read — that part is about to be overwritten. */
  function write(next: (current: ParsedAppSettings) => StoredAppSettings): void {
    const text = storage.get(APP_SETTINGS_KEY);
    const current = parseStored(text);
    if (text !== null && !current.clean) {
      backup.guard(() => {
        storage.set(OPENISD_BACKUP_KEYS.appSettings, text);
        storage.set(APP_SETTINGS_KEY, JSON.stringify(next(current)));
      });
      return;
    }
    storage.set(APP_SETTINGS_KEY, JSON.stringify(next(current)));
  }
  return {
    kind: 'settings',
    readDoc() {
      const text = storage.get(APP_SETTINGS_KEY);
      if (text === null) return { kind: 'ok', body: null };
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { kind: 'unreadable' };
        }
        return { kind: 'ok', body: text };
      } catch {
        return { kind: 'unreadable' };
      }
    },
    replaceDoc(body: string) {
      try {
        const parsed: unknown = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return 'refused';
        }
      } catch {
        return 'refused';
      }
      const exists = storage.get(APP_SETTINGS_KEY) !== null;
      if (exists) {
        const guarded = backup.guard(() => storage.set(APP_SETTINGS_KEY, body));
        return guarded.kind === 'ran' ? 'done' : 'refused';
      }
      const ok = backup.write(APP_SETTINGS_KEY, body);
      return ok ? 'done' : 'refused';
    },
    removeDoc() {
      if (storage.get(APP_SETTINGS_KEY) === null) return 'refused';
      const guarded = backup.guard(() => storage.remove(APP_SETTINGS_KEY));
      return guarded.kind === 'ran' ? 'done' : 'refused';
    },
    ventedLimits(): VentedDesignLimits {
      return readStored().vented ?? DEFAULT_VENTED_DESIGN_LIMITS;
    },
    envDefaults(): EnvDefaults {
      return readStored().env ?? DEFAULT_ENV_DEFAULTS;
    },
    setVentedLimits(limits: VentedDesignLimits): void {
      write(current => recordOf({...current, vented: limits}));
    },
    setEnvDefaults(defaults: EnvDefaults): void {
      write(current => recordOf({...current, env: defaults}));
    },
    differenceCuesShown(): boolean {
      return readStored().differenceCues ?? true;
    },
    setDifferenceCuesShown(shown: boolean): void {
      write(current => recordOf({...current, differenceCues: shown}));
    },
    exportRaw: () => storage.get(APP_SETTINGS_KEY),
    reset(): boolean {
      const ran = backup.guard(() => storage.remove(APP_SETTINGS_KEY)).kind === 'ran';
      if (ran) onReplaced();
      return ran;
    },
  };
}

function parseStringArray(val: unknown): readonly string[] | null {
  if (!Array.isArray(val)) return null;
  const result: string[] = [];
  for (const item of val) {
    if (typeof item !== 'string') return null;
    result.push(item);
  }
  return result;
}

function parseFavouritesBody(body: string): { readonly ok: true; readonly drivers: readonly string[]; readonly passiveRadiators: readonly string[] } | { readonly ok: false } {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false };
    if (!('drivers' in parsed) || !('passiveRadiators' in parsed)) return { ok: false };
    const drivers = parseStringArray(parsed.drivers);
    const prs = parseStringArray(parsed.passiveRadiators);
    if (drivers === null || prs === null) return { ok: false };
    return { ok: true, drivers, passiveRadiators: prs };
  } catch {
    return { ok: false };
  }
}

export function createFavouritesRepo(storage: KeyValueStorage, backup: StorageBackup): FavouritesRepo {
  return {
    kind: 'favourites',
    readDoc() {
      const driversText = storage.get(OPENISD_FAVOURITE_DRIVERS_KEY);
      const prsText = storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY);
      if (driversText === null && prsText === null) return { kind: 'ok', body: null };

      let drivers: readonly string[] = [];
      if (driversText !== null) {
        try {
          const parsed: unknown = JSON.parse(driversText);
          const arr = parseStringArray(parsed);
          if (arr === null) return { kind: 'unreadable' };
          drivers = arr;
        } catch {
          return { kind: 'unreadable' };
        }
      }

      let prs: readonly string[] = [];
      if (prsText !== null) {
        try {
          const parsed: unknown = JSON.parse(prsText);
          const arr = parseStringArray(parsed);
          if (arr === null) return { kind: 'unreadable' };
          prs = arr;
        } catch {
          return { kind: 'unreadable' };
        }
      }

      return { kind: 'ok', body: JSON.stringify({ drivers, passiveRadiators: prs }) };
    },

    replaceDoc(body: string) {
      const parsed = parseFavouritesBody(body);
      if (!parsed.ok) return 'refused';
      const driversText = JSON.stringify(parsed.drivers);
      const prsText = JSON.stringify(parsed.passiveRadiators);
      const exists = storage.get(OPENISD_FAVOURITE_DRIVERS_KEY) !== null
        || storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY) !== null;
      if (exists) {
        const guarded = backup.guard(() => {
          storage.set(OPENISD_FAVOURITE_DRIVERS_KEY, driversText);
          storage.set(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY, prsText);
        });
        return guarded.kind === 'ran' ? 'done' : 'refused';
      }
      const ok1 = backup.write(OPENISD_FAVOURITE_DRIVERS_KEY, driversText);
      const ok2 = backup.write(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY, prsText);
      return ok1 && ok2 ? 'done' : 'refused';
    },

    removeDoc() {
      if (storage.get(OPENISD_FAVOURITE_DRIVERS_KEY) === null && storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY) === null) {
        return 'refused';
      }
      const guarded = backup.guard(() => {
        storage.remove(OPENISD_FAVOURITE_DRIVERS_KEY);
        storage.remove(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY);
      });
      return guarded.kind === 'ran' ? 'done' : 'refused';
    },
  };
}
