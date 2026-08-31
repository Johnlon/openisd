// COMMENTED OUT — John Lonergan, 2026-08-31: "comment out all persistence methods too except for
// building driver from the bundle of drivers and pr's - no repos needed at the moment".
//
// What survives in this package is ONLY the bundle -> domain construction:
// `driverRepo.ts`'s bundled-entry seam and `bundledPassiveRadiatorRepo.ts`. Storage, My Drivers,
// projects, prefs and view state are all inert. Restore a piece when the app needs it again;
// until then it is not carried through the packages/model -> packages/design migration
// (docs/plans/PLAN_DELETE_PACKAGES_MODEL.md).

// /** REPO: domain access to the My Drivers collection. Takes a storage, returns domain objects. */
// import { OpenISDDriver } from '@openisd/model';
// import type { KeyValueStorage } from '../storage/keyValueStorage.js';
// /** One element of the stored drivers array, as parsed JSON actually is — an object in every
//  *  healthy entry, but corruption can leave any JSON value there and the repo preserves it. */
// export type StoredEntry = Record<string, unknown> | string | number | boolean | null;
//
// /**
//  * The storage's schema collaborator — INJECTED at the composition root (a repo takes its
//  * collaborators as arguments; it never reaches up into the logic layer). The implementation
//  * is `logic/schemaUpgrade.ts`'s chain for this payload family.
//  */
// export interface MyDriversSchema {
//   /** The schema this build writes. */
//   current: number;
//   /** Repair a parsed envelope to `current`. Null when there is no route — a newer build's
//    *  payload, or one older than the oldest step — which this repo surfaces as `unreadable`:
//    *  the seam's "stop and ask the human", in Export/Delete form. */
//   repair(blob: Record<string, unknown>): { envelope: { schema: number; drivers: StoredEntry[] }; upgraded: boolean } | null;
// }
//
// // "My Drivers" — the user's own saved-driver collection, in browser storage.
// // THE one place that knows the storage key and its shape, and THE one write path: every
// // route that creates a user driver (Add new, Clone, Load File, Save-and-reload) ends in
// // `upsert`, so there is exactly one rule for what saving means.
// //
// // A REPO: it is handed a storage, takes arguments and returns DOMAIN OBJECTS. It does not
// // know a dialog is open and it never decides what happens next — that is the logic layer's job.
// //
// // THE GOVERNING PRINCIPLE (docs/design/MY_DRIVERS_STORAGE_FAILURES.md, QO81 rulings): a saved
// // driver in the browser has no other copy anywhere. This repository therefore NEVER destroys
// // or silently hides those bytes on its own — data leaves the bucket only by an explicit
// // deleting call, and a corrupt bucket makes every ordinary write a refusal (read-only) so the
// // one copy cannot be overwritten.
// //
// // IDENTITY is the record's uuid, minted at save when absent (`ensureUuid()`). Brand/model is
// // DISPLAY naming only: two drivers with the same name coexist. A FILE IMPORT always mints a
// // fresh uuid before it reaches `upsert` (the caller's duty, `mintFreshUuid()`), so importing
// // the same file twice yields two entries and can never silently overwrite a saved driver.
// //
// // FORMAT VERSION + UPGRADE CHAIN: the bucket is a `{ schema, drivers }` envelope on the
// // app's ONE upgrade seam (`logic/schemaUpgrade.ts` — its steps registered there beside the
// // app-state chain, per the 2026-08-17 policy: every payload that outlives the session states
// // its version, and reading is a repair). A bare array (the pre-policy shape) reads as
// // schema 1; the chain applies in order and the upgraded bucket saves over the old one in
// // place, same identities. The seam's "stop and ask the human" is, for this bucket, the
// // Export/Delete decision surface: a payload the chain cannot bring current (newer build, or
// // no route) reads as `unreadable`, which is what routes the user there.
//
// export const MY_DRIVERS_KEY = 'openisd_my_drivers';
//
// interface Envelope { schema: number; drivers: unknown[] }
//
// /** A stored entry the current shape cannot read — preserved untouched, surfaced by name. */
// export interface BrokenEntry {
//   /** Position in the stored broken set — the handle `removeBroken` takes. */
//   key: number;
//   /** Best-effort display name recovered from the blob, for the surface to say WHICH entry. */
//   label: string;
//   /** The entry's own bytes, verbatim JSON — what Export offers before any destructive choice. */
//   raw: string;
// }
//
// export type MyDriversRead =
//   /** Bucket readable. `broken` entries are preserved in storage and surfaced, never hidden. */
//   | { kind: 'ok'; drivers: OpenISDDriver[]; broken: BrokenEntry[] }
//   /** Storage itself is inaccessible (private mode, browser policy). Not a corruption. */
//   | { kind: 'unavailable' }
//   /** The bucket's string is not a readable envelope. The bucket is READ-ONLY until the user
//    *  decides; `raw` is the one copy of their data, offered verbatim by Export. */
//   | { kind: 'unreadable'; raw: string };
//
// export interface MyDriverRepo {
//   /** The identity this repository files a driver under — its uuid; '' before one is minted. */
//   identityOf(d: OpenISDDriver): string;
//   /** The bucket, with its failure states made explicit. */
//   read(): MyDriversRead;
//   /** Every saved driver, in saved order — `[]` when the bucket is unavailable or unreadable.
//    *  Surfaces that must react to failure use `read()`. */
//   list(): OpenISDDriver[];
//   /** Replace the whole collection — used by "reset to the demo samples". Refused (false)
//    *  while the bucket is unreadable. */
//   replaceAll(list: OpenISDDriver[]): boolean;
//   /** Save one driver under its uuid, minting one when absent. Overwrites the entry with the
//    *  same uuid, adds one otherwise. Returns whether it overwrote; null = refused (read-only). */
//   upsert(d: OpenISDDriver): { overwrote: boolean } | null;
//   /** Remove the saved driver with this uuid. Refused (false) while unreadable. */
//   remove(uuid: string): boolean;
//   /** Remove ONE broken entry by its `BrokenEntry.key` — the surface challenges first. */
//   removeBroken(key: number): boolean;
//   /** The stored string, verbatim — what the unreadable-bucket Export downloads. */
//   exportRaw(): string | null;
//   /** Wipe the bucket and start fresh — the unreadable-bucket Delete, NEVER automatic; the
//    *  surface challenges for an un-exported session before calling this. */
//   deleteAll(): void;
// }
//
// /** Best-effort name for a blob the shape cannot read — so the surface can say WHICH entry. */
// function labelOf(blob: unknown): string {
//   if (blob && typeof blob === 'object') {
//     const b = blob as Record<string, { value?: unknown } | unknown>;
//     const get = (k: string) => {
//       const v = b[k];
//       if (typeof v === 'string') return v;
//       if (v && typeof v === 'object' && typeof (v as { value?: unknown }).value === 'string') {
//         return (v as { value: string }).value;
//       }
//       return '';
//     };
//     const name = [get('brand'), get('model')].filter(Boolean).join(' ') || get('name') || get('uuid');
//     if (name) return name;
//   }
//   return '(unnamed entry)';
// }
//
// export function createMyDriverRepo(
//   storage: KeyValueStorage,
//   schema: MyDriversSchema,
// ): MyDriverRepo {
//   /** null = storage inaccessible; distinct from an absent key (a fresh browser). */
//   function rawString(): { ok: true; raw: string | null } | { ok: false } {
//     try { return { ok: true, raw: storage.get(MY_DRIVERS_KEY) }; } catch { return { ok: false }; }
//   }
//
//   /** Parse + repair through the injected schema collaborator. Returns the envelope at the
//    *  current schema plus whether the chain moved it, or null when unreadable. */
//   function envelopeOf(raw: string): { envelope: Envelope; upgraded: boolean } | null {
//     let parsed: unknown;
//     try { parsed = JSON.parse(raw); } catch { return null; }
//     let blob: Record<string, unknown>;
//     if (Array.isArray(parsed)) blob = { schema: 1, drivers: parsed }; // the pre-policy shape, recognised, not repaired
//     else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Envelope).drivers)) {
//       blob = parsed as Record<string, unknown>;
//     } else return null;
//     return schema.repair(blob);
//   }
//
//   function write(envelope: Envelope): boolean {
//     try {
//       storage.set(MY_DRIVERS_KEY, JSON.stringify(envelope));
//       return true;
//     } catch { return false; }
//   }
//
//   /** The full read, plus the raw record blobs each driver came from (for write-back). */
//   function readFull(): { state: MyDriversRead; drivers: unknown[]; brokenRaw: unknown[] } {
//     const r = rawString();
//     if (!r.ok) return { state: { kind: 'unavailable' }, drivers: [], brokenRaw: [] };
//     if (r.raw == null) return { state: { kind: 'ok', drivers: [], broken: [] }, drivers: [], brokenRaw: [] };
//
//     const repaired = envelopeOf(r.raw);
//     if (!repaired) return { state: { kind: 'unreadable', raw: r.raw }, drivers: [], brokenRaw: [] };
//     const envelope = repaired.envelope;
//
//     const drivers: OpenISDDriver[] = [];
//     const driverBlobs: unknown[] = [];
//     const brokenRaw: unknown[] = [];
//     const broken: BrokenEntry[] = [];
//     for (const blob of envelope.drivers) {
//       const driver = OpenISDDriver.upgrade(blob);
//       if (driver) { drivers.push(driver); driverBlobs.push(blob); continue; }
//       broken.push({ key: brokenRaw.length, label: labelOf(blob), raw: JSON.stringify(blob) });
//       brokenRaw.push(blob);
//     }
//
//     // The chain ran: persist the upgraded envelope over the old one, in place, same
//     // identities — but ONLY when the shape actually moved (bare-array adoption included), so
//     // an ordinary read never rewrites the user's bytes.
//     if (repaired.upgraded || Array.isArray(JSON.parse(r.raw))) write(envelope);
//
//     return { state: { kind: 'ok', drivers, broken }, drivers: driverBlobs, brokenRaw };
//   }
//
//   function writeBack(driverBlobs: unknown[], brokenRaw: unknown[]): boolean {
//     return write({ schema: schema.current, drivers: [...driverBlobs, ...brokenRaw] });
//   }
//
//   return {
//     identityOf: d => d.uuid(),
//     read: () => readFull().state,
//     list() {
//       const s = readFull().state;
//       return s.kind === 'ok' ? s.drivers : [];
//     },
//     replaceAll(next) {
//       const { state } = readFull();
//       if (state.kind === 'unreadable') return false; // read-only: the string is the only copy
//       return writeBack(next.map(d => { d.ensureUuid(); return d.toJsonRecord(); }), []);
//     },
//     upsert(d) {
//       const { state, brokenRaw } = readFull();
//       if (state.kind === 'unreadable') return null;
//       const uuid = d.ensureUuid();
//       const drivers = state.kind === 'ok' ? state.drivers : [];
//       const idx = drivers.findIndex(x => x.uuid() === uuid);
//       const blobs = drivers.map(x => x.toJsonRecord() as unknown);
//       if (idx >= 0) blobs[idx] = d.toJsonRecord();
//       else blobs.push(d.toJsonRecord());
//       writeBack(blobs, brokenRaw);
//       return { overwrote: idx >= 0 };
//     },
//     remove(uuid) {
//       if (!uuid) return false; // an unminted identity names nothing — refuse, never guess
//       const { state, brokenRaw } = readFull();
//       if (state.kind !== 'ok') return false;
//       const kept = state.drivers.filter(d => d.uuid() !== uuid);
//       if (kept.length === state.drivers.length) return false;
//       return writeBack(kept.map(d => d.toJsonRecord() as unknown), brokenRaw);
//     },
//     removeBroken(key) {
//       const { state, drivers, brokenRaw } = readFull();
//       if (state.kind !== 'ok') return false;
//       if (key < 0 || key >= brokenRaw.length) return false;
//       return writeBack(drivers, brokenRaw.filter((_, i) => i !== key));
//     },
//     exportRaw() {
//       const r = rawString();
//       return r.ok ? r.raw : null;
//     },
//     deleteAll() {
//       try { storage.set(MY_DRIVERS_KEY, JSON.stringify({ schema: schema.current, drivers: [] })); }
//       catch { /* unavailable storage: nothing to wipe */ }
//     },
//   };
// }
//