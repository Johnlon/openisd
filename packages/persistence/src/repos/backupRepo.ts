/** REPO: a single JSON snapshot of every key `storageKeys.ts` lists — projects, My Drivers, My
 *  Passive Radiators, favourites, view/prefs, app settings — and the one place that knows how
 *  to put one back.
 *
 *  Deliberately excludes the BUNDLED catalogues (drivers/passive radiators): those are static
 *  shipped assets fetched over HTTP, never written to this storage, so they are not in
 *  `OPENISD_STORAGE_KEYS` and there is nothing here to exclude them FROM — the boundary is
 *  automatic, not a filter this repo has to apply.
 *
 *  A restore is a REPLACE, not a merge: every key `OPENISD_STORAGE_KEYS` lists is either set to
 *  the backup's value or removed if the backup does not have it, so restoring an older backup
 *  actually reverts the browser to that point in time rather than layering old data over new.
 *  The caller (the UI) is responsible for confirming this with the user before calling
 *  `importAll` — this repo does not ask. */
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import {OPENISD_STORAGE_KEYS} from './storageKeys.js';

/** Bumped only if the envelope's own shape changes — not on every app release. */
const BACKUP_SCHEMA_VERSION = 1;

interface BackupEnvelope {
  openisdBackup: true;
  schemaVersion: number;
  exportedAt: string;
  /** One entry per `OPENISD_STORAGE_KEYS` value that had something stored; an absent key means
   *  that bucket was empty, not that it was skipped. */
  data: Record<string, string>;
}

export type RestoreResult =
  | { kind: 'ok'; keysRestored: number }
  | { kind: 'invalid'; reason: string };

export interface BackupRepo {
  /** Every persisted key, as one JSON string ready to download. */
  exportAll(): string;
  /** Replace every persisted key from a previously-exported JSON string. Validates the envelope
   *  before writing anything — a malformed file changes nothing. */
  importAll(json: string): RestoreResult;
}

function isBackupEnvelope(parsed: unknown): parsed is BackupEnvelope {
  if (typeof parsed !== 'object' || parsed === null) return false;
  if (!('openisdBackup' in parsed) || parsed.openisdBackup !== true) return false;
  if (!('data' in parsed) || typeof parsed.data !== 'object' || parsed.data === null) return false;
  return Object.values(parsed.data).every(v => typeof v === 'string');
}

export function createBackupRepo(storage: KeyValueStorage): BackupRepo {
  return {
    exportAll(): string {
      const data: Record<string, string> = {};
      for (const key of Object.values(OPENISD_STORAGE_KEYS)) {
        const v = storage.get(key);
        if (v !== null) data[key] = v;
      }
      const envelope: BackupEnvelope = {
        openisdBackup: true,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      };
      return JSON.stringify(envelope, null, 2);
    },

    importAll(json: string): RestoreResult {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { kind: 'invalid', reason: 'Not a valid JSON file.' };
      }
      if (!isBackupEnvelope(parsed)) {
        return { kind: 'invalid', reason: 'Not an OpenISD backup file (missing or malformed envelope).' };
      }
      let keysRestored = 0;
      for (const key of Object.values(OPENISD_STORAGE_KEYS)) {
        const value = parsed.data[key];
        if (value === undefined) storage.remove(key);
        else { storage.set(key, value); keysRestored++; }
      }
      return { kind: 'ok', keysRestored };
    },
  };
}
