/** REPO: domain access to the user's browser-local preferences. Takes a storage, returns
 *  domain values. */
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY} from './storageKeys.js';

// Browser-local preferences. THE one place that knows their storage keys and their shapes.
//
// A favourite is stored as a UUID, never a display name: two drivers may legitimately read the
// same on screen. The UUID belongs to the canonical driver record and is preserved by the bundle
// and persistence boundaries that intentionally retain record identity.
//
// Editing a saved driver's brand or model produces a different identity, so the star stays on
// the driver it was given to rather than following the edit. That is the same rule Save obeys
// (a renamed driver is a new driver), not an accident of storage.

export const FAVORITES_KEY = OPENISD_FAVOURITE_DRIVERS_KEY;

export interface PrefsRepo {
  /** The starred drivers' ids. */
  favorites(): string[];
  setFavorites(keys: string[]): void;
  /** The starred passive radiators' ids: a saved radiator's storage uuid, a bundled one's record
   *  uuid — so a saved copy never shares its original's star. */
  favoritePassiveRadiators(): string[];
  setFavoritePassiveRadiators(keys: string[]): void;
}

export function createPrefsRepo(storage: KeyValueStorage): PrefsRepo {
  /** The ids stored under `key`; none when nothing, or nothing readable, is there. */
  function idsAt(key: string): string[] {
    try {
      const parsed: unknown = JSON.parse(storage.get(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
    } catch { return []; }
  }
  return {
    favorites: () => idsAt(FAVORITES_KEY),
    setFavorites(keys) {
      storage.set(FAVORITES_KEY, JSON.stringify(keys));
    },
    favoritePassiveRadiators: () => idsAt(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY),
    setFavoritePassiveRadiators(keys) {
      storage.set(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY, JSON.stringify(keys));
    },
  };
}
