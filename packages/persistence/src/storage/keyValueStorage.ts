// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /** STORAGE (port): where bytes live, keyed by string. Knows keys and strings, never what a
//  *  driver or a preference is. */
// //
// // The one storage abstraction the repositories are built on.
// //
// // A repository does not know whether it is talking to a browser or to a test: it is handed a
// // KeyValueStorage and asks it for strings. `localStorage` is one implementation and an
// // in-memory map is another, which is what lets My Drivers, favourites and the PR repo be
// // exercised without a DOM.
//
// export interface KeyValueStorage {
//   get(key: string): string | null;
//   set(key: string, value: string): void;
//   remove(key: string): void;
// }
//
// /**
//  * The browser's own storage. Every call is guarded: storage can be disabled by the user or
//  * full, and neither is a reason for the app to stop — a preference that cannot be written is
//  * a preference that does not persist, not a crash.
//  */
// export function createLocalStorage(): KeyValueStorage {
//   return {
//     get(key) { try { return localStorage.getItem(key); } catch { return null; } },
//     set(key, value) { try { localStorage.setItem(key, value); } catch { /* disabled or full */ } },
//     remove(key) { try { localStorage.removeItem(key); } catch { /* disabled */ } },
//   };
// }
//
// /** An equivalent storage with no browser behind it — what a test injects. */
// export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
//   const map = new Map<string, string>(Object.entries(initial));
//   return {
//     get(key) { return map.has(key) ? map.get(key)! : null; },
//     set(key, value) { map.set(key, value); },
//     remove(key) { map.delete(key); },
//   };
// }
//