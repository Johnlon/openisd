// Favourite drivers — the user's starred rows, in browser storage. THE one place that knows
// the storage key and its shape, mirroring myDrivers.ts.
//
// A favourite is stored as a KEY, never a display name: two drivers may legitimately read the
// same on screen. The key is the driver's identity — `<brand>/<model>` for a saved driver, the
// source plus bundled path for a library row — and `driverKey()` in useDriverLibrary.ts is the
// one function that mints them.
//
// Editing a saved driver's brand or model produces a different identity, so the star stays on
// the driver it was given to rather than following the edit. That is the same rule Save obeys
// (a renamed driver is a new driver), not an accident of storage.

export const FAVORITES_KEY = 'openisd_favorite_drivers';

export function loadFavorites(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch { return []; }
}

export function saveFavorites(keys: string[]): void {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(keys)); } catch { /* storage disabled/full — non-fatal */ }
}
