/** REPO: view/UI preferences — panel sizes, unit tokens, chart colours, username, env
 *  defaults, the open tab/chart, the graph cursor (`ViewSnapshot`, declared in
 *  `projectRepo.ts`). Persisted under its OWN storage key, independent of the project
 *  (QO90 — a saved `.owpr`/autosave carries only the project; view state is not part of it).
 *  No schema-upgrade seam, no share-link door: a share link keeps carrying the whole session
 *  through `ProjectRepo`'s own `stateToUrl`/`loadFromHash` (human ruling 2026-08-14) — this
 *  repo only ever needs local persistence. */
import type { ViewSnapshot } from './projectRepo.js';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import { OPENISD_VIEW_KEY } from './storageKeys.js';

export const VIEW_STATE_KEY = OPENISD_VIEW_KEY;

export interface ViewStateRepo {
  /** Autosave to browser storage. Quota/disabled storage is non-fatal, same as
   *  the project doors — a view-state autosave that cannot happen must not take the
   *  session down. */
  save(v: ViewSnapshot): void;
  /** The saved view, or null when none/unreadable. */
  load(): ViewSnapshot | null;
}

function isViewSnapshot(obj: unknown): obj is ViewSnapshot {
  return typeof obj === 'object' && obj !== null && 'graphs' in obj && Array.isArray(obj.graphs);
}

export function createViewStateRepo(storage: KeyValueStorage): ViewStateRepo {
  return {
    save(v: ViewSnapshot): void {
      storage.set(VIEW_STATE_KEY, JSON.stringify(v));
    },
    load(): ViewSnapshot | null {
      const raw = storage.get(VIEW_STATE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isViewSnapshot(parsed)) {
          console.error('[restore] saved view state carries no graphs list — refused');
          return null;
        }
        return parsed;
      } catch {
        console.error('[restore] saved view state is not valid JSON — ignored');
        return null;
      }
    },
  };
}
