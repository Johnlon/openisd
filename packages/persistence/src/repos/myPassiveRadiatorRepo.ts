/** REPO: the passive radiators the USER saved. Takes a storage, returns records.
 *
 *  The radiator counterpart of `myDriverRepo` — same role, same lifecycle: writable, held in
 *  the browser's key-value storage, and nothing to do with the read-only radiators that ship
 *  in the bundle. */
import type { SweepParams } from '@openisd/design/engine';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';

export const MY_PASSIVE_RADIATORS_KEY = 'openisd_pr_lib';

/** A saved passive-radiator library entry. */
export interface PRLibEntry {
  id: number;
  name: string;
  prSd: number;
  prMmd: number;
  prCms: number;
  prRms: number;
  prXmax: number;
  savedAt: string;
}

/** The fields `save` persists — accepts any params object carrying them. */
type PRSaveParams = Pick<SweepParams, 'prSd' | 'prMmd' | 'prCms' | 'prRms' | 'prXmax'>;

export interface MyPassiveRadiatorRepo {
  /** The user's own saved radiators. */
  list(): PRLibEntry[];
  /** Save one, and return the list as it now stands. */
  save(name: string, P: PRSaveParams): PRLibEntry[];
  /** Delete one, and return the list as it now stands. */
  remove(id: number): PRLibEntry[];
}

export function createMyPassiveRadiatorRepo(storage: KeyValueStorage): MyPassiveRadiatorRepo {
  function list(): PRLibEntry[] {
    try {
      const parsed: unknown = JSON.parse(storage.get(MY_PASSIVE_RADIATORS_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as PRLibEntry[]) : [];
    } catch { return []; }
  }

  return {
    list,
    save(name, P) {
      const next = list();
      next.push({
        id: Date.now(),
        name,
        prSd: P.prSd!,
        prMmd: P.prMmd!,
        prCms: P.prCms!,
        prRms: P.prRms!,
        prXmax: P.prXmax!,
        savedAt: new Date().toISOString(),
      });
      storage.set(MY_PASSIVE_RADIATORS_KEY, JSON.stringify(next));
      return next;
    },
    remove(id) {
      const next = list().filter(e => e.id !== id);
      storage.set(MY_PASSIVE_RADIATORS_KEY, JSON.stringify(next));
      return next;
    },
  };
}
