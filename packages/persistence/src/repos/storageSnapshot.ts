/** The snapshot envelope: every data key of the store, plus the layout and build of the app that
 *  wrote it, as one JSON text. It is the shape of an in-store backup, of the downloaded backup
 *  file and of a raw export — one shape, so a backup row can be exported or restored as it is. */
import {basicUtc} from '@openisd/design/fields';
import {compressToUTF16, decompressFromUTF16} from 'lz-string';
import {BuildStamp} from './buildStamp.js';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_CLOUD_PREFIX, OPENISD_REFUSED_PREFIX, OPENISD_KEY_PREFIX, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
  OPENISD_STORAGE_LOG_KEY,
} from './storageKeys.js';

/** Bumped only if the envelope's own shape changes — not on every app release. 1: the data is the
 *  `data` object. 2: the data is packed (`encoding`, `packed`), and `data` is empty. */
const ENVELOPE_VERSION = 1;
const PACKED_ENVELOPE_VERSION = 2;

/** The one encoding of packed data this build writes and reads: `JSON.stringify(data)` through lz-string's
 *  `compressToUTF16` (15 bits a character, code units 0x20 to 0x801F: never a surrogate, never a control
 *  character, so any storage and any JSON text holds it). A new encoding is a new declared value here,
 *  with its own version; a reader meeting a value it does not know refuses the backup and keeps it. */
export const PACKED_ENCODING = 'lz-utf16-1';

/** The `layout` a packed envelope states, for builds that know no encodings: they read `layout` as a plain
 *  number, find it above what they read, and restore nothing ("written by a newer OpenISD"), while
 *  listing, counting, keeping and dropping the backup like any other. The data's own layout is `dataLayout`. */
export const PACKED_LAYOUT_STATED = 1000;

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

/** Why a whole-store backup was taken. Recorded in the backup, shown on the Backups page. */
export type BackupReason =
  | 'manual' | 'sync' | 'delete' | 'deleteForever' | 'binRestore' | 'repair' | 'startUpRewrite' | 'restore' | 'reset' | 'overwrite';

const BACKUP_REASONS: readonly BackupReason[] = [
  'manual', 'sync', 'delete', 'deleteForever', 'binRestore', 'repair', 'startUpRewrite', 'restore', 'reset', 'overwrite',
];

/** `reason` is null for a downloaded export, and for a backup taken before reasons were recorded. */
export type EnvelopeRead =
  | {kind: 'ok'; snapshot: StoreSnapshot; reason: BackupReason | null}
  /** `layout` is the layout the text states, when it does: a backup this build cannot open is kept as a backup of that layout. */
  | {kind: 'invalid'; reason: string; layout?: number};

/** Whether `key` is store DATA: an `openisd_` key that is not a whole-store backup, the log,
 *  the layout/build stamps, or per-device cloud keys. A backup copies exactly these. */
export function isStoreDataKey(key: string): boolean {
  return key.startsWith(OPENISD_KEY_PREFIX)
    && !key.startsWith(OPENISD_BACKUP_PREFIX)
    && !key.startsWith(OPENISD_CLOUD_PREFIX)
    && !key.startsWith(OPENISD_REFUSED_PREFIX)
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

/** `reason` is why an in-store backup was taken; null for an export. `packed`: the data is compressed
 *  (an in-store backup); a downloaded file and a raw export are plain, portable text. */
export function envelopeText(snapshot: StoreSnapshot, pretty: boolean, reason: BackupReason | null, packed = false): string {
  if (packed) {
    return JSON.stringify({
      openisdBackup: true,
      schemaVersion: PACKED_ENVELOPE_VERSION,
      layout: PACKED_LAYOUT_STATED,
      dataLayout: snapshot.layout,
      build: snapshot.build.text,
      exportedAt: snapshot.exportedAt,
      ...(reason === null ? {} : {reason}),
      encoding: PACKED_ENCODING,
      data: {},
      packed: compressToUTF16(JSON.stringify(snapshot.data)),
    });
  }
  const envelope = {
    openisdBackup: true,
    schemaVersion: ENVELOPE_VERSION,
    layout: snapshot.layout,
    build: snapshot.build.text,
    exportedAt: snapshot.exportedAt,
    ...(reason === null ? {} : {reason}),
    data: snapshot.data,
  };
  return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}

const NOT_AN_ENVELOPE = 'Not an OpenISD backup file (missing or malformed envelope).';

/** `data` as a record of strings, or null. */
function stringRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') return null;
    record[key] = item;
  }
  return record;
}

/** Parse an envelope at the boundary. A file or backup from before layouts has no `layout`: it
 *  is layout 1, and its build is unknown. A packed envelope is unpacked here, so every reader sees
 *  the same snapshot; `headerOnly` leaves a packed one's data empty (a listing needs no data). */
export function readEnvelope(text: string, options: {readonly headerOnly?: boolean} = {}): EnvelopeRead {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return {kind: 'invalid', reason: 'Not a valid JSON file.'}; }
  if (typeof parsed !== 'object' || parsed === null || !('openisdBackup' in parsed) || parsed.openisdBackup !== true
    || !('data' in parsed) || typeof parsed.data !== 'object' || parsed.data === null) {
    return {kind: 'invalid', reason: NOT_AN_ENVELOPE};
  }
  const stated = 'layout' in parsed && typeof parsed.layout === 'number' ? parseLayout(parsed.layout) ?? undefined : undefined;
  const encoding: unknown = 'encoding' in parsed ? parsed.encoding : undefined;
  const packed = 'encoding' in parsed;
  if (packed && encoding !== PACKED_ENCODING) {
    return {kind: 'invalid', layout: stated, reason: `This backup uses a storage encoding (${String(encoding)}) that this OpenISD does not know. It was written by a newer OpenISD: update the app to read it. The backup is kept as it is.`};
  }
  let data = stringRecord(parsed.data);
  if (data === null) return {kind: 'invalid', reason: NOT_AN_ENVELOPE};
  let layout = 1;
  if (packed) {
    const dataLayout = 'dataLayout' in parsed && typeof parsed.dataLayout === 'number' ? parseLayout(parsed.dataLayout) : null;
    if (dataLayout === null) return {kind: 'invalid', layout: stated, reason: 'This backup is damaged: it does not say which layout its data has.'};
    layout = dataLayout;
    if (options.headerOnly === true) {
      data = {};
    } else {
      const unpacked = 'packed' in parsed && typeof parsed.packed === 'string' ? unpack(parsed.packed) : null;
      if (unpacked === null) return {kind: 'invalid', layout: stated, reason: 'This backup is damaged: its compressed data cannot be read. It is not restored.'};
      data = unpacked;
    }
  } else if ('layout' in parsed) {
    const read = parseLayout(typeof parsed.layout === 'number' ? parsed.layout : null);
    if (read === null) return {kind: 'invalid', reason: 'The backup file names a layout this app cannot read.'};
    layout = read;
  }
  const build = 'build' in parsed && typeof parsed.build === 'string' ? BuildStamp.ofStored(parsed.build) : BuildStamp.UNKNOWN;
  const exportedAt = 'exportedAt' in parsed && typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '';
  const reason = 'reason' in parsed ? BACKUP_REASONS.find(r => r === parsed.reason) ?? null : null;
  return {kind: 'ok', snapshot: {layout, build, exportedAt, data}, reason};
}

/** The data a packed text holds, or null when it does not unpack to a record of strings. */
function unpack(packed: string): Record<string, string> | null {
  try {
    const json = decompressFromUTF16(packed);
    return json === '' ? null : stringRecord(JSON.parse(json));
  } catch {
    return null;
  }
}
