/** SERVICE: how much of this browser's storage each kind of the user's data takes, for the
 *  Options "Your data" Storage group. Read only. Sizes are characters of key plus value, the unit
 *  a browser's storage limit counts. */
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {ProjectBin} from './projectBin.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_BACKUP_PREFIX, OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY, OPENISD_KEY_PREFIX,
  OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECT_BIN_KEY, OPENISD_PROJECTS_KEY,
  OPENISD_QUARANTINE_SESSION_KEY, OPENISD_REFUSED_PREFIX, OPENISD_STATE_KEY,
} from './storageKeys.js';

/** Characters each group takes; `total` is their sum. */
export interface StorageUsageReport {
  /** Saved and open projects, not counting those in the Bin. */
  readonly projects: number;
  /** My Drivers, My Passive Radiators and both favourites lists. */
  readonly myDrivers: number;
  /** Projects in the Bin and the Bin's own marks. */
  readonly bin: number;
  /** Whole-store backups and every kept copy. */
  readonly backups: number;
  /** Everything else OpenISD keeps: settings, window layout, sync state, the storage log. */
  readonly settings: number;
  readonly total: number;
}

export interface StorageUsage {
  report(): StorageUsageReport;
}

type Group = 'projects' | 'myDrivers' | 'bin' | 'backups' | 'settings';

const PROJECT_KEYS: ReadonlySet<string> = new Set([OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY, OPENISD_OPEN_SESSIONS_KEY]);
const DRIVER_KEYS: ReadonlySet<string> = new Set([
  OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY,
]);
const KEPT_COPY_KEYS: ReadonlySet<string> = new Set([...Object.values(OPENISD_BACKUP_KEYS), OPENISD_QUARANTINE_SESSION_KEY]);

function groupOf(key: string): Group {
  if (PROJECT_KEYS.has(key)) return 'projects';
  if (DRIVER_KEYS.has(key)) return 'myDrivers';
  if (key === OPENISD_PROJECT_BIN_KEY) return 'bin';
  if (key.startsWith(OPENISD_BACKUP_PREFIX) || key.startsWith(OPENISD_REFUSED_PREFIX) || KEPT_COPY_KEYS.has(key)) return 'backups';
  return 'settings';
}

export function createStorageUsage(storage: ListableStorage, bin: Pick<ProjectBin, 'binned'>): StorageUsage {
  return {
    report() {
      const sums: Record<Group, number> = {projects: 0, myDrivers: 0, bin: 0, backups: 0, settings: 0};
      for (const key of storage.keys().filter(k => k.startsWith(OPENISD_KEY_PREFIX))) {
        sums[groupOf(key)] += key.length + (storage.get(key)?.length ?? 0);
      }
      // A binned project's text sits in the saved-projects record: count it under the Bin.
      const binned = Math.min(sums.projects, bin.binned().reduce((sum, p) => sum + p.bytes, 0));
      const projects = sums.projects - binned;
      const inBin = sums.bin + binned;
      return {
        projects, myDrivers: sums.myDrivers, bin: inBin, backups: sums.backups, settings: sums.settings,
        total: projects + sums.myDrivers + inBin + sums.backups + sums.settings,
      };
    },
  };
}
