/** REPO: domain access to the My Drivers collection. Takes a storage, returns domain objects. */
import type { OpenISDDriver } from '@openisd/model';
import type { KeyValueStorage } from '../storage/keyValueStorage.js';

// "My Drivers" — the user's own saved-driver collection, in browser storage.
// THE one place that knows the storage key and its shape, and THE one write path: every
// route that creates a user driver (Add new, Clone, Load File, Save-and-reload) ends in
// `upsert`, so there is exactly one rule for what saving means.
//
// A REPO: it is handed a storage, takes arguments and returns DOMAIN OBJECTS. It does not
// know a dialog is open and it never decides what happens next — that is the logic layer's job.
//
// THE GOVERNING PRINCIPLE (docs/design/MY_DRIVERS_STORAGE_FAILURES.md, QO81 rulings): a saved
// driver in the browser has no other copy anywhere. This repository therefore NEVER destroys
// or silently hides those bytes on its own — data leaves the bucket only by an explicit
// deleting call, and a corrupt bucket makes every ordinary write a refusal (read-only) so the
// one copy cannot be overwritten.
//
// IDENTITY is the record's uuid, minted at save when absent (`ensureUuid()`). Brand/model is
// DISPLAY naming only: two drivers with the same name coexist. A FILE IMPORT always mints a
// fresh uuid before it reaches `upsert` (the caller's duty, `mintFreshUuid()`), so importing
// the same file twice yields two entries and can never silently overwrite a saved driver.
//
// FORMAT VERSION + UPGRADE CHAIN: the bucket is a versioned envelope. A bare array (the
// pre-version shape) reads as version 1; every breaking shape change ships an upgrade
// function, applied IN ORDER on load, and the upgraded bucket is saved over the old one in
// place — same identities. Scope is My Drivers alone: bundled drivers ship current.

export const MY_DRIVERS_KEY = 'openisd_my_drivers';

/** The shape this build writes. */
export const MY_DRIVERS_VERSION = 2;

interface Envelope { version: number; drivers: unknown[] }

/** stored version N → N+1. Applied in order until `MY_DRIVERS_VERSION`. */
const UPGRADES: Readonly<Record<number, (e: Envelope) => Envelope>> = {
  // v1 (the bare, unversioned array) → v2: uuid-keyed identity. Every record lacking a uuid
  // gets one minted here — the upgrade IS a save, and the identity ruling mints at save.
  1: e => ({ version: 2, drivers: e.drivers.map(stampUuid) }),
};

function stampUuid(record: unknown): unknown {
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    const r = record as { uuid?: { value?: unknown } };
    const has = typeof r.uuid?.value === 'string' && r.uuid.value !== '';
    if (!has) return { ...r, uuid: { value: crypto.randomUUID(), definition: 'stable record identity' } };
  }
  return record;
}

/** A stored entry the current shape cannot read — preserved untouched, surfaced by name. */
export interface BrokenEntry {
  /** Position in the stored broken set — the handle `removeBroken` takes. */
  key: number;
  /** Best-effort display name recovered from the blob, for the surface to say WHICH entry. */
  label: string;
  /** The entry's own bytes, verbatim JSON — what Export offers before any destructive choice. */
  raw: string;
}

export type MyDriversRead =
  /** Bucket readable. `broken` entries are preserved in storage and surfaced, never hidden. */
  | { kind: 'ok'; drivers: OpenISDDriver[]; broken: BrokenEntry[] }
  /** Storage itself is inaccessible (private mode, browser policy). Not a corruption. */
  | { kind: 'unavailable' }
  /** The bucket's string is not a readable envelope. The bucket is READ-ONLY until the user
   *  decides; `raw` is the one copy of their data, offered verbatim by Export. */
  | { kind: 'unreadable'; raw: string };

export interface MyDriverRepo {
  /** The identity this repository files a driver under — its uuid; '' before one is minted. */
  identityOf(d: OpenISDDriver): string;
  /** The bucket, with its failure states made explicit. */
  read(): MyDriversRead;
  /** Every saved driver, in saved order — `[]` when the bucket is unavailable or unreadable.
   *  Surfaces that must react to failure use `read()`. */
  list(): OpenISDDriver[];
  /** Replace the whole collection — used by "reset to the demo samples". Refused (false)
   *  while the bucket is unreadable. */
  replaceAll(list: OpenISDDriver[]): boolean;
  /** Save one driver under its uuid, minting one when absent. Overwrites the entry with the
   *  same uuid, adds one otherwise. Returns whether it overwrote; null = refused (read-only). */
  upsert(d: OpenISDDriver): { overwrote: boolean } | null;
  /** Remove the saved driver with this uuid. Refused (false) while unreadable. */
  remove(uuid: string): boolean;
  /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
  removeBroken(key: number): boolean;
  /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
  exportRaw(): string | null;
  /** Wipe the bucket and start fresh — the unreadable-bucket Delete, NEVER automatic; the
   *  surface challenges for an un-exported session before calling this. */
  deleteAll(): void;
}

/** Best-effort name for a blob the shape cannot read — so the surface can say WHICH entry. */
function labelOf(blob: unknown): string {
  if (blob && typeof blob === 'object') {
    const b = blob as Record<string, { value?: unknown } | unknown>;
    const get = (k: string) => {
      const v = b[k];
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as { value?: unknown }).value === 'string') {
        return (v as { value: string }).value;
      }
      return '';
    };
    const name = [get('brand'), get('model')].filter(Boolean).join(' ') || get('name') || get('uuid');
    if (name) return name;
  }
  return '(unnamed entry)';
}

export function createMyDriverRepo(
  storage: KeyValueStorage, fromConformingRecord: (candidate: unknown) => OpenISDDriver | null,
): MyDriverRepo {
  /** null = storage inaccessible; distinct from an absent key (a fresh browser). */
  function rawString(): { ok: true; raw: string | null } | { ok: false } {
    try { return { ok: true, raw: storage.get(MY_DRIVERS_KEY) }; } catch { return { ok: false }; }
  }

  /** Parse + upgrade. Returns the envelope at MY_DRIVERS_VERSION, or null when unreadable. */
  function envelopeOf(raw: string): Envelope | null {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }
    let envelope: Envelope;
    if (Array.isArray(parsed)) envelope = { version: 1, drivers: parsed };
    else if (parsed && typeof parsed === 'object'
      && typeof (parsed as Envelope).version === 'number'
      && Array.isArray((parsed as Envelope).drivers)) envelope = parsed as Envelope;
    else return null;
    if (envelope.version > MY_DRIVERS_VERSION) return null; // written by a newer app — this one cannot claim to read it
    while (envelope.version < MY_DRIVERS_VERSION) {
      const step = UPGRADES[envelope.version];
      if (!step) return null; // older than the oldest upgrade
      envelope = step(envelope);
    }
    return envelope;
  }

  function write(envelope: Envelope): boolean {
    try {
      storage.set(MY_DRIVERS_KEY, JSON.stringify(envelope));
      return true;
    } catch { return false; }
  }

  /** The full read, plus the raw record blobs each driver came from (for write-back). */
  function readFull(): { state: MyDriversRead; drivers: unknown[]; brokenRaw: unknown[] } {
    const r = rawString();
    if (!r.ok) return { state: { kind: 'unavailable' }, drivers: [], brokenRaw: [] };
    if (r.raw == null) return { state: { kind: 'ok', drivers: [], broken: [] }, drivers: [], brokenRaw: [] };

    const envelope = envelopeOf(r.raw);
    if (!envelope) return { state: { kind: 'unreadable', raw: r.raw }, drivers: [], brokenRaw: [] };

    const drivers: OpenISDDriver[] = [];
    const driverBlobs: unknown[] = [];
    const brokenRaw: unknown[] = [];
    const broken: BrokenEntry[] = [];
    for (const blob of envelope.drivers) {
      const driver = fromConformingRecord(blob);
      if (driver) { drivers.push(driver); driverBlobs.push(blob); continue; }
      broken.push({ key: brokenRaw.length, label: labelOf(blob), raw: JSON.stringify(blob) });
      brokenRaw.push(blob);
    }

    // The chain ran (or entries were re-labelled): persist the upgraded envelope over the old
    // one, in place, same identities — but ONLY when the shape actually moved, so an ordinary
    // read never rewrites the user's bytes.
    if (r.raw !== null && JSON.parse(r.raw) && (Array.isArray(JSON.parse(r.raw))
      || (JSON.parse(r.raw) as Envelope).version !== envelope.version)) {
      write(envelope);
    }

    return { state: { kind: 'ok', drivers, broken }, drivers: driverBlobs, brokenRaw };
  }

  function writeBack(driverBlobs: unknown[], brokenRaw: unknown[]): boolean {
    return write({ version: MY_DRIVERS_VERSION, drivers: [...driverBlobs, ...brokenRaw] });
  }

  return {
    identityOf: d => d.uuid(),
    read: () => readFull().state,
    list() {
      const s = readFull().state;
      return s.kind === 'ok' ? s.drivers : [];
    },
    replaceAll(next) {
      const { state } = readFull();
      if (state.kind === 'unreadable') return false; // read-only: the string is the only copy
      return writeBack(next.map(d => { d.ensureUuid(); return d.toJsonRecord(); }), []);
    },
    upsert(d) {
      const { state, brokenRaw } = readFull();
      if (state.kind === 'unreadable') return null;
      const uuid = d.ensureUuid();
      const drivers = state.kind === 'ok' ? state.drivers : [];
      const idx = drivers.findIndex(x => x.uuid() === uuid);
      const blobs = drivers.map(x => x.toJsonRecord() as unknown);
      if (idx >= 0) blobs[idx] = d.toJsonRecord();
      else blobs.push(d.toJsonRecord());
      writeBack(blobs, brokenRaw);
      return { overwrote: idx >= 0 };
    },
    remove(uuid) {
      if (!uuid) return false; // an unminted identity names nothing — refuse, never guess
      const { state, brokenRaw } = readFull();
      if (state.kind !== 'ok') return false;
      const kept = state.drivers.filter(d => d.uuid() !== uuid);
      if (kept.length === state.drivers.length) return false;
      return writeBack(kept.map(d => d.toJsonRecord() as unknown), brokenRaw);
    },
    removeBroken(key) {
      const { state, drivers, brokenRaw } = readFull();
      if (state.kind !== 'ok') return false;
      if (key < 0 || key >= brokenRaw.length) return false;
      return writeBack(drivers, brokenRaw.filter((_, i) => i !== key));
    },
    exportRaw() {
      const r = rawString();
      return r.ok ? r.raw : null;
    },
    deleteAll() {
      try { storage.set(MY_DRIVERS_KEY, JSON.stringify({ version: MY_DRIVERS_VERSION, drivers: [] })); }
      catch { /* unavailable storage: nothing to wipe */ }
    },
  };
}
