import type { PRLibEntry } from '../types.js';
import type { SweepParams } from '@openisd/engine';

/** The PR fields savePR persists — accepts any params object carrying them. */
type PRSaveParams = Pick<SweepParams, 'prSd' | 'prMmd' | 'prCms' | 'prRms' | 'prXmax'>;

const KEY = 'openisd_pr_lib';
const KEY_LEGACY = 'resonate_pr_lib';   // pre-OpenISD key — read-fallback so a saved PR library survives the rename

function load(): PRLibEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(KEY_LEGACY) ?? '[]'); } catch { return []; }
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
