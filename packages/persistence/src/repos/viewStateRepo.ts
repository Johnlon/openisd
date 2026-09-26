/** REPO: view/UI preferences — panel sizes, unit tokens, chart colours, username, env
 *  defaults (`ViewSnapshot`, declared in `projectRepo.ts`). Persisted under its OWN storage key,
 *  independent of the project
 *  (QO90 — a saved `.owpr`/autosave carries only the project; view state is not part of it).
 *  No schema-upgrade seam, no share-link door: a share link keeps carrying the whole session
 *  through `ProjectRepo`'s own `stateToUrl`/`loadFromHash` (human ruling 2026-08-14) — this
 *  repo only ever needs local persistence. */
import type {ChartView, ViewRange, ViewSnapshot} from './projectRepo.js';
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

/** Parse at the boundary: a finite range with `min` below `max`, or nothing. */
function parseRange(raw: unknown): ViewRange | null {
  if (typeof raw !== 'object' || raw === null || !('min' in raw) || !('max' in raw)) return null;
  const {min, max} = raw;
  if (typeof min !== 'number' || typeof max !== 'number') return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;
  return {min, max};
}

/** Parse at the boundary: the chart view, or nothing when its sweep range is bad. A bad Y
 *  range (the Options dialog can hold one with only one end set) is dropped alone, so that
 *  chart auto-scales. */
function parseChartView(raw: unknown): ChartView | null {
  if (typeof raw !== 'object' || raw === null || !('sweepRange' in raw) || !('yRanges' in raw)) return null;
  const sweepRange = parseRange(raw.sweepRange);
  if (sweepRange === null || typeof raw.yRanges !== 'object' || raw.yRanges === null) return null;
  const yRanges: Record<string, ViewRange> = {};
  for (const [chart, r] of Object.entries(raw.yRanges)) {
    const range = parseRange(r);
    if (range !== null) yRanges[chart] = range;
  }
  return {sweepRange, yRanges};
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
        const chart = 'chart' in parsed ? parseChartView(parsed.chart) : null;
        return chart === null ? {ui: parsed.ui} : {ui: parsed.ui, chart};
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
