/**
 * The bundled catalogue's index rows — docs/design/BUNDLED_CATALOGUE_API.md.
 *
 * `scripts/bundle-drivers.mjs` writes these (through `bundledDriverIndexRowOf` /
 * `bundledPassiveRadiatorIndexRowOf` in packages/ui/src/logic/bundledIndexRows.ts, with the app's
 * own functions) and the app reads them, so writer and reader share this one declaration.
 *
 * The indexes are files — `drivers-index.json`, `passive-radiators-index.json` under
 * packages/ui/public/ — and the bundler writes them as these types. What the compiler cannot see
 * is the bytes the running app receives: `response.json()` is `unknown`, and the file can be a
 * different build's than the code (a stale service-worker or CDN copy under a new app, the
 * browser suite's test-bundle directory, a partial deploy, a hand edit). `readBundledDriverIndex`
 * (bundledDriverRepo.ts) and `readBundledPassiveRadiatorIndex` (bundledPassiveRadiatorRepo.ts)
 * are where the bytes are proven to be the declared row rather than assumed: either the rows or
 * every problem, each naming the row and the field. The alternative is a cast, which this
 * repository bans. Types only here; the readers live beside the repo each one serves.
 */

/** What every index row carries. Every row type extends this by name. */
export interface BundledIndexRow {
  /** Identity — the record's own uuid: the list key, favourites, and what `load()` is asked for. */
  readonly uuid: string;
  /** Locator — the record file, `drivers/<path>.json`, relative to the app base. */
  readonly path: string;
  /** Brand + model, as `displayNameOf` names the device. */
  readonly name: string;
  /** Core fields missing or ≤ 0 — the ⚠ flag, for both kinds. */
  readonly dq: boolean;
  readonly datasheet: string | null;
  readonly productPage: string | null;
  readonly listingPage: string | null;
}

/** One bundled driver as the picker lists, filters and flags it. Computed at bundle time by the
 *  app's own functions over a real `OpenISDDriver`, never restated. */
export interface BundledDriverIndexRow extends BundledIndexRow {
  /** `chipsOf(driver).types` — the type-chip filter's vocabulary. */
  readonly chips: readonly string[];
  /** `chipsOf(driver).canonical` — the row's type label. */
  readonly canonical: string;
  readonly Fs_hz: number | null;
  readonly Sd_m2: number | null;
  readonly Xmax_m: number | null;
  /** Air moved — what a matching radiator is sized from. */
  readonly Vd_m3: number | null;
  readonly Znom_ohm: number | null;
}

/** One bundled passive radiator as the PR browser lists it. Raw SI, as the record states it —
 *  null stays null, nothing is derived here. Formatting stays in `radiatorRowsOf`. */
export interface BundledPassiveRadiatorIndexRow extends BundledIndexRow {
  readonly Fs_hz: number | null;
  /** Size, and ~2× the driver's Sd. */
  readonly Sd_m2: number | null;
  readonly Xmax_m: number | null;
  /** ~2× the driver's Vd. */
  readonly Vd_m3: number | null;
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
export type IndexRead<Row extends BundledIndexRow> = IndexRows<Row> | IndexProblems;

