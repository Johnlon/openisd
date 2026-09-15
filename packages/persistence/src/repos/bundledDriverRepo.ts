/** REPO: the bundled driver catalogue — docs/design/BUNDLED_CATALOGUE_API.md "Drivers".
 *
 *  `createBundledRepo` with the driver's data: `drivers-index.json` under the app base, read by
 *  `readBundledDriverIndex`, and records opened through `OpenISDDriver.fromConformingRecord`. The
 *  list is index rows; a driver becomes a domain object only when `load()` is asked for it. */
import { OpenISDDriver } from '@openisd/design';
import type { Engine } from '@openisd/design/engine';
import type { BundledDriverIndexRow, IndexRead } from './bundledIndex.js';
import { createBundledRepo, baseOf, readIndex, type FieldReader } from './bundledRepo.js';

function driverRowOf(row: Record<string, unknown>, where: string, f: FieldReader): BundledDriverIndexRow | null {
  const base = baseOf(row, where, f);
  const chips = f.strings(row.chips, `${where}.chips`);
  const canonical = f.string(row.canonical, `${where}.canonical`);
  const Fs_hz = f.nullableNumber(row.Fs_hz, `${where}.Fs_hz`);
  const Sd_m2 = f.nullableNumber(row.Sd_m2, `${where}.Sd_m2`);
  const Xmax_m = f.nullableNumber(row.Xmax_m, `${where}.Xmax_m`);
  const Vd_m3 = f.nullableNumber(row.Vd_m3, `${where}.Vd_m3`);
  const Znom_ohm = f.nullableNumber(row.Znom_ohm, `${where}.Znom_ohm`);
  if (base === null || chips === null || canonical === null || Fs_hz === undefined || Sd_m2 === undefined
      || Xmax_m === undefined || Vd_m3 === undefined || Znom_ohm === undefined) return null;
  return { ...base, chips, canonical, Fs_hz, Sd_m2, Xmax_m, Vd_m3, Znom_ohm };
}

/** `drivers-index.json` as loaded: the rows, or every problem naming row and field. */
export function readBundledDriverIndex(json: unknown): IndexRead<BundledDriverIndexRow> {
  return readIndex(json, driverRowOf);
}

export interface BundledDriverRepoDeps {
  readonly fetch: typeof fetch;
  /** `import.meta.env.BASE_URL` — `/`, the GitHub Pages `/openisd/`, or Electron's `./`. */
  readonly baseUrl: string;
  /** Handed to the domain seam that opens each record — injected, never constructed here. */
  readonly engine: Engine;
  /** How long a fetched index or driver is trusted before it is fetched again. */
  readonly maxAge_ms: number;
  readonly now: () => number;
}

export interface BundledDriverRepo {
  /** The index, fetched once and held; fetched again once older than `maxAge_ms`. */
  index(): Promise<readonly BundledDriverIndexRow[]>;
  /** The driver for a uuid: cache hit, else its record is fetched, opened and cached. Throws
   *  naming the uuid, the URL and status, or the seam's problems. Callers `detach()` before
   *  editing — the cached instance is the repo's. */
  load(uuid: string): Promise<OpenISDDriver>;
}

export function createBundledDriverRepo(deps: BundledDriverRepoDeps): BundledDriverRepo {
  return createBundledRepo<BundledDriverIndexRow, OpenISDDriver>({
    fetch: deps.fetch,
    indexUrl: `${deps.baseUrl}drivers-index.json`,
    recordUrl: path => `${deps.baseUrl}drivers/${path}.json`,
    readIndex: readBundledDriverIndex,
    construct: record => OpenISDDriver.fromConformingRecord(record, deps.engine),
    maxAge_ms: deps.maxAge_ms,
    now: deps.now,
  });
}
