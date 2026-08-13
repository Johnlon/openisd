import type { KeyValueStore } from './kv.js';

// Browser-local preferences. THE one place that knows their storage keys and their shapes.
//
// A favourite is stored as a KEY, never a display name: two drivers may legitimately read the
// same on screen. The key is the driver's identity — `<brand>/<model>` for a saved driver, the
// source plus bundled path for a library row — and `driverKey()` in driverRepo.ts is the one
// function that mints them.
//
// Editing a saved driver's brand or model produces a different identity, so the star stays on
// the driver it was given to rather than following the edit. That is the same rule Save obeys
// (a renamed driver is a new driver), not an accident of storage.

export const FAVORITES_KEY = 'openisd_favorite_drivers';

export interface PrefsStore {
  favorites(): string[];
  setFavorites(keys: string[]): void;
}

export function createPrefsStore(store: KeyValueStore): PrefsStore {
  return {
    favorites() {
      try {
        const parsed: unknown = JSON.parse(store.get(FAVORITES_KEY) ?? '[]');
        return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
      } catch { return []; }
    },
    setFavorites(keys) {
      store.set(FAVORITES_KEY, JSON.stringify(keys));
    },
  };
}
