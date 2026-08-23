/** REPO: domain access to the passive-radiator collection. Takes a storage, returns records. */
import type { SweepParams } from '@openisd/engine';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';

// Passive radiators: the read-only PRs that ship in the driver bundle, plus the ones the user
// saved. Arguments in, records out — it decides nothing.

export const PR_LIB_KEY = 'openisd_pr_lib';

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

/**
 * A bundled passive radiator (from a driver collection's openisd.yml). PRs
 * have no WDR — WinISD doesn't model them — so they are bundled separately and
 * shown only in the Browse-PR popup. Manufacturers publish only Sd/Cms/Vas/weight
 * for a PR; Fs/Mms/Rms/Xmax are typically absent (null), never fabricated.
 */
export interface BundledPR {
  key: string;
  sourceName: string;
  path: string;
  name: string;
  brand: string;
  model: string;
  Sd: number | null;
  Cms: number | null;
  Vas: number | null;
  weightKg: number | null;
  datasheet: string;
  manu_page_url: string;
}

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

export function createPrRepo(storage: KeyValueStorage, bundle: { passiveRadiators?: BundledPR[] }): PrRepo {
  function list(): PRLibEntry[] {
    try {
      const parsed: unknown = JSON.parse(storage.get(PR_LIB_KEY) ?? '[]');
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
      storage.set(PR_LIB_KEY, JSON.stringify(next));
      return next;
    },
    remove(id) {
      const next = list().filter(e => e.id !== id);
      storage.set(PR_LIB_KEY, JSON.stringify(next));
      return next;
    },
  };
}
