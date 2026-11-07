/**
 * The bundled catalogue as ONE file — CLAUDE.md "Offline — release critical".
 *
 * The build writes `catalogue.json`: `{build, driverRows, passiveRadiatorRows, drivers: {<uuid>: record},
 * passiveRadiators: {<uuid>: record}}` (scripts/catalogueBundle.mjs). The catalogue is part of the
 * app's version: it is precached with the shell as one entry, fetched once in the background, and
 * opened only when `build` is the running app's own build id. Another build's file (an installed
 * old shell handed a newer build's catalogue) is a typed refusal naming both builds, never a blank.
 * This module is the boundary: nothing untyped leaves it except the rows and records, which the
 * two bundled repos parse with their own readers and domain seams.
 */

/** The catalogue file is not this app's build, or is not a catalogue at all. */
export class CatalogueBuildMismatch extends Error {
  constructor(readonly url: string, readonly catalogueBuild: string | null, readonly appBuild: string) {
    super(
      catalogueBuild === null
        ? `bundled catalogue: ${url} carries no build stamp; this app is build ${appBuild}. Reload to get a matching catalogue.`
        : `bundled catalogue: ${url} is from build ${catalogueBuild}; this app is build ${appBuild}. Reload to get a matching catalogue.`,
    );
    this.name = 'CatalogueBuildMismatch';
  }
}

/** The parsed catalogue file. Rows and records are unparsed until a repo's reader/seam opens them. */
export interface CatalogueBundle {
  readonly url: string;
  readonly build: string;
  readonly driverRows: unknown;
  readonly passiveRadiatorRows: unknown;
  /** uuid -> record. */
  readonly drivers: Readonly<Record<string, unknown>>;
  readonly passiveRadiators: Readonly<Record<string, unknown>>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The bundle, or a thrown {@link CatalogueBuildMismatch} (other build / no stamp) or Error (malformed). */
export function parseCatalogueBundle(json: unknown, url: string, appBuild: string): CatalogueBundle {
  if (!isPlainObject(json)) throw new CatalogueBuildMismatch(url, null, appBuild);
  const build = typeof json.build === 'string' ? json.build : null;
  if (build !== appBuild) throw new CatalogueBuildMismatch(url, build, appBuild);
  const { drivers, passiveRadiators } = json;
  if (!isPlainObject(drivers) || !isPlainObject(passiveRadiators)) {
    throw new Error(`bundled catalogue: ${url} (build ${build}) has no drivers / passiveRadiators map — rebuild the app`);
  }
  return { url, build, driverRows: json.driverRows, passiveRadiatorRows: json.passiveRadiatorRows, drivers, passiveRadiators };
}

export interface CatalogueSourceDeps {
  readonly fetch: typeof fetch;
  /** `${import.meta.env.BASE_URL}catalogue.json`. */
  readonly url: string;
  /** The running app's build id. */
  readonly build: string;
  /** How long a fetched catalogue is trusted before it is fetched again. */
  readonly maxAge_ms: number;
  readonly now: () => number;
}

/** The one place the catalogue file is fetched: held, shared by concurrent callers, re-fetched once
 *  older than `maxAge_ms`. A failed fetch or refusal is not held; the next call tries again. */
export function createCatalogueSource(deps: CatalogueSourceDeps): () => Promise<CatalogueBundle> {
  // Called detached: the browser's fetch throws "Illegal invocation" when called as a method of `deps`.
  const fetchFile = deps.fetch;
  let held: { readonly bundle: CatalogueBundle; readonly at: number } | null = null;
  let inFlight: Promise<CatalogueBundle> | null = null;

  async function fetchBundle(): Promise<CatalogueBundle> {
    const at = deps.now();
    const response = await fetchFile(deps.url);
    if (!response.ok) {
      throw new Error(`bundled catalogue: ${deps.url} was not served (HTTP ${response.status}) — rebuild the app`);
    }
    const bundle = parseCatalogueBundle(await response.json(), deps.url, deps.build);
    held = { bundle, at };
    return bundle;
  }

  return () => {
    if (held !== null && deps.now() - held.at <= deps.maxAge_ms) return Promise.resolve(held.bundle);
    inFlight ??= fetchBundle().finally(() => { inFlight = null; });
    return inFlight;
  };
}
