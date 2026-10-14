/** Keeps Cloud sync from seeing a stored-text rewrite as an edit. The sync hash covers the stored
 *  text, so a project nobody edited gets its ledger hash moved to the hash of its rewritten text.
 *  A project edited here since its last sync, or unknown to the ledger, is left as it is. A device
 *  that never synced has no ledger, and none is created. */
import {bodyHashOf} from '@openisd/design/cloud';
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import type {ProjectRewritten} from '../repos/storedTextCompaction.js';
import {createSyncLedger, LEDGER_KEY} from './syncLedger.js';

export function followStoredTextRewrite(storage: KeyValueStorage, random: () => Uint8Array): ProjectRewritten {
  return (projectId, before, after) => {
    if (storage.get(LEDGER_KEY) === null) return;
    const ledger = createSyncLedger({storage, random});
    const row = ledger.row({kind: 'project', uuid: projectId});
    const beforeHash = bodyHashOf(before);
    const afterHash = bodyHashOf(after);
    if (row === null || beforeHash === null || afterHash === null) return;
    if (row.hash.toString() !== beforeHash.toString()) return;
    ledger.set({...row, hash: afterHash});
  };
}
