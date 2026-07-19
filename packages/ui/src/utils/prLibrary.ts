import type { PRLibEntry, BundledPR } from '../types.js';
import type { SweepParams } from '@openisd/engine';
import bundleJson from '../drivers-bundle.json';

/** Passive radiators pre-bundled from the driver collections (read-only). */
export function listBundledPRs(): BundledPR[] {
  return (bundleJson as { passiveRadiators?: BundledPR[] }).passiveRadiators ?? [];
}

/** The PR fields savePR persists — accepts any params object carrying them. */
type PRSaveParams = Pick<SweepParams, 'prSd' | 'prMmd' | 'prCms' | 'prRms' | 'prXmax'>;

const KEY = 'openisd_pr_lib';

function load(): PRLibEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function listPRs(): PRLibEntry[] {
  return load();
}

export function savePR(name: string, P: PRSaveParams): PRLibEntry[] {
  const list = load();
  list.push({
    id: Date.now(),
    name,
    prSd: P.prSd!,
    prMmd: P.prMmd!,
    prCms: P.prCms!,
    prRms: P.prRms!,
    prXmax: P.prXmax!,
    savedAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function deletePR(id: number): PRLibEntry[] {
  const list = load().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}
