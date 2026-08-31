// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /** REPO: domain access to the user's browser-local preferences. Takes a storage, returns
//  *  domain values. */
// import type { KeyValueStorage } from '../storage/keyValueStorage.js';
//
// // Browser-local preferences. THE one place that knows their storage keys and their shapes.
// //
// // A favourite is stored as a KEY, never a display name: two drivers may legitimately read the
// // same on screen. The key is the driver's identity — `<brand>/<model>` for a saved driver, the
// // source plus bundled path for a library row — and `driverKey()` in driverRepo.ts is the one
// // function that mints them.
// //
// // Editing a saved driver's brand or model produces a different identity, so the star stays on
// // the driver it was given to rather than following the edit. That is the same rule Save obeys
// // (a renamed driver is a new driver), not an accident of storage.
//
// export const FAVORITES_KEY = 'openisd_favorite_drivers';
//
// export interface PrefsRepo {
//   favorites(): string[];
//   setFavorites(keys: string[]): void;
// }
//
// export function createPrefsRepo(storage: KeyValueStorage): PrefsRepo {
//   return {
//     favorites() {
//       try {
//         const parsed: unknown = JSON.parse(storage.get(FAVORITES_KEY) ?? '[]');
//         return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
//       } catch { return []; }
//     },
//     setFavorites(keys) {
//       storage.set(FAVORITES_KEY, JSON.stringify(keys));
//     },
//   };
// }
//