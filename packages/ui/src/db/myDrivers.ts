import { driverRecordProblems } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import { recordConforms } from '@openisd/model/driverConformance';
import type { KeyValueStore } from './kv.js';

// "My Drivers" — the user's own saved drivers, a bucket of its own in browser storage.
// THE one place that knows the storage key and its shape, and THE one write path: every
// route that creates a user driver (Add new, Clone, Load File, Save-and-reload) ends in
// `upsert`, so there is exactly one rule for what saving means.
//
// A REPOSITORY: it is handed a store, takes arguments and returns records. It does not know
// a dialog is open and it never decides what happens next — that is the logic layer's job.
//
// IDENTITY is `<brand>/<model-slug>` — the same scheme the driver database uses on disk
// (`dayton-audio/pro-8`), so a saved driver and a database driver are named the same way.
// Brand, not manufacturer: WinISD's Save-Driver defaults to `<brand> <model>.wdr`, and
// brand is what the user recognises. `manufacturer` is second-order, descriptive only.
//
// A rename IS a new identity. Editing a driver's brand or model and saving therefore writes
// a DIFFERENT driver, which is what makes Clone ("Copy of …") the deliberate way to fork one.
// Nothing here is written by editing a project: a project embeds its own copy of a driver,
// so only an explicit save reaches this bucket.

export const MY_DRIVERS_KEY = 'openisd_my_drivers';

// Saved drivers are RECORDS (`_OpenISDDriverJson`) — the same shape a library driver, a file
// and a share link carry. There is one driver model, so there is one saved shape.
//
// A stored entry failing `isConformingRecord` is refused on every read — `list()` never hands
// it to the model — and left untouched in storage by `upsert`/`remove` rather than erased
// (QO81, pending ratification).

/**
 * A driver's identity: `<brand>/<model>`, lowercased and slugged. Empty when the driver
 * carries neither a brand nor a model — an unidentifiable driver, which callers must not
 * treat as equal to any other.
 */
export function driverId(d: _OpenISDDriverJson): string {
  const slug = (s: string | undefined) =>
    (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const brand = slug(d.brand?.value);
  const model = slug(d.model?.value);
  if (!brand && !model) return '';
  return `${brand}/${model}`;
}

export interface MyDriverRepo {
  /** The identity this repository files a driver under — `<brand>/<model>`. */
  identityOf(d: _OpenISDDriverJson): string;
  /** Every saved driver, in the order they were saved. */
  list(): _OpenISDDriverJson[];
  /** Replace the whole bucket — used by "reset to the demo samples". */
  replaceAll(list: _OpenISDDriverJson[]): void;
  /**
   * Save one driver. It overwrites the entry already holding the resulting `<brand>/<model>`
   * identity, and adds one when none does — a driver IS its identity, so saving under a name
   * that is already taken means saving THAT driver, not a twin of it.
   *
   * Returns true when an existing entry was overwritten, false when one was added.
   */
  upsert(d: _OpenISDDriverJson): boolean;
  /** Remove the saved driver with this identity. Returns true when one was removed. */
  remove(id: string): boolean;
}

/**
 * The stored array, split into records `list()` can hand to the model and everything else —
 * the retired flat shape, or any other blob failing `recordConforms`
 * (`packages/model/src/driverConformance.ts` — the SAME conformance check
 * `bundleProjection.mjs::project()` runs on the driver corpus, so this seam and the bundler's
 * enforce one contract). A refused entry is logged once here (the ONE call site every
 * read/write path goes through) and carried through `unrecognised` rather than being dropped:
 * this key holds the user's own data, and erasing an entry nobody asked to delete is a worse
 * failure than displaying too few rows (QO81, pending ratification — a future release may
 * instead migrate or surface these entries to the user).
 */
function readAndSplit(store: KeyValueStore): { conforming: _OpenISDDriverJson[]; unrecognised: unknown[] } {
  let raw: unknown[];
  try {
    const parsed: unknown = JSON.parse(store.get(MY_DRIVERS_KEY) ?? '[]');
    raw = Array.isArray(parsed) ? parsed : [];
  } catch { raw = []; }

  const conforming: _OpenISDDriverJson[] = [];
  const unrecognised: unknown[] = [];
  for (const candidate of raw) {
    if (recordConforms(candidate)) { conforming.push(candidate as _OpenISDDriverJson); continue; }
    console.warn('my-drivers: ignoring non-conforming stored record', driverRecordProblems(candidate), candidate);
    unrecognised.push(candidate);
  }
  return { conforming, unrecognised };
}

export function createMyDriverRepo(store: KeyValueStore): MyDriverRepo {
  function list(): _OpenISDDriverJson[] {
    return readAndSplit(store).conforming;
  }

  function replaceAll(next: _OpenISDDriverJson[]): void {
    store.set(MY_DRIVERS_KEY, JSON.stringify(next));
  }

  /** Write `conforming` back beside whatever `unrecognised` blobs the store already held —
   *  each group keeps its own relative order, conforming first. */
  function writeBack(conforming: _OpenISDDriverJson[], unrecognised: unknown[]): void {
    store.set(MY_DRIVERS_KEY, JSON.stringify([...conforming, ...unrecognised]));
  }

  return {
    identityOf: driverId,
    list,
    replaceAll,
    upsert(d) {
      const entry = { ...d };
      const id = driverId(entry);
      const { conforming, unrecognised } = readAndSplit(store);
      const idx = id ? conforming.findIndex(x => driverId(x) === id) : -1;
      if (idx >= 0) conforming[idx] = entry; else conforming.push(entry);
      writeBack(conforming, unrecognised);
      return idx >= 0;
    },
    remove(id) {
      if (!id) return false;   // unidentifiable driver: refuse rather than delete an arbitrary row
      const { conforming, unrecognised } = readAndSplit(store);
      const kept = conforming.filter(d => driverId(d) !== id);
      if (kept.length === conforming.length) return false;
      writeBack(kept, unrecognised);
      return true;
    },
  };
}
