// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /** REPO: view/UI preferences — panel sizes, unit tokens, chart colours, username, env
//  *  defaults, the open tab/chart, the graph cursor (`ViewSnapshot`, declared in
//  *  `projectRepo.ts`). Persisted under its OWN storage key, independent of the project
//  *  (QO90 — a saved `.owpr`/autosave carries only the project; view state is not part of it).
//  *  No schema-upgrade seam, no share-link door: a share link keeps carrying the whole session
//  *  through `ProjectRepo`'s own `stateToUrl`/`loadFromHash` (human ruling 2026-08-14) — this
//  *  repo only ever needs local persistence. */
// import type { ViewSnapshot } from './projectRepo.js';
// import type { KeyValueStorage } from '../storage/keyValueStorage.js';
//
// export const VIEW_STATE_KEY = 'openisd.view';
//
// export interface ViewStateRepo {
//   /** Autosave to browser storage. Quota/disabled storage is non-fatal, same as
//    *  the project doors — a view-state autosave that cannot happen must not take the
//    *  session down. */
//   save(v: ViewSnapshot): void;
//   /** The saved view, or null when none/unreadable. */
//   load(): ViewSnapshot | null;
// }
//
// export function createViewStateRepo(storage: KeyValueStorage): ViewStateRepo {
//   return {
//     save(v: ViewSnapshot): void {
//       storage.set(VIEW_STATE_KEY, JSON.stringify(v));
//     },
//     load(): ViewSnapshot | null {
//       const raw = storage.get(VIEW_STATE_KEY);
//       if (!raw) return null;
//       try {
//         const parsed: unknown = JSON.parse(raw);
//         if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { graphs?: unknown }).graphs)) {
//           console.error('[restore] saved view state carries no graphs list — refused');
//           return null;
//         }
//         return parsed as ViewSnapshot;
//       } catch {
//         console.error('[restore] saved view state is not valid JSON — ignored');
//         return null;
//       }
//     },
//   };
// }
//