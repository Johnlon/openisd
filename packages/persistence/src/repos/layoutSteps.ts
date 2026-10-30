/** The layout steps, in order, one per layout the store has moved through. A step is never edited
 *  once shipped: a later layout adds a step. Each is proved against its golden dumps by
 *  `storageUpgrade.test.ts`. */
import type {FileJson, LayoutStep, StoreData} from './layoutMigration.js';
import {OpenISDProject} from '@openisd/design';
import type {Engine} from '@openisd/design/engine';
import {
  OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY,
} from './storageKeys.js';

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

/** The id a stored project without one takes when no stored entry names it: the single autosave
 *  text of a store that has no saved entry holding the same text. */
const UNKEYED_PROJECT_ID = 'legacy';

/** `entry` (`{id, text, ...}`) with its project text carrying the entry's id as the project id. */
function entryWithProjectId(entry: unknown, engine: Engine): unknown {
  if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.text !== 'string') return entry;
  const text = OpenISDProject.textWithId(entry.text, entry.id, engine);
  return text === null ? entry : {...entry, text};
}

/** The bucket text `value` (`{entries: [...]}` plus any other fields) with every entry's project
 *  text carrying its entry id; a text that is not a readable bucket stays exactly as it is. */
function bucketWithProjectIds(value: string | undefined, engine: Engine): string | undefined {
  if (value === undefined) return undefined;
  const bucket = parsed(value);
  if (!isRecord(bucket) || !isUnknownArray(bucket.entries)) return value;
  return JSON.stringify({...bucket, entries: bucket.entries.map(entry => entryWithProjectId(entry, engine))});
}

/** The id of the saved project entry whose text is `text`, or the unkeyed id. */
function savedEntryIdOf(text: string, savedBucket: string | undefined): string {
  const bucket = savedBucket === undefined ? undefined : parsed(savedBucket);
  if (!isRecord(bucket) || !isUnknownArray(bucket.entries)) return UNKEYED_PROJECT_ID;
  const same = bucket.entries.find(entry => isRecord(entry) && entry.text === text && typeof entry.id === 'string');
  return isRecord(same) && typeof same.id === 'string' ? same.id : UNKEYED_PROJECT_ID;
}

/** Layout 2 -> 3: every stored project carries a durable id inside its text (John, QO312). A
 *  saved project and an open-session project take the id of the entry that holds them, the one
 *  key they were already found by; the autosave text takes the id of the saved entry with the
 *  same text. The same pass loads and writes each project the way every later write does: the
 *  embedded driver id is the null GUID, the keys are in the canonical order and calculated values
 *  are present. A text that is not a readable project stays exactly as it is. Exported `.owpr` files are not touched: a file with no id is given one when it is opened. */
function stepTwoToThree(engine: Engine): LayoutStep {
  return {
    from: 2,
    migrate(data: StoreData): StoreData {
      const next: Record<string, string> = {...data};
      const saved = bucketWithProjectIds(data[OPENISD_PROJECTS_KEY], engine);
      if (saved !== undefined) next[OPENISD_PROJECTS_KEY] = saved;
      const open = bucketWithProjectIds(data[OPENISD_OPEN_SESSIONS_KEY], engine);
      if (open !== undefined) next[OPENISD_OPEN_SESSIONS_KEY] = open;
      const autosave = data[OPENISD_STATE_KEY];
      if (autosave !== undefined) {
        const text = OpenISDProject.textWithId(autosave, savedEntryIdOf(autosave, data[OPENISD_PROJECTS_KEY]), engine);
        if (text !== null) next[OPENISD_STATE_KEY] = text;
      }
      return next;
    },
    migrateFile: (file: FileJson): FileJson => file,
  };
}

/** The steps that bring an older store up to the current layout. Step 2 to 3 loads and writes each
 *  stored project, so it takes an engine from the caller. The app gives it one with
 *  default settings: the store (and so the app's settings) is not readable until it is migrated. */
export function layoutStepsOn(engine: Engine): readonly LayoutStep[] {
  return [STEP_1_TO_2, stepTwoToThree(engine)];
}
