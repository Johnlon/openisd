/** REPO: view/UI preferences — panel sizes, unit tokens, chart colours, username, env
 *  defaults (`ViewSnapshot`, declared in `projectRepo.ts`). Persisted under its OWN storage key,
 *  independent of the project
 *  (QO90 — a saved `.owpr`/autosave carries only the project; view state is not part of it).
 *  No schema-upgrade seam, no share-link door: a share link keeps carrying the whole session
 *  through `ProjectRepo`'s own `stateToUrl`/`loadFromHash` (human ruling 2026-08-14) — this
 *  repo only ever needs local persistence. */
import type {ViewSnapshot} from './projectRepo.js';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {OPENISD_VIEW_KEY} from './storageKeys.js';

export const VIEW_STATE_KEY = OPENISD_VIEW_KEY;

export interface ViewStateRepo {
  /** Autosave to browser storage. Quota/disabled storage is non-fatal, same as
   *  the project doors — a view-state autosave that cannot happen must not take the
   *  session down. */
  save(v: ViewSnapshot): void;
  /** The saved view, or null when none/unreadable. */
  load(): ViewSnapshot | null;
  /** Call `onChange` whenever another tab saves the view. Returns the call that stops it. */
  watch(onChange: () => void): () => void;
}

function isViewSnapshot(obj: unknown): obj is ViewSnapshot {
  return typeof obj === 'object' && obj !== null && 'ui' in obj && typeof obj.ui === 'object' && obj.ui !== null;
}

/** `value` as JSON with every object's keys sorted, so the same view always writes the same
 *  text. A tab rebuilds the view in its own key order; without this, two tabs would each hear
 *  the other's rewrite of an unchanged view as a change and echo it back forever. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v;
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
  });
}

export function createViewStateRepo(storage: KeyValueStorage): ViewStateRepo {
  return {
    save(v: ViewSnapshot): void {
      storage.set(VIEW_STATE_KEY, canonicalJson(v));
    },
    load(): ViewSnapshot | null {
      const raw = storage.get(VIEW_STATE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isViewSnapshot(parsed)) {
          console.error('[restore] saved view state carries no ui object — refused');
          return null;
        }
        return parsed;
      } catch {
        console.error('[restore] saved view state is not valid JSON — ignored');
        return null;
      }
    },
    watch(onChange: () => void): () => void {
      return storage.watch(VIEW_STATE_KEY, onChange);
    },
  };
}
