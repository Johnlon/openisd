/** REPO: domain access to the bundled driver collection. Takes a
 *  storage/bundle, returns domain objects. */
import { OpenISDDriver } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';

// The driver commons — index, search, filter, lookup.
//
// A REPO: it answers questions about drivers and hands back records. It takes its
// bundle source as an argument, it does not know a dialog is open, it does not decide what
// happens next, and it never touches app state. "The user chose a driver" is a decision about
// what the app does next and lives in `logic/`, which calls this to fetch the record.

/**
 * One driver record in the pre-built bundle, as `scripts/bundle-drivers.mjs` emits it.
 *
 * `record` is typed `OpenISDDriverJson` — the honest name for what the bundler actually
 * wrote. `scripts/bundle-drivers.mjs` copies each driver's canonical record into the artifact
 * verbatim, so this field IS one; calling it anything wider or opaquer would hide that fact
 * from the reader without changing a single byte that crosses.
 *
 * The value is still only ever OPENED once, at `bundledEntry()`, via
 * `OpenISDDriver.fromJsonRecord()` — bundled drivers ship inside this build's own dist and
 * are always current, so no conformance check runs against them the way browser storage's
 * untrusted per-entry blobs need (`docs/design/MY_DRIVERS_STORAGE_FAILURES.md`: "bundled
 * drivers are always current, they ship with the dist").
 */
export interface BundleRecord {
  /** Path within its source, forward-slashed — half of the driver's identity. */
  path: string;
  /** Display name, taken from the record's own brand + model. */
  name: string;
  /** Canonical driver_type as the record states it — authoritative for the chips. */
  driverType?: string;
  /** The device record, unopened. Its shape is private to `@openisd/design`; this row only
   *  carries it as far as the seam that validates it. */
  record: unknown;
}

/** The whole artifact `scripts/bundle-drivers.mjs` writes to `packages/ui/src/drivers-bundle.json`. */
export interface DriverBundle {
  readonly sources: ReadonlyArray<{ readonly key: string; readonly files: readonly BundleRecord[] }>;
  readonly passiveRadiators: readonly BundleRecord[];
}

/**
 * The ONE description of the bundle's shape, and the only way a value becomes a `DriverBundle`.
 *
 * The bundle is a BUILD ARTIFACT: it does not exist when this code is compiled, so no compile-time
 * type can know what is in it and asserting one would be a guess. This looks at the value instead,
 * and it is a COMPLETE proof rather than a partial one — `BundleRecord.record` is `unknown`, so
 * every member of the type is checked here and nothing is left claimed-but-untested.
 *
 * Called from BOTH ends, which is why it lives here rather than in either of them: the bundler
 * runs it over what it assembled and refuses to write a bundle that fails (`bundle-drivers.mjs`
 * runs under vite-node, so it imports this same function), and the app runs it over what it
 * loaded. The build gate is what stops a bad bundle shipping; the startup check is what stops one
 * that shipped anyway from being read as if it were data.
 *
 * Answers EITHER the bundle or everything wrong with it — the same shape as the domain's own
 * record seam — so a caller that reads `.bundle` has been narrowed to a checked value by the
 * compiler, with no assertion anywhere on the path.
 */
export function readBundle(json: unknown): { bundle: DriverBundle } | { problems: string[] } {
  const problems: string[] = [];

  function record(v: unknown, where: string): BundleRecord | null {
    if (typeof v !== 'object' || v === null) {
      problems.push(`${where}: expected an object, got ${v === null ? 'null' : typeof v}`);
      return null;
    }
    const row: { path?: unknown; name?: unknown; driverType?: unknown; record?: unknown } = v;
    if (typeof row.path !== 'string') { problems.push(`${where}.path: expected a string`); return null; }
    if (typeof row.name !== 'string') { problems.push(`${where}.name: expected a string`); return null; }
    if (row.driverType !== undefined && typeof row.driverType !== 'string') {
      problems.push(`${where}.driverType: expected a string when present`);
      return null;
    }
    // `.record` is `unknown` — carried, never opened here. The seam that opens it
    // (`driverFromConformingRecord`) is what says whether it is a usable device.
    return row.driverType === undefined
      ? { path: row.path, name: row.name, record: row.record }
      : { path: row.path, name: row.name, driverType: row.driverType, record: row.record };
  }

  function rows(v: unknown, where: string): BundleRecord[] {
    if (!Array.isArray(v)) { problems.push(`${where}: expected an array`); return []; }
    const out: BundleRecord[] = [];
    v.forEach((r, i) => { const row = record(r, `${where}[${i}]`); if (row !== null) out.push(row); });
    return out;
  }

  if (typeof json !== 'object' || json === null) {
    return { problems: [`the bundle: expected an object, got ${json === null ? 'null' : typeof json}`] };
  }
  const top: { sources?: unknown; passiveRadiators?: unknown } = json;

  const sources: Array<{ key: string; files: BundleRecord[] }> = [];
  if (top.sources !== undefined) {
    if (!Array.isArray(top.sources)) problems.push('sources: expected an array when present');
    else top.sources.forEach((s, i) => {
      if (typeof s !== 'object' || s === null) { problems.push(`sources[${i}]: expected an object`); return; }
      const src: { key?: unknown; files?: unknown } = s;
      if (typeof src.key !== 'string') { problems.push(`sources[${i}].key: expected a string`); return; }
      sources.push({ key: src.key, files: rows(src.files, `sources[${i}].files`) });
    });
  }

  const passiveRadiators = top.passiveRadiators === undefined
    ? []
    : rows(top.passiveRadiators, 'passiveRadiators');

  return problems.length > 0 ? { problems } : { bundle: { sources, passiveRadiators } };
}

export interface DriverRepo {
  /** Every driver in the pre-built bundle, as domain objects. No network, no file parsing. */
  bundledDrivers(): OpenISDDriver[];
}

export interface DriverRepoDeps {
  /** The declared sources, keyed by their short stable id (`drivers/sources.json` v2). Only the
   *  keys are read — a source's name/url is no longer shown anywhere. */
  sources: Record<string, unknown>;
  /** The pre-built driver bundle, already checked by `readBundle` — the only way to obtain one. */
  bundle: DriverBundle;
  /** Handed to the domain seam that validates each bundled record — injected, never constructed
   *  here (ARCHITECTURE.md §2, the composition root). */
  engine: Engine;
}

export function createDriverRepo(deps: DriverRepoDeps): DriverRepo {
  const sourceKeys = Object.keys(deps.sources);

  // The sources this repo ships inside its own build output, by key. Each file is an
  // `openisd.yml` record (ARCHITECTURE.md AD-8) — the app's own driver shape, already parsed
  // by the bundler, so nothing here parses a file format.
  const bundledByKey: Record<string, readonly BundleRecord[]> = Object.fromEntries(
    deps.bundle.sources.map(s => [s.key, s.files]),
  );

  /**
   * A bundled openisd record as a domain object. THE composition-root seam
   * (SERIALIZATION_DOCTRINE.md edge 2): the bundle's raw JSON is passed through the domain
   * seam ONCE, right here — every downstream reader (the filter bar, the preview pane, the DQ
   * badge) sees an `OpenISDDriver`, never record data.
   *
   * THE REPO NEVER READS A DRIVER FIELD (John, 2026-09-05 ruling). It constructs the driver and
   * hands it out; any summary column a caller needs (`Fs`, `Sd`, a display name…) is that
   * caller's job, reading the SAME domain object this function returns.
   *
   * The record is validated here — the bundler wrote it, but nothing downstream trusts that
   * blindly; a malformed record is refused with the reasons named.
   */
  function bundledDriver(f: BundleRecord): OpenISDDriver {
    const driver = OpenISDDriver.fromConformingRecord(f.record, deps.engine);
    if (Array.isArray(driver)) {
      throw new Error(`${f.path}: not a valid driver — ${driver.join(', ')}`);
    }
    return driver;
  }

  return {
    bundledDrivers() {
      const out: OpenISDDriver[] = [];
      for (const key of sourceKeys) {
        const files = bundledByKey[key];
        if (!files) continue;
        for (const f of files) out.push(bundledDriver(f));
      }
      return out;
    },
  };
}
