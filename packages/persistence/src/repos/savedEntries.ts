/** The envelope both saved libraries share — My Drivers and My Passive Radiators.
 *
 *      { schema: number, entries: [{ uuid: string, record: <the thing's own record> }] }
 *
 *  The two libraries differ in ONE thing: what `record` holds, and therefore which domain seam
 *  validates it. Everything else — the uuid the repo mints, the broken-entry bucket, the
 *  read-only refusal over an unreadable payload, the upgrade write-back — is identical, so it
 *  lives here once and each library supplies its own `open`/`snapshot` pair.
 *
 *  THE GOVERNING PRINCIPLE (docs/design/MY_DRIVERS_STORAGE_FAILURES.md, QO81 rulings): a saved
 *  entry in the browser has no other copy anywhere. This module therefore NEVER destroys or
 *  silently hides those bytes on its own — data leaves a bucket only by an explicit deleting
 *  call, and a corrupt bucket makes every ordinary write a refusal (read-only) so the one copy
 *  cannot be overwritten.
 *
 *  IDENTITY is a uuid minted here at save time when absent, stored ALONGSIDE the record and
 *  never inside it — an id that travelled with the record could leak into a file export. A
 *  stored uuid is ADOPTED on read, never re-minted (the driver precedent, QO81: an id already
 *  on file is provenance).
 */
import type { KeyValueStorage } from '../storage/keyValueStorage.js';

/** One stored slot: the uuid this repo minted or adopted, plus the thing's own record,
 *  unopened until the library's own domain seam validates it. */
export interface SavedEntry { uuid: string; record: unknown }

/** The bucket as written. `entries` is the shared field name — both libraries, one shape. */
export interface SavedEnvelope { schema: number; entries: SavedEntry[] }

/** A stored entry the current shape cannot read — preserved untouched, surfaced by name. */
export interface BrokenEntry {
  /** Position in the stored broken set — the handle `removeBroken` takes. */
  key: number;
  /** Best-effort display name recovered from the blob, for the surface to say WHICH entry. */
  label: string;
  /** The entry's own bytes, verbatim JSON — what Export offers before any destructive choice. */
  raw: string;
}

/** How a library read ended. */
export type SavedRead<T> =
  /** Bucket readable. `broken` entries are preserved in storage and surfaced, never hidden. */
  | { kind: 'ok'; entries: { uuid: string; value: T }[]; broken: BrokenEntry[] }
  /** Storage itself is inaccessible (private mode, browser policy). Not a corruption. */
  | { kind: 'unavailable' }
  /** The bucket's string is not a readable envelope. The bucket is READ-ONLY until the user
   *  decides; `raw` is the one copy of their data, offered verbatim by Export. */
  | { kind: 'unreadable'; raw: string };

/** What one library supplies: its storage key, the schema version it writes, and the two
 *  directions between a stored record and the domain object it stands for. */
export interface SavedEntriesSpec<T> {
  key: string;
  schemaVersion: number;
  /** The domain's own seam — `OpenISDDriver.fromConformingRecord` and friends. Answers with
   *  the object, or the reasons the record is not one. */
  open(record: unknown): T | string[];
  /** The record to store for this object — its own deep-cloned JSON. */
  snapshot(value: T): unknown;
}

/** The operations both libraries expose, over whatever `T` each holds. */
export interface SavedEntries<T> {
  /** The bucket, with its failure states made explicit. */
  read(): SavedRead<T>;
  /** Every saved entry, in saved order — `[]` when the bucket is unavailable or unreadable.
   *  Surfaces that must react to failure use `read()`. */
  list(): { uuid: string; value: T }[];
  /** Replace the whole collection. Refused (false) while the bucket is unreadable. Each entry
   *  mints a fresh uuid. */
  replaceAll(next: T[]): boolean;
  /** Save one. `uuid` absent mints a fresh identity (a new entry); `uuid` present overwrites
   *  that entry. Returns the uuid it was saved under; null = refused (read-only). */
  upsert(value: T, uuid?: string): { uuid: string; overwrote: boolean } | null;
  /** Remove the entry with this uuid. Refused (false) while unreadable. */
  remove(uuid: string): boolean;
  /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
  removeBroken(key: number): boolean;
  /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
  exportRaw(): string | null;
  /** Wipe the bucket and start fresh — NEVER automatic; the surface challenges for an
   *  un-exported session before calling this. */
  deleteAll(): void;
}

/** Best-effort name for a blob the shape cannot read — so the surface can say WHICH entry.
 *
 *  Reads a value that failed validation, so nothing about its shape is known and every read is
 *  a guarded probe rather than a field access. `stringAt` returns a string or nothing; there is
 *  no assertion anywhere. */
function labelOf(blob: unknown): string {
  const name = [stringAt(blob, 'brand'), stringAt(blob, 'model')].filter(Boolean).join(' ')
    || stringAt(blob, 'name') || stringAt(blob, 'uuid');
  return name || '(unnamed entry)';
}

/** The string at `key` of `blob`, taken either bare or from a `{value}` wrapper — the two forms
 *  a record's fields take. Empty when `blob` is not an object, the key is absent, or neither
 *  form holds a string. */
function stringAt(blob: unknown, key: string): string {
  if (!blob || typeof blob !== 'object' || !(key in blob)) return '';
  const v: unknown = Reflect.get(blob, key);
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'value' in v && typeof v.value === 'string') return v.value;
  return '';
}

/** Whether `blob` is a stored slot — a GUARD, so the caller reads `uuid` and `record` as the
 *  declared types rather than asserting them. */
function isSavedEntry(blob: unknown): blob is SavedEntry {
  return !!blob && typeof blob === 'object'
    && 'uuid' in blob && typeof blob.uuid === 'string'
    && 'record' in blob;
}

/** The envelope `raw` holds, or null when it is not one. Accepts the two shapes that reach a
 *  bucket: the envelope itself, and a bare array (the pre-envelope shape), which is RECOGNISED
 *  as version 1 rather than repaired. */
function envelopeOf(raw: string): SavedEnvelope | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }

  if (Array.isArray(parsed)) return { schema: 1, entries: entriesOf(parsed) };
  if (!parsed || typeof parsed !== 'object') return null;
  if (!('entries' in parsed) || !Array.isArray(parsed.entries)) return null;

  const schema = 'schema' in parsed && typeof parsed.schema === 'number' ? parsed.schema : 1;
  return { schema, entries: entriesOf(parsed.entries) };
}

/** Every element that is a stored slot, in order. A blob that is not one is dropped HERE and
 *  picked up again by the caller's broken-entry pass, which reads the same array. */
function entriesOf(list: readonly unknown[]): SavedEntry[] {
  return list.filter(isSavedEntry);
}

export function createSavedEntries<T>(storage: KeyValueStorage, spec: SavedEntriesSpec<T>): SavedEntries<T> {
  /** null = storage inaccessible; distinct from an absent key (a fresh browser). */
  function rawString(): { ok: true; raw: string | null } | { ok: false } {
    try { return { ok: true, raw: storage.get(spec.key) }; } catch { return { ok: false }; }
  }

  function write(envelope: SavedEnvelope): boolean {
    try {
      storage.set(spec.key, JSON.stringify(envelope));
      return true;
    } catch { return false; }
  }

  /** The full read, plus the raw slots each value came from (for write-back). */
  function readFull(): { state: SavedRead<T>; slots: SavedEntry[]; brokenRaw: unknown[] } {
    const r = rawString();
    if (!r.ok) return { state: { kind: 'unavailable' }, slots: [], brokenRaw: [] };
    if (r.raw == null) return { state: { kind: 'ok', entries: [], broken: [] }, slots: [], brokenRaw: [] };

    const envelope = envelopeOf(r.raw);
    if (!envelope) return { state: { kind: 'unreadable', raw: r.raw }, slots: [], brokenRaw: [] };

    let all: unknown[];
    try { all = asArray(JSON.parse(r.raw)); } catch { return { state: { kind: 'unreadable', raw: r.raw }, slots: [], brokenRaw: [] }; }

    const entries: { uuid: string; value: T }[] = [];
    const slots: SavedEntry[] = [];
    const brokenRaw: unknown[] = [];
    const broken: BrokenEntry[] = [];
    for (const blob of all) {
      if (!isSavedEntry(blob)) {
        broken.push({ key: brokenRaw.length, label: labelOf(blob), raw: JSON.stringify(blob) });
        brokenRaw.push(blob);
        continue;
      }
      const opened = spec.open(blob.record);
      if (Array.isArray(opened)) {
        broken.push({ key: brokenRaw.length, label: labelOf(blob.record), raw: JSON.stringify(blob) });
        brokenRaw.push(blob);
        continue;
      }
      entries.push({ uuid: blob.uuid, value: opened });
      slots.push(blob);
    }

    // A bucket written in the pre-envelope shape is adopted in place, same identities, so the
    // next read no longer has to recognise it. An ordinary read never rewrites the user's bytes.
    if (envelope.schema !== spec.schemaVersion) writeBack(slots, brokenRaw);

    return { state: { kind: 'ok', entries, broken }, slots, brokenRaw };
  }

  /** The stored list, whichever shape the bucket is in — the envelope's `entries`, or the whole
   *  thing when it is the pre-envelope bare array. */
  function asArray(parsed: unknown): unknown[] {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && 'entries' in parsed && Array.isArray(parsed.entries)) {
      return parsed.entries;
    }
    return [];
  }

  function writeBack(slots: SavedEntry[], brokenRaw: unknown[]): boolean {
    return write({ schema: spec.schemaVersion, entries: [...slots, ...brokenRaw].filter(isSavedEntry) });
  }

  return {
    read: () => readFull().state,

    list() {
      const s = readFull().state;
      return s.kind === 'ok' ? s.entries : [];
    },

    replaceAll(next) {
      const { state } = readFull();
      if (state.kind === 'unreadable') return false; // read-only: the string is the only copy
      return writeBack(next.map(v => ({ uuid: crypto.randomUUID(), record: spec.snapshot(v) })), []);
    },

    upsert(value, uuid) {
      const { state, slots, brokenRaw } = readFull();
      if (state.kind === 'unreadable') return null;
      const id = uuid ?? crypto.randomUUID();
      const idx = slots.findIndex(s => s.uuid === id);
      const nextSlots = [...slots];
      if (idx >= 0) nextSlots[idx] = { uuid: id, record: spec.snapshot(value) };
      else nextSlots.push({ uuid: id, record: spec.snapshot(value) });
      writeBack(nextSlots, brokenRaw);
      return { uuid: id, overwrote: idx >= 0 };
    },

    remove(uuid) {
      if (!uuid) return false; // an unminted identity names nothing — refuse, never guess
      const { state, slots, brokenRaw } = readFull();
      if (state.kind !== 'ok') return false;
      const kept = slots.filter(s => s.uuid !== uuid);
      if (kept.length === slots.length) return false;
      return writeBack(kept, brokenRaw);
    },

    removeBroken(key) {
      const { state, slots, brokenRaw } = readFull();
      if (state.kind !== 'ok') return false;
      if (key < 0 || key >= brokenRaw.length) return false;
      return writeBack(slots, brokenRaw.filter((_, i) => i !== key));
    },

    exportRaw() {
      const r = rawString();
      return r.ok ? r.raw : null;
    },

    deleteAll() {
      try { storage.set(spec.key, JSON.stringify({ schema: spec.schemaVersion, entries: [] })); }
      catch { /* unavailable storage: nothing to wipe */ }
    },
  };
}
