import type { KeyValueStorage } from '../storage/keyValueStorage.js';
import {
  BodyHash,
  ChangeCursor,
  type ConflictCopy,
  DeviceId,
  type DocId,
  docIdEquals,
  DriverId,
  field,
  FileId,
  PrId,
  ProjectId,
  RevisionId,
} from '@openisd/design/cloud';

/** Where the ledger is stored; absent on a device that never synced. */
export const LEDGER_KEY = 'openisd_cloud_state';

interface StoredRow {
  readonly id: DocId;
  readonly fileId: string;
  readonly revision: string;
  readonly hash: string;
  readonly seq: number;
}

interface StoredConflict {
  readonly id: { readonly kind: 'project' | 'driver' | 'pr'; readonly text: string };
  readonly name: string;
  readonly from: string;
  readonly at_ms: number;
}

interface StoredLedger {
  readonly rows: readonly StoredRow[];
  readonly cursor: string | null;
  readonly conflicts: readonly StoredConflict[];
  readonly deviceId: string;
  readonly maxSeq: number;
}

function parseDocId(val: unknown): DocId | null {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return null;
  const kind = field(val, 'kind');
  if (kind === 'settings') return { kind: 'settings' };
  if (kind === 'favourites') return { kind: 'favourites' };
  if (kind === 'project' || kind === 'driver' || kind === 'pr' || kind === 'projectBin') {
    const uuid = field(val, 'uuid');
    if (typeof uuid === 'string' && uuid.length > 0) {
      return { kind, uuid };
    }
  }
  return null;
}

function parseStoredRow(val: unknown): StoredRow | null {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return null;
  const id = parseDocId(field(val, 'id'));
  if (id === null) return null;
  const fileId = field(val, 'fileId');
  if (typeof fileId !== 'string') return null;
  const revision = field(val, 'revision');
  if (typeof revision !== 'string') return null;
  const hash = field(val, 'hash');
  if (typeof hash !== 'string') return null;
  const seq = field(val, 'seq');
  if (typeof seq !== 'number' || !Number.isFinite(seq)) return null;
  return { id, fileId, revision, hash, seq };
}

function parseStoredConflict(val: unknown): StoredConflict | null {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return null;
  const idVal = field(val, 'id');
  if (typeof idVal !== 'object' || idVal === null || Array.isArray(idVal)) return null;
  const kindVal = field(idVal, 'kind');
  if (kindVal !== 'project' && kindVal !== 'driver' && kindVal !== 'pr') return null;
  const textVal = field(idVal, 'text');
  if (typeof textVal !== 'string' || textVal === '') return null;
  const nameVal = field(val, 'name');
  if (typeof nameVal !== 'string') return null;
  const fromVal = field(val, 'from');
  if (typeof fromVal !== 'string' || fromVal === '') return null;
  const atMsVal = field(val, 'at_ms');
  if (typeof atMsVal !== 'number' || !Number.isFinite(atMsVal)) return null;
  return {
    id: { kind: kindVal, text: textVal },
    name: nameVal,
    from: fromVal,
    at_ms: atMsVal,
  };
}

function parseStoredLedger(obj: unknown): StoredLedger | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const rowsVal = field(obj, 'rows');
  if (!Array.isArray(rowsVal)) return null;
  const parsedRows: StoredRow[] = [];
  for (const r of rowsVal) {
    const parsedRow = parseStoredRow(r);
    if (parsedRow !== null) {
      parsedRows.push(parsedRow);
    }
  }

  const cursorVal = field(obj, 'cursor');
  let cursor: string | null = null;
  if (cursorVal !== null && cursorVal !== undefined) {
    if (typeof cursorVal !== 'string') return null;
    cursor = cursorVal;
  }

  const conflictsVal = field(obj, 'conflicts');
  if (!Array.isArray(conflictsVal)) return null;
  const parsedConflicts: StoredConflict[] = [];
  for (const c of conflictsVal) {
    const parsedConflict = parseStoredConflict(c);
    if (parsedConflict !== null) {
      parsedConflicts.push(parsedConflict);
    }
  }

  const deviceIdVal = field(obj, 'deviceId');
  if (typeof deviceIdVal !== 'string') return null;

  const maxSeqVal = field(obj, 'maxSeq');
  if (typeof maxSeqVal !== 'number' || !Number.isFinite(maxSeqVal)) return null;

  return {
    rows: parsedRows,
    cursor,
    conflicts: parsedConflicts,
    deviceId: deviceIdVal,
    maxSeq: maxSeqVal,
  };
}

function emptyLedger(): StoredLedger {
  return {
    rows: [],
    cursor: null,
    conflicts: [],
    deviceId: '',
    maxSeq: 0,
  };
}

function readLedger(storage: KeyValueStorage): StoredLedger {
  const raw = storage.get(LEDGER_KEY);
  if (!raw) return emptyLedger();
  try {
    const parsed: unknown = JSON.parse(raw);
    const ledger = parseStoredLedger(parsed);
    if (ledger === null) return emptyLedger();
    return ledger;
  } catch {
    return emptyLedger();
  }
}

function writeLedger(storage: KeyValueStorage, ledger: StoredLedger): void {
  storage.set(LEDGER_KEY, JSON.stringify(ledger));
}

function mintDeviceId(random: () => Uint8Array): string {
  const bytes = random();
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex !== '' ? hex : '00';
}

function getOrCreateDeviceId(storage: KeyValueStorage, random: () => Uint8Array): DeviceId {
  const ledger = readLedger(storage);
  const existing = DeviceId.of(ledger.deviceId);
  if (existing !== null) return existing;
  // mintDeviceId never returns an empty string, so DeviceId.of always accepts it.
  const deviceId = DeviceId.of(mintDeviceId(random));
  if (deviceId === null) throw new Error('mintDeviceId produced an empty id');
  const updated: StoredLedger = { ...ledger, deviceId: deviceId.text };
  writeLedger(storage, updated);
  return deviceId;
}

function conflictIdToStored(id: ProjectId | DriverId | PrId): { readonly kind: 'project' | 'driver' | 'pr'; readonly text: string } {
  if (id instanceof ProjectId) return { kind: 'project', text: id.text };
  if (id instanceof DriverId) return { kind: 'driver', text: id.text };
  return { kind: 'pr', text: id.text };
}

function conflictIdFromStored(stored: { readonly kind: 'project' | 'driver' | 'pr'; readonly text: string }): ProjectId | DriverId | PrId | null {
  switch (stored.kind) {
    case 'project':
      return ProjectId.of(stored.text);
    case 'driver':
      return DriverId.of(stored.text);
    case 'pr':
      return PrId.of(stored.text);
  }
}

function rebuildRow(stored: StoredRow): LedgerRow | null {
  const fileId = FileId.of(stored.fileId);
  const revision = RevisionId.of(stored.revision);
  const hash = BodyHash.of(stored.hash);
  if (fileId === null || revision === null || hash === null) return null;
  return {
    id: stored.id,
    fileId,
    revision,
    hash,
    seq: stored.seq,
  };
}

export interface LedgerRow {
  readonly id: DocId;
  readonly fileId: FileId;
  readonly revision: RevisionId;
  readonly hash: BodyHash;
  readonly seq: number;
}

export interface SyncLedger {
  rows(): LedgerRow[];
  row(id: DocId): LedgerRow | null;
  set(row: LedgerRow): void;
  drop(id: DocId): void;
  cursor(): ChangeCursor | null;
  setCursor(c: ChangeCursor | null): void;
  deviceId(): DeviceId;
  observe(seq: number): void;
  nextSeq(): number;
  conflicts(): ConflictCopy[];
  addConflict(c: ConflictCopy): void;
  clearConflict(id: ConflictCopy['id']): void;
  forgetAll(): void;
}

export function createSyncLedger(deps: { readonly storage: KeyValueStorage; readonly random: () => Uint8Array }): SyncLedger {
  const { storage, random } = deps;
  const deviceId = getOrCreateDeviceId(storage, random);

  function load(): StoredLedger {
    return readLedger(storage);
  }

  function save(ledger: StoredLedger): void {
    writeLedger(storage, ledger);
  }

  return {
    rows() {
      const ledger = load();
      const result: LedgerRow[] = [];
      for (const stored of ledger.rows) {
        const rebuilt = rebuildRow(stored);
        if (rebuilt !== null) result.push(rebuilt);
      }
      return result;
    },

    row(id: DocId) {
      const ledger = load();
      for (const stored of ledger.rows) {
        if (docIdEquals(stored.id, id)) {
          return rebuildRow(stored);
        }
      }
      return null;
    },

    set(row: LedgerRow) {
      const ledger = load();
      const storedRow: StoredRow = {
        id: row.id,
        fileId: row.fileId.toString(),
        revision: row.revision.toString(),
        hash: row.hash.toString(),
        seq: row.seq,
      };
      const existingIndex = ledger.rows.findIndex(r => docIdEquals(r.id, row.id));
      let newRows: StoredRow[];
      if (existingIndex >= 0) {
        newRows = [...ledger.rows];
        newRows[existingIndex] = storedRow;
      } else {
        newRows = [...ledger.rows, storedRow];
      }
      save({ ...ledger, rows: newRows, maxSeq: Math.max(ledger.maxSeq, row.seq) });
    },

    drop(id: DocId) {
      const ledger = load();
      const newRows = ledger.rows.filter(r => !docIdEquals(r.id, id));
      if (newRows.length !== ledger.rows.length) {
        save({ ...ledger, rows: newRows });
      }
    },

    cursor() {
      const ledger = load();
      if (ledger.cursor === null || ledger.cursor === '') return null;
      return ChangeCursor.of(ledger.cursor);
    },

    setCursor(c: ChangeCursor | null) {
      const ledger = load();
      save({ ...ledger, cursor: c !== null ? c.toString() : null });
    },

    deviceId() {
      return deviceId;
    },

    observe(seq: number) {
      if (seq < 0 || !Number.isFinite(seq)) return;
      const ledger = load();
      if (seq > ledger.maxSeq) {
        save({ ...ledger, maxSeq: seq });
      }
    },

    nextSeq() {
      const ledger = load();
      return ledger.maxSeq + 1;
    },

    conflicts() {
      const ledger = load();
      const result: ConflictCopy[] = [];
      for (const stored of ledger.conflicts) {
        const id = conflictIdFromStored(stored.id);
        const from = DeviceId.of(stored.from);
        if (id !== null && from !== null) {
          result.push({ id, name: stored.name, from, at_ms: stored.at_ms });
        }
      }
      return result;
    },

    addConflict(c: ConflictCopy) {
      const ledger = load();
      const stored: StoredConflict = {
        id: conflictIdToStored(c.id),
        name: c.name,
        from: c.from.text,
        at_ms: c.at_ms,
      };
      const existingIndex = ledger.conflicts.findIndex(
        st => st.id.kind === stored.id.kind && st.id.text === stored.id.text
      );
      let newConflicts: StoredConflict[];
      if (existingIndex >= 0) {
        newConflicts = [...ledger.conflicts];
        newConflicts[existingIndex] = stored;
      } else {
        newConflicts = [...ledger.conflicts, stored];
      }
      save({ ...ledger, conflicts: newConflicts });
    },

    clearConflict(id: ConflictCopy['id']) {
      const ledger = load();
      const storedId = conflictIdToStored(id);
      const newConflicts = ledger.conflicts.filter(
        st => !(st.id.kind === storedId.kind && st.id.text === storedId.text)
      );
      if (newConflicts.length !== ledger.conflicts.length) {
        save({ ...ledger, conflicts: newConflicts });
      }
    },

    forgetAll() {
      const ledger = load();
      save({
        ...ledger,
        rows: [],
        cursor: null,
        conflicts: [],
      });
    },
  };
}
/** Set once this device has listed every Drive file after the re-upload bug (T151) could leave
 *  duplicate copies; a full listing is what finds and removes them. Per device, never backed up. */
const RELISTED_KEY = 'openisd_cloud_relisted_t154';

/** Drops the change cursor the first time it is called on this device, so the next run lists
 *  every Drive file; afterwards it does nothing. */
export function relistOnce(storage: KeyValueStorage, ledger: SyncLedger): void {
  if (storage.get(RELISTED_KEY) !== null) return;
  ledger.setCursor(null);
  storage.set(RELISTED_KEY, '1');
}
