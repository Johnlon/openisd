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
// THE OWNER OF THE STATE SERIALIZES AND PERSISTS IT (docs/design/SERIALIZATION_DOCTRINE.md):
// this repository speaks `OpenISDDriver` at its contract and record TEXT only internally,
// between the read seam (`OpenISDDriver.fromConformingRecord`, the model's own untrusted-input
// constructor) and the write seam (`driver.toJsonRecord()`, only ever re-serialised straight
// back out via `JSON.stringify` — never held or inspected as a record by this file).
//
// IDENTITY is `<brand>/<model-slug>` — the same scheme the driver database uses on disk
// (`dayton-audio/pro-8`), so a saved driver and a database driver are named the same way.
// Brand, not manufacturer: WinISD's Save-Driver defaults to `<brand> <model>.wdr`, and
// brand is what the user recognises. `manufacturer` is second-order, descriptive only.
//
// A rename IS a new identity. Editing a driver's brand or model and saving therefore writes
// a DIFFERENT driver, which is what makes Clone ("Copy of …") the deliberate way to fork one.
// Nothing here is written by editing a project: a project embeds its own copy of a driver,
// so only an explicit save reaches this collection.

export const MY_DRIVERS_KEY = 'openisd_my_drivers';

// A stored entry failing `OpenISDDriver.fromConformingRecord` is refused on every read —
// `list()` never hands it to the model — and left untouched in storage by `upsert`/`remove`
// rather than erased (QO81, pending ratification).

/**
 * A driver's identity: `<brand>/<model>`, lowercased and slugged. Empty when the driver
 * carries neither a brand nor a model — an unidentifiable driver, which callers must not
 * treat as equal to any other.
 */
export function driverId(d: OpenISDDriver): string {
  const slug = (s: string | undefined) =>
    (s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const brand = slug(d.metaCell('brand').value);
  const model = slug(d.metaCell('model').value);
  if (!brand && !model) return '';
  return `${brand}/${model}`;
}

export interface MyDriverRepo {
  /** The identity this repository files a driver under — `<brand>/<model>`. */
  identityOf(d: OpenISDDriver): string;
  /** Every saved driver, in the order they were saved. */
  list(): OpenISDDriver[];
  /** Replace the whole collection — used by "reset to the demo samples". */
  replaceAll(list: OpenISDDriver[]): void;
  /**
   * Save one driver. It overwrites the entry already holding the resulting `<brand>/<model>`
   * identity, and adds one when none does — a driver IS its identity, so saving under a name
   * that is already taken means saving THAT driver, not a twin of it.
   *
   * Returns true when an existing entry was overwritten, false when one was added.
   */
  upsert(d: OpenISDDriver): boolean;
  /** Remove the saved driver with this identity. Returns true when one was removed. */
  remove(id: string): boolean;
}

/**
 * The stored array, split into records `OpenISDDriver.fromConformingRecord` can construct a
 * domain object from and everything else — the retired flat shape, or any other blob failing
 * conformance (`bundleProjection.mjs::project()` runs the SAME conformance check on the driver
 * corpus, so this seam and the bundler's enforce one contract). A refused entry is logged once
 * here (the ONE call site every read/write path goes through) and carried through
 * `unrecognised` rather than being dropped: this key holds the user's own data, and erasing an
 * entry nobody asked to delete is a worse failure than displaying too few rows (QO81, pending
 * ratification — a future release may instead migrate or surface these entries to the user).
 */
function readAndSplit(
  storage: KeyValueStorage, fromConformingRecord: (candidate: unknown) => OpenISDDriver | null,
): { conforming: OpenISDDriver[]; unrecognised: unknown[] } {
  let raw: unknown[];
  try {
    const parsed: unknown = JSON.parse(storage.get(MY_DRIVERS_KEY) ?? '[]');
    raw = Array.isArray(parsed) ? parsed : [];
  } catch { raw = []; }

  const conforming: OpenISDDriver[] = [];
  const unrecognised: unknown[] = [];
  for (const candidate of raw) {
    const driver = fromConformingRecord(candidate);
    if (driver) { conforming.push(driver); continue; }
    console.warn('my-drivers: ignoring non-conforming stored record', candidate);
    unrecognised.push(candidate);
  }
  return { conforming, unrecognised };
}

/**
 * `fromConformingRecord` is an INJECTED collaborator, not an import of `OpenISDDriver` itself:
 * the containment gate (`packages/ui/test/ui/architecture.test.ts`, "ManagedOpenISDProject is
 * the only holder of OpenISDDriver") licenses only `managedProject.ts`, `managedDriver.ts` and
 * `DriverEditorModal.vue` to name the class as a value. This repository's read seam still
 * constructs its own domain objects — the composition root (`main.ts`) just hands it the
 * licensed constructor (`managedDriver.ts::driverFromConformingRecord`) rather than this file
 * importing the class to do it itself.
 */
export function createMyDriverRepo(
  storage: KeyValueStorage, fromConformingRecord: (candidate: unknown) => OpenISDDriver | null,
): MyDriverRepo {
  function list(): OpenISDDriver[] {
    return readAndSplit(storage, fromConformingRecord).conforming;
  }

  function replaceAll(next: OpenISDDriver[]): void {
    storage.set(MY_DRIVERS_KEY, JSON.stringify(next.map(d => d.toJsonRecord())));
  }

  /** Write `conforming` back beside whatever `unrecognised` blobs the storage already held —
   *  each group keeps its own relative order, conforming first. */
  function writeBack(conforming: OpenISDDriver[], unrecognised: unknown[]): void {
    storage.set(MY_DRIVERS_KEY, JSON.stringify([...conforming.map(d => d.toJsonRecord()), ...unrecognised]));
  }

  return {
    identityOf: driverId,
    list,
    replaceAll,
    upsert(d) {
      const id = driverId(d);
      const { conforming, unrecognised } = readAndSplit(storage, fromConformingRecord);
      const idx = id ? conforming.findIndex(x => driverId(x) === id) : -1;
      if (idx >= 0) conforming[idx] = d; else conforming.push(d);
      writeBack(conforming, unrecognised);
      return idx >= 0;
    },
    remove(id) {
      if (!id) return false;   // unidentifiable driver: refuse rather than delete an arbitrary row
      const { conforming, unrecognised } = readAndSplit(storage, fromConformingRecord);
      const kept = conforming.filter(d => driverId(d) !== id);
      if (kept.length === conforming.length) return false;
      writeBack(kept, unrecognised);
      return true;
    },
  };
}
