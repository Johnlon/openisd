/** REPO: domain access to the user's browser-local preferences. Takes a storage, returns
 *  domain values. */
import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import { OPENISD_FAVOURITE_DRIVERS_KEY } from './storageKeys.js';

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
  favorites(): string[];
  setFavorites(keys: string[]): void;
}

export function createPrefsRepo(storage: KeyValueStorage): PrefsRepo {
  return {
    favorites() {
      try {
        const parsed: unknown = JSON.parse(storage.get(FAVORITES_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
      } catch { return []; }
    },
    setFavorites(keys) {
      storage.set(FAVORITES_KEY, JSON.stringify(keys));
    },
  };
}
