/** The snapshot envelope: every data key of the store, plus the layout and build of the app that
 *  wrote it, as one JSON text. It is the shape of an in-store backup, of the downloaded backup
 *  file and of a raw export — one shape, so a backup row can be exported or restored as it is. */
import {basicUtc} from '@openisd/design/fields';
import {BuildStamp} from './buildStamp.js';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_CLOUD_PREFIX, OPENISD_KEY_PREFIX, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
  OPENISD_STORAGE_LOG_KEY,
} from './storageKeys.js';

/** Bumped only if the envelope's own shape changes — not on every app release. */
const ENVELOPE_VERSION = 1;

export interface StoreSnapshot {
  /** The layout of the app that wrote this data. */
  readonly layout: number;
  /** The build of the app that wrote this data. */
  readonly build: BuildStamp;
  /** When the snapshot was taken, ISO 8601 basic UTC. */
  readonly exportedAt: string;
  /** One entry per data key that held something; an absent key held nothing. */
  readonly data: Readonly<Record<string, string>>;
}

export type EnvelopeRead =
  | {kind: 'ok'; snapshot: StoreSnapshot}
  | {kind: 'invalid'; reason: string};

/** Whether `key` is store DATA: an `openisd_` key that is not a whole-store backup, the log,
 *  the layout/build stamps, or per-device cloud keys. A backup copies exactly these. */
export function isStoreDataKey(key: string): boolean {
  return key.startsWith(OPENISD_KEY_PREFIX)
    && !key.startsWith(OPENISD_BACKUP_PREFIX)
    && !key.startsWith(OPENISD_CLOUD_PREFIX)
    && key !== OPENISD_STORAGE_LOG_KEY
    && key !== OPENISD_STORAGE_LAYOUT_KEY
    && key !== OPENISD_STORAGE_BUILD_KEY;
}

/** Whether a whole-store backup copies `key`: store data that is not itself a pre-repair copy
 *  (`openisd_<record>_backup`). A backup holding those copies was a backup of backups: on 13 Oct
 *  2026 one such copy came to 2.8 MB of a 5 MB browser and saving stopped. */
export function isBackedUpKey(key: string): boolean {
  return isStoreDataKey(key) && !PRE_REPAIR_COPY_KEYS.has(key);
}
const PRE_REPAIR_COPY_KEYS: ReadonlySet<string> = new Set(Object.values(OPENISD_BACKUP_KEYS));

/** A layout number as read from storage or a file: a whole number of 1 or more, else null. */
export function parseLayout(value: string | number | null): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : null;
}

/** The store's data, and the layout and build it says wrote it. */
export interface StorageSnapshot {
  /** Every data key the store holds, verbatim. */
  data(): Record<string, string>;
  /** The layout the store records. A store holding data but no layout key was written before
   *  layouts existed: layout 1. An empty store has nothing to read: null. */
  layout(): number | null;
  /** The store as it is now, stamped with the layout and build it records; null when it holds no data. */
  take(): StoreSnapshot | null;
}

export function createStorageSnapshot(storage: ListableStorage, now: () => number): StorageSnapshot {
  function data(): Record<string, string> {
    const held: Record<string, string> = {};
    for (const key of storage.keys().filter(isBackedUpKey).sort()) {
      const value = storage.get(key);
      if (value !== null) held[key] = value;
    }
    return held;
  }
  function layout(): number | null {
    const stored = parseLayout(storage.get(OPENISD_STORAGE_LAYOUT_KEY));
    if (stored !== null) return stored;
    return Object.keys(data()).length === 0 ? null : 1;
  }
  return {
    data,
    layout,
    take() {
      const held = data();
      const stored = layout();
      if (stored === null) return null;
      return {layout: stored, build: BuildStamp.ofStored(storage.get(OPENISD_STORAGE_BUILD_KEY)), exportedAt: basicUtc(now()), data: held};
    },
  };
}

/** A snapshot of a store that holds nothing, as written by an app of `layout`. */
export function emptySnapshot(layout: number, nowMs: number): StoreSnapshot {
  return {layout, build: BuildStamp.UNKNOWN, exportedAt: basicUtc(nowMs), data: {}};
}

export function envelopeText(snapshot: StoreSnapshot, pretty: boolean): string {
  const envelope = {
    openisdBackup: true,
    schemaVersion: ENVELOPE_VERSION,
    layout: snapshot.layout,
    build: snapshot.build.text,
    exportedAt: snapshot.exportedAt,
    data: snapshot.data,
  };
  return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}

/** Parse an envelope at the boundary. A file or backup from before layouts has no `layout`: it
 *  is layout 1, and its build is unknown. */
export function readEnvelope(text: string): EnvelopeRead {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return {kind: 'invalid', reason: 'Not a valid JSON file.'}; }
  if (typeof parsed !== 'object' || parsed === null || !('openisdBackup' in parsed) || parsed.openisdBackup !== true
    || !('data' in parsed) || typeof parsed.data !== 'object' || parsed.data === null) {
    return {kind: 'invalid', reason: 'Not an OpenISD backup file (missing or malformed envelope).'};
  }
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value !== 'string') {
      return {kind: 'invalid', reason: 'Not an OpenISD backup file (missing or malformed envelope).'};
    }
    data[key] = value;
  }
  let layout = 1;
  if ('layout' in parsed) {
    const read = parseLayout(typeof parsed.layout === 'number' ? parsed.layout : null);
    if (read === null) return {kind: 'invalid', reason: 'The backup file names a layout this app cannot read.'};
    layout = read;
  }
  const build = 'build' in parsed && typeof parsed.build === 'string' ? BuildStamp.ofStored(parsed.build) : BuildStamp.UNKNOWN;
  const exportedAt = 'exportedAt' in parsed && typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '';
  return {kind: 'ok', snapshot: {layout, build, exportedAt, data}};
}
