import type { PRLibEntry, BundledPR } from '../types.js';
import type { SweepParams } from '@openisd/engine';
import type { KeyValueStore } from './kv.js';

// The passive-radiator library: the read-only PRs that ship in the driver bundle, plus the
// ones the user saved. Arguments in, records out — it decides nothing.

export const PR_LIB_KEY = 'openisd_pr_lib';

/** The PR fields `save` persists — accepts any params object carrying them. */
type PRSaveParams = Pick<SweepParams, 'prSd' | 'prMmd' | 'prCms' | 'prRms' | 'prXmax'>;

export interface PrRepo {
  /** Passive radiators pre-bundled from the driver collections (read-only). */
  bundled(): BundledPR[];
  /** The user's own saved PRs. */
  list(): PRLibEntry[];
  /** Save one, and return the list as it now stands. */
  save(name: string, P: PRSaveParams): PRLibEntry[];
  /** Delete one, and return the list as it now stands. */
  remove(id: number): PRLibEntry[];
}

export function createPrRepo(store: KeyValueStore, bundle: { passiveRadiators?: BundledPR[] }): PrRepo {
  function list(): PRLibEntry[] {
    try {
      const parsed: unknown = JSON.parse(store.get(PR_LIB_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as PRLibEntry[]) : [];
    } catch { return []; }
  }

  return {
    bundled() { return bundle.passiveRadiators ?? []; },
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
      store.set(PR_LIB_KEY, JSON.stringify(next));
      return next;
    },
    remove(id) {
      const next = list().filter(e => e.id !== id);
      store.set(PR_LIB_KEY, JSON.stringify(next));
      return next;
    },
  };
}
