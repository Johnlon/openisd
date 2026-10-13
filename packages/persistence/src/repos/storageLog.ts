/** REPO: the storage log — what the store held at each app start, so a key that was there and is
 *  gone is seen and said (T058: John lost every saved driver at localhost:4000 and nothing
 *  recorded it).
 *
 *  Each start appends one entry: the ISO 8601 basic time, and per `openisd_` key its length, or
 *  null when a key the app owns is absent. The last 30 entries are kept. A key present in the
 *  previous entry and absent now is LOST. A key the app itself removes is not lost: `observe`
 *  wraps the storage the app writes through, and keeps the current entry in step with the app's
 *  own writes, so only a removal the app did not make shows up at the next start. */
import {basicUtc} from '@openisd/design/fields';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {
  OPENISD_APP_SETTINGS_KEY, OPENISD_CLOUD_PREFIX, OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY,
  OPENISD_KEY_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_OPEN_SESSIONS_KEY,
  OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY, OPENISD_STORAGE_LOG_KEY, OPENISD_VIEW_KEY,
} from './storageKeys.js';
import {isStoreDataKey} from './storageSnapshot.js';

/** Entries kept, oldest dropped. */
export const MAX_LOG_ENTRIES = 30;

/** The keys whose loss the user is told about, with the words for them. */
interface TrackedKey { readonly key: string; readonly what: string; readonly plural: boolean }
const TRACKED: readonly TrackedKey[] = [
  {key: OPENISD_MY_DRIVERS_KEY, what: 'Saved drivers', plural: true},
  {key: OPENISD_MY_PASSIVE_RADIATORS_KEY, what: 'Saved passive radiators', plural: true},
  {key: OPENISD_PROJECTS_KEY, what: 'Saved projects', plural: true},
  {key: OPENISD_STATE_KEY, what: 'The autosaved project', plural: false},
  {key: OPENISD_OPEN_SESSIONS_KEY, what: 'The open projects', plural: true},
  {key: OPENISD_VIEW_KEY, what: 'The saved view', plural: false},
  {key: OPENISD_APP_SETTINGS_KEY, what: 'The saved Options', plural: true},
  {key: OPENISD_FAVOURITE_DRIVERS_KEY, what: 'Favourite drivers', plural: true},
  {key: OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY, what: 'Favourite passive radiators', plural: true},
];

/** What one start saw: key to length, or null for a key the app owns that was absent. */
export interface LogEntry {
  /** ISO 8601 basic UTC. */
  readonly at: string;
  readonly keys: Readonly<Record<string, number | null>>;
}

/** A key that was in the previous entry and is gone now. */
export interface LostKey {
  readonly key: string;
  /** What was lost, as a noun phrase: "Saved drivers", "The autosaved project". */
  readonly what: string;
  /** Whether `what` is plural ("were", "they") or singular ("was", "it"). */
  readonly plural: boolean;
  /** When the previous entry saw it, ISO 8601 basic UTC. */
  readonly lastSeenAt: string;
}

export interface StorageLog {
  /** Append this start's entry; the keys lost since the previous entry. Call once, before any load. */
  recordStart(): LostKey[];
  /** `storage`, with the app's own writes and removals kept in the current entry. */
  observe(storage: ListableStorage): ListableStorage;
  /** The log as a downloadable text. */
  exportText(): string;
}

function isEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) return false;
  if (!('at' in value) || typeof value.at !== 'string') return false;
  if (!('keys' in value) || typeof value.keys !== 'object' || value.keys === null) return false;
  return Object.values(value.keys).every(v => v === null || typeof v === 'number');
}

function readEntries(text: string | null): LogEntry[] {
  if (text === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }
  if (typeof parsed !== 'object' || parsed === null || !('entries' in parsed) || !Array.isArray(parsed.entries)) return [];
  return parsed.entries.filter(isEntry);
}

export function createStorageLog(storage: ListableStorage, now: () => number): StorageLog {
  function write(entries: readonly LogEntry[]): void {
    storage.set(OPENISD_STORAGE_LOG_KEY, JSON.stringify({entries: entries.slice(-MAX_LOG_ENTRIES)}));
  }

  function currentKeys(): Record<string, number | null> {
    const keys: Record<string, number | null> = {};
    for (const tracked of TRACKED) keys[tracked.key] = null;
    for (const key of storage.keys()) {
      if (!key.startsWith(OPENISD_KEY_PREFIX) || key === OPENISD_STORAGE_LOG_KEY || key.startsWith(OPENISD_CLOUD_PREFIX)) continue;
      keys[key] = storage.get(key)?.length ?? null;
    }
    return keys;
  }

  /** Set `key` in the newest entry to `length`. */
  function amendLast(key: string, length: number | null): void {
    const entries = readEntries(storage.get(OPENISD_STORAGE_LOG_KEY));
    const last = entries.pop();
    if (last === undefined) return;
    write([...entries, {at: last.at, keys: {...last.keys, [key]: length}}]);
  }

  return {
    recordStart() {
      const previous = readEntries(storage.get(OPENISD_STORAGE_LOG_KEY));
      const before = previous.length === 0 ? null : previous[previous.length - 1];
      const entry: LogEntry = {at: basicUtc(now()), keys: currentKeys()};
      write([...previous, entry]);
      if (before === null) return [];
      return TRACKED
        .filter(t => typeof before.keys[t.key] === 'number' && entry.keys[t.key] === null)
        .map((t): LostKey => ({key: t.key, what: t.what, plural: t.plural, lastSeenAt: before.at}));
    },

    observe(inner) {
      const present = new Set(Object.entries(currentKeys()).filter(([, length]) => length !== null).map(([key]) => key));
      return {
        keys: () => inner.keys(),
        get: key => inner.get(key),
        set(key, value) {
          inner.set(key, value);
          if (isStoreDataKey(key) && !present.has(key) && inner.get(key) === value) {
            present.add(key);
            amendLast(key, value.length);
          }
        },
        remove(key) {
          inner.remove(key);
          if (isStoreDataKey(key) && present.has(key) && inner.get(key) === null) {
            present.delete(key);
            amendLast(key, null);
          }
        },
        watch: (key, onChange) => inner.watch(key, onChange),
      };
    },

    exportText() {
      return JSON.stringify({entries: readEntries(storage.get(OPENISD_STORAGE_LOG_KEY))}, null, 2);
    },
  };
}
