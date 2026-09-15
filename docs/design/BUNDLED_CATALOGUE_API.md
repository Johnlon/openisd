# Bundled catalogue API — index + on-demand records

Status: built. Open points are marked PROPOSED.

The bundled driver catalogue stops being one 10 MB JSON module. The bundler writes a small
search index per kind and one record file per device; the app fetches an index when a picker
opens and a record only when a device is picked. Nothing is imported as a module.

## Artifacts — `packages/ui/public/`, all tracked (CI has no corpus)

| File                           | Content                                              |
| ------------------------------ | ---------------------------------------------------- |
| `drivers-index.json`           | `BundledDriverIndexRow[]`                            |
| `passive-radiators-index.json` | `BundledPassiveRadiatorIndexRow[]`                   |
| `drivers/<brand>/<sku>.json`   | the canonical record, verbatim — one file per device |

## Rows — `packages/persistence/src/repos/bundledIndex.ts`

The bundler writes rows of these types and the app reads them; both compile against this file.

```ts
/** What every index row carries. Every row type extends this by name. */
export interface BundledIndexRow {
  readonly uuid: string; // identity — the record's own uuid; list key, favourites, load()
  readonly path: string; // locator — `<brand>/<sku>`; the record is drivers/<path>.json
  readonly name: string; // brand + model (displayNameOf)
  readonly dq: boolean; // core fields missing or ≤ 0 — the ⚠ flag, both kinds
  readonly datasheet: string | null; // data_sources.manufacturer_datasheet
  readonly productPage: string | null; // data_sources.manufacturer_product_page
  readonly listingPage: string | null; // data_sources.manufacturer_listing_page
}

/** One bundled driver as the picker lists, filters and flags it. Computed at bundle time by the
 *  app's own functions over a real OpenISDDriver, never restated. */
export interface BundledDriverIndexRow extends BundledIndexRow {
  readonly chips: readonly string[]; // chipsOf(driver).types
  readonly canonical: string; // chipsOf(driver).canonical
  readonly Fs_hz: number | null;
  readonly Sd_m2: number | null;
  readonly Xmax_m: number | null;
  readonly Vd_m3: number | null; // air moved
  readonly Znom_ohm: number | null;
}

/** One bundled passive radiator as the PR browser lists it. Raw SI as the record states it —
 *  null stays null, nothing derived. Formatting stays in radiatorRowsOf. */
export interface BundledPassiveRadiatorIndexRow extends BundledIndexRow {
  readonly Fs_hz: number | null;
  readonly Sd_m2: number | null; // size, and ~2× the driver's Sd
  readonly Xmax_m: number | null;
  readonly Vd_m3: number | null; // ~2× the driver's Vd
  readonly Mms_kg: number | null;
  readonly Cms_m_per_N: number | null;
  readonly Vas_m3: number | null;
  readonly Qms: number | null;
}

/** An index read: the rows, or every problem naming row and field. */
export interface IndexRows<Row extends BundledIndexRow> {
  readonly rows: readonly Row[];
}
export interface IndexProblems {
  readonly problems: readonly string[];
}
export type IndexRead<Row extends BundledIndexRow> =
  IndexRows<Row> | IndexProblems;

/** Shape checks, one per index — declared beside the repo each serves:
 *  readBundledDriverIndex in bundledDriverRepo.ts, readBundledPassiveRadiatorIndex in
 *  bundledPassiveRadiatorRepo.ts. */
export function readBundledDriverIndex(
  json: unknown,
): IndexRead<BundledDriverIndexRow>;
export function readBundledPassiveRadiatorIndex(
  json: unknown,
): IndexRead<BundledPassiveRadiatorIndexRow>;
```

## Mechanism — `packages/persistence/src/repos/bundledRepo.ts` (internal, not in the barrel)

A generic, constrained to the declared base, never an inline shape. Uncompromised: no `any`,
no widening, no per-kind branch. If fitting both kinds ever needs one, split it. The shared
index-reading pieces (`FieldReader`, `baseOf`, `readIndex`) live here too; each kind's
`read…Index` lives beside its repo, in the file that owns the factory.

```ts
export interface BundledRepoDeps<Row extends BundledIndexRow, Device> {
  readonly fetch: typeof fetch;
  readonly indexUrl: string;
  readonly recordUrl: (path: string) => string;
  readonly readIndex: (json: unknown) => IndexRead<Row>;
  readonly construct: (record: unknown) => Device | string[]; // the domain seam, or its refusals
  readonly maxAge_ms: number; // nothing is cached indefinitely
  readonly now: () => number;
}

export interface BundledRepo<Row extends BundledIndexRow, Device> {
  /** The index, fetched once and held; fetched again once older than maxAge_ms.
   *  Throws: `<indexUrl> was not served (HTTP n)` | `<indexUrl> is not a usable index: - problem…` */
  index(): Promise<readonly Row[]>;
  /** The device for a uuid: cache hit, else its record is fetched, constructed and cached.
   *  Throws: `<uuid> is not in the index` | `<recordUrl> was not served (HTTP n)` |
   *          `<recordUrl> is not a <kind>: - problem…`.
   *  The cached instance is the repo's: callers detach() before editing, as they do today. */
  load(uuid: string): Promise<Device>;
}

export function createBundledRepo<Row extends BundledIndexRow, Device>(
  deps: BundledRepoDeps<Row, Device>,
): BundledRepo<Row, Device>;
```

## Drivers — `packages/persistence/src/repos/bundledDriverRepo.ts`

```ts
export interface BundledDriverRepoDeps {
  readonly fetch: typeof fetch;
  readonly baseUrl: string; // import.meta.env.BASE_URL: '/', '/openisd/' or './'
  readonly engine: Engine;
  readonly maxAge_ms: number;
  readonly now: () => number;
}

export interface BundledDriverRepo {
  index(): Promise<readonly BundledDriverIndexRow[]>;
  load(uuid: string): Promise<OpenISDDriver>;
}

export function createBundledDriverRepo(
  deps: BundledDriverRepoDeps,
): BundledDriverRepo;
// = createBundledRepo<BundledDriverIndexRow, OpenISDDriver>({
//     fetch: deps.fetch,
//     indexUrl:  `${deps.baseUrl}drivers-index.json`,
//     recordUrl: path => `${deps.baseUrl}drivers/${path}.json`,
//     readIndex: readBundledDriverIndex,
//     construct: record => OpenISDDriver.fromConformingRecord(record, deps.engine),
//   })
```

## Passive radiators — `packages/persistence/src/repos/bundledPassiveRadiatorRepo.ts`

```ts
export interface BundledPassiveRadiatorRepoDeps {
  readonly fetch: typeof fetch;
  readonly baseUrl: string;
  readonly engine: Engine;
  readonly maxAge_ms: number;
  readonly now: () => number;
}

export interface BundledPassiveRadiatorRepo {
  index(): Promise<readonly BundledPassiveRadiatorIndexRow[]>;
  load(uuid: string): Promise<OpenISDPassiveRadiatorStandalone>;
}

export function createBundledPassiveRadiatorRepo(
  deps: BundledPassiveRadiatorRepoDeps,
): BundledPassiveRadiatorRepo;
// = createBundledRepo<BundledPassiveRadiatorIndexRow, OpenISDPassiveRadiatorStandalone>({
//     fetch: deps.fetch,
//     indexUrl:  `${deps.baseUrl}passive-radiators-index.json`,
//     recordUrl: path => `${deps.baseUrl}drivers/${path}.json`,
//     readIndex: readBundledPassiveRadiatorIndex,
//     construct: record => OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, deps.engine),
//   })
```

## Barrel — `packages/persistence/src/index.ts`

```ts
export type {
  BundledIndexRow,
  BundledDriverIndexRow,
  BundledPassiveRadiatorIndexRow,
  IndexRead,
  IndexRows,
  IndexProblems,
} from "./repos/bundledIndex.js";
export {
  type BundledDriverRepo,
  type BundledDriverRepoDeps,
  createBundledDriverRepo,
  readBundledDriverIndex,
} from "./repos/bundledDriverRepo.js";
export {
  type BundledPassiveRadiatorRepo,
  type BundledPassiveRadiatorRepoDeps,
  createBundledPassiveRadiatorRepo,
  readBundledPassiveRadiatorIndex,
} from "./repos/bundledPassiveRadiatorRepo.js";
// REMOVED: BundleRecord, DriverBundle, readBundle, fetchDriverBundle, DriverRepo, DriverRepoDeps, createDriverRepo
```

## Writer side — `packages/ui/src/logic/bundledIndexRows.ts` (the bundler calls these under vite-node)

```ts
/** One row from one real domain object, with the app's own functions (displayNameOf, chipsOf,
 *  driverHasDqIssues / radiatorHasDqIssues, dataSource, the spec fields). The bundler restates
 *  nothing; a staleness gate holds the row the bundler wrote against the row this produces. */
export function bundledDriverIndexRowOf(
  driver: OpenISDDriver,
  path: string,
): BundledDriverIndexRow;
export function bundledPassiveRadiatorIndexRowOf(
  radiator: OpenISDPassiveRadiatorStandalone,
  path: string,
): BundledPassiveRadiatorIndexRow;

// packages/ui/src/logic/driverDisplay.ts — new, beside driverHasDqIssues
/** PROPOSED rule: Fs_hz or Sd_m2 missing or ≤ 0, or neither Mms_kg nor Cms_m_per_N usable. */
export function radiatorHasDqIssues(
  radiator: OpenISDPassiveRadiatorStandalone,
): boolean;
```

## Composition root — `packages/ui/src/main.ts`

```ts
const CATALOGUE_MAX_AGE_MS = 60 * 60 * 1000;
const driverRepo = createBundledDriverRepo({
  fetch,
  baseUrl: import.meta.env.BASE_URL,
  engine,
  maxAge_ms: CATALOGUE_MAX_AGE_MS,
  now: Date.now,
});
const passiveRadiatorRepo = createBundledPassiveRadiatorRepo({
  fetch,
  baseUrl: import.meta.env.BASE_URL,
  engine,
  maxAge_ms: CATALOGUE_MAX_AGE_MS,
  now: Date.now,
});
// nothing awaited — the app mounts; each picker awaits index() when it opens
```

## Browsing state — `packages/ui/src/logic/driverBrowsingState.ts`, what changes

| Today                                                             | After                                                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allDrivers: ShallowRef<OpenISDDriver[]>`                         | `ShallowRef<readonly BundledDriverIndexRow[]>`                                                                                                       |
| `init()`: `driverRepo.bundledDrivers()` (constructs 1928 objects) | `await driverRepo.index()`; `statusErr`/`statusMsg` on throw                                                                                         |
| `pickDriver(d)`                                                   | `pickDriver(d \| null)` keeps previewing a domain object (My Drivers, clear); `pickBundledDriver(row)` loads through the repo, then previews         |
| `chooseDriver(d)` embeds `d.detach()`                             | unchanged — it takes the previewed (loaded) driver                                                                                                   |
| `cloneDriver(d)`                                                  | unchanged — it takes the previewed (loaded) driver                                                                                                   |
| `isFavorite(d)` / `toggleFavorite(d)` on `d.uuid()`               | `isFavorite(uuid)` / `toggleFavorite(uuid)` — `row.uuid` for a bundled row, `driverId(d)` for a domain object; favourites stay `string[]`, same keys |
| `matchesCriteria(driver, c)` reads the domain object              | `matchesCriteria(subject, c)` over a `SearchSubject` — `searchSubjectOfIndexRow(row)` for the pool, `searchSubjectOfDriver(d)` for My Drivers        |
| `DriverBrowser.vue` bundled row reads `d`                         | reads `row.name`, `row.dq`, `row.datasheet/productPage/listingPage`, `row.uuid`                                                                      |
| My Drivers rows                                                   | unchanged — local objects                                                                                                                            |
| PR browser lists `list()`-everything objects, id = list position  | lists `BundledPassiveRadiatorIndexRow`, shows `row.dq`, id = `row.uuid`, `load()`s on pick                                                           |

## Bundler and test bundle

| Item                                               | Disposition                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/bundle-drivers.mjs`                       | writes the three artifact kinds above; stamp cache over corpus stat-list + the scripts and source files that shape a row (`scripts/bundleStamp.mjs`); `scripts/bundle-drivers-if-changed.mjs` is the plain-node predev/prebuild entry (0.4 s when unchanged); `--force` overrides |
| `scripts/test-bundle.mjs`                          | cuts `build/test-bundle/{drivers-index.json, passive-radiators-index.json, drivers/<paths>.json}` BY PATH from the tracked artifacts — no corpus                                                                                                                                  |
| `packages/ui/test/fixtures/test-bundle-paths.json` | `tang-band/w5-1138smf`, `dayton-audio/e150he-44`, `dayton-audio/cx120-8`, `dayton-audio/nd20fa-6`, `dayton-audio/nd140-pr`, `dayton-audio/e150he-pr`                                                                                                                              |
| `vite.config.js` `serveBundle`                     | with `OPENISD_DRIVERS_BUNDLE_DIR` set, `/drivers-index.json`, `/passive-radiators-index.json`, `/drivers/**` are served from that dir instead of `public/`                                                                                                                        |
| `vite.config.js` watcher                           | with `OPENISD_TEST_SERVER=1`, `server.watch` is `null` — no polling on the suite's vite                                                                                                                                                                                           |
| `playwright.config.js` `webServer.command`         | `node scripts/test-bundle.mjs build/test-bundle && OPENISD_DRIVERS_BUNDLE_DIR=build/test-bundle OPENISD_TEST_SERVER=1 npx vite --port ${PORT}`                                                                                                                                    |
| PWA                                                | the indexes and `drivers/**` are not precached; `runtimeCaching` stale-while-revalidate, 7-day expiry, so a republished catalogue reaches an installed app; `autoUpdate` reloads open pages onto a new build                                                                      |

## Gates

| Gate                                              | Proves                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundledIndex` reader tests                       | a malformed row is refused, naming the row and field                                                                                                          |
| `bundledRepo` tests (stub fetch)                  | index once; load: cache hit returns the same instance, miss fetches once, unknown uuid / 404 / seam refusal each throw naming the cause                       |
| staleness test                                    | the tracked index rows for the six test records equal `bundledDriverIndexRowOf` / `bundledPassiveRadiatorIndexRowOf` recomputed from the tracked record files |
| identity test (replaces `drivers-bundle.test.ts`) | every `uuid` and every `path` in each index is unique                                                                                                         |
| `config.test.ts`                                  | `main.ts` imports no JSON module and builds both repos; the bundler writes under `public/`                                                                    |

## Open

| Point                                        | Owner |
| -------------------------------------------- | ----- |
| `radiatorHasDqIssues` rule (PROPOSED above)  | John  |
| `Vd_m3` on the driver row — kept, say if not | John  |
