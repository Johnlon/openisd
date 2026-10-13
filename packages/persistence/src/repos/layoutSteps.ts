/** The layout steps, in order, one per layout the store has moved through. A step is never edited
 *  once shipped: a later layout adds a step. Each is proved against its golden dumps by
 *  `storageUpgrade.test.ts`. */
import type {FileJson, LayoutStep, StoreData} from './layoutMigration.js';
import {OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_PROJECTS_KEY} from './storageKeys.js';

function parsed(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The list a layout-1 saved-entries bucket holds: a bare array, or `{schema, entries}`. */
function entriesOfBucket(value: unknown): readonly unknown[] | null {
  if (isUnknownArray(value)) return value;
  if (isRecord(value) && isUnknownArray(value.entries)) return value.entries;
  return null;
}

/** Layout 1 -> 2: in-store records drop their own version. My Drivers and My Passive Radiators
 *  were `{schema: 1, entries}` (or a bare array before that); saved projects were
 *  `{version: 1, entries}`. All are `{entries}` now; the store's layout covers them. A text that
 *  is not a readable bucket stays exactly as it is: the repo that owns it reports it. */
const STEP_1_TO_2: LayoutStep = {
  from: 1,
  migrate(data: StoreData): StoreData {
    const next: Record<string, string> = {...data};
    for (const key of [OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_PROJECTS_KEY]) {
      const text = data[key];
      if (text === undefined) continue;
      const entries = entriesOfBucket(parsed(text));
      if (entries !== null) next[key] = JSON.stringify({entries});
    }
    return next;
  },
  /** Exported `.owpr` and `.owdr` files did not change between layouts 1 and 2. */
  migrateFile: (file: FileJson): FileJson => file,
};

export const LAYOUT_STEPS: readonly LayoutStep[] = [STEP_1_TO_2];
