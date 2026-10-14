/** REPO: removes the old quarantine copy of the open-project session (`openisd_quarantine_session`).
 *  Refused copies replace it: each entry that would not read is kept whole under
 *  `openisd_refused_*`. The old copy goes once, behind the whole-store backup, so it stays
 *  recoverable from that backup. */
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {StorageBackup} from './storageBackup.js';
import {OPENISD_QUARANTINE_SESSION_KEY} from './storageKeys.js';

export type QuarantineRetirementOutcome = 'nothingToDo' | 'retired' | 'refused';

export interface QuarantineRetirement {
  run(): QuarantineRetirementOutcome;
}

export function createQuarantineRetirement(storage: ListableStorage, backup: StorageBackup): QuarantineRetirement {
  return {
    run() {
      if (storage.get(OPENISD_QUARANTINE_SESSION_KEY) === null) return 'nothingToDo';
      const guarded = backup.guard('startUpRewrite', () => storage.remove(OPENISD_QUARANTINE_SESSION_KEY));
      return guarded.kind === 'ran' ? 'retired' : 'refused';
    },
  };
}
