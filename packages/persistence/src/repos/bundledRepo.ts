/**
 * The fetch-and-cache mechanism both bundled repos are built on — docs/design/BUNDLED_CATALOGUE_API.md "Mechanism".
 *
 * Internal to this package: `bundledDriverRepo.ts` and `bundledPassiveRadiatorRepo.ts` are this
 * with different data (index URL, shape reader, domain seam) and are what the barrel exports.
 * Constrained to the declared base row, never an inline shape; knows nothing about a row beyond
 * `uuid` and `path`, nothing about a device beyond `construct`. If fitting both kinds ever needs
 * a per-kind branch here, split it — do not bend it.
 *
 * Nothing is cached indefinitely (John, 2026-09-14): the index and every loaded device carry the time
 * they were fetched and are fetched again once older than `maxAge_ms`, so a catalogue updated
 * under a long-lived tab is picked up without a reload. `now` is injected so a test can move the
 * clock.
 */
import type {BundledIndexRow, IndexRead} from './bundledIndex.js';

// ── Index readers: the pieces `readBundledDriverIndex` / `readBundledPassiveRadiatorIndex` share ──

/** A field checker: the value at `where`, or `null` after recording why it is not acceptable. */
export interface FieldReader {
  string(v: unknown, where: string): string | null;
  nullableString(v: unknown, where: string): string | null | undefined;
  nullableNumber(v: unknown, where: string): number | null | undefined;
  boolean(v: unknown, where: string): boolean | null;
  strings(v: unknown, where: string): readonly string[] | null;
}

function fieldReader(problems: string[]): FieldReader {
  const refuse = (where: string, expected: string, v: unknown): undefined => {
    problems.push(`${where}: expected ${expected}, got ${v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v}`);
    return undefined;
  };
  return {
    string: (v, where) => typeof v === 'string' ? v : (refuse(where, 'a string', v) ?? null),
    nullableString: (v, where) => v === null || typeof v === 'string' ? v : refuse(where, 'a string or null', v),
    nullableNumber: (v, where) => v === null || (typeof v === 'number' && Number.isFinite(v)) ? v : refuse(where, 'a finite number or null', v),
    boolean: (v, where) => typeof v === 'boolean' ? v : (refuse(where, 'a boolean', v) ?? null),
    strings: (v, where) => Array.isArray(v) && v.every(s => typeof s === 'string') ? v : (refuse(where, 'an array of strings', v) ?? null),
  };
}

/** The base columns of one row, or `null` with every problem recorded. */
export function baseOf(row: Record<string, unknown>, where: string, f: FieldReader): BundledIndexRow | null {
  const uuid = f.string(row.uuid, `${where}.uuid`);
  const path = f.string(row.path, `${where}.path`);
  const name = f.string(row.name, `${where}.name`);
  const dq = f.boolean(row.dq, `${where}.dq`);
  const datasheet = f.nullableString(row.datasheet, `${where}.datasheet`);
  const productPage = f.nullableString(row.productPage, `${where}.productPage`);
  const listingPage = f.nullableString(row.listingPage, `${where}.listingPage`);
  if (uuid === null || path === null || name === null || dq === null
      || datasheet === undefined || productPage === undefined || listingPage === undefined) return null;
  return { uuid, path, name, dq, datasheet, productPage, listingPage };
}

/** A plain object — narrowed by a GUARD, never a cast. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rowObject(v: unknown, where: string, problems: string[]): Record<string, unknown> | null {
  if (isPlainObject(v)) return v;
  problems.push(`${where}: expected an object, got ${v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v}`);
  return null;
}

export function readIndex<Row extends BundledIndexRow>(
  json: unknown,
  rowOf: (row: Record<string, unknown>, where: string, f: FieldReader) => Row | null,
): IndexRead<Row> {
  if (!Array.isArray(json)) {
    return { problems: [`the index: expected an array, got ${json === null ? 'null' : typeof json}`] };
  }
  const problems: string[] = [];
  const f = fieldReader(problems);
  const rows: Row[] = [];
  json.forEach((v, i) => {
    const obj = rowObject(v, `[${i}]`, problems);
    if (obj === null) return;
    const row = rowOf(obj, `[${i}]`, f);
    if (row !== null) rows.push(row);
  });
  return problems.length > 0 ? { problems } : { rows };
}

// ── The repo ──────────────────────────────────────────────────────────────────────────────


export interface BundledRepoDeps<Row extends BundledIndexRow, Device> {
  readonly fetch: typeof fetch;
  readonly indexUrl: string;
  readonly recordUrl: (path: string) => string;
  /** The index's shape reader — `readBundledDriverIndex` or `readBundledPassiveRadiatorIndex`. */
  readonly readIndex: (json: unknown) => IndexRead<Row>;
  /** The domain seam — the device, or the problems that stop the record being one. */
  readonly construct: (record: unknown) => Device | string[];
  /** How long a fetched index or device is trusted before it is fetched again. */
  readonly maxAge_ms: number;
  readonly now: () => number;
}

export interface BundledRepo<Row extends BundledIndexRow, Device> {
  /** The index: fetched once and held, fetched again once older than `maxAge_ms`.
   *  Throws naming the URL and status when not served, or the URL and every shape problem. */
  index(): Promise<readonly Row[]>;
  /** The device for a uuid: cache hit, else its record is fetched, constructed and cached.
   *  Throws naming the uuid (not in the index), the record URL and status (not served), or the
   *  record URL and the seam's problems (not a device). The cached instance is the repo's:
   *  callers `detach()` before editing, as they do today. */
  load(uuid: string): Promise<Device>;
}

/** A value and the moment it was fetched. */
interface Fetched<T> {
  readonly value: T;
  readonly at: number;
}

async function fetchJson(fetchImpl: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`bundled catalogue: ${url} was not served (HTTP ${response.status}) — rebuild it with scripts/bundle-drivers.mjs`);
  }
  return response.json();
}

export function createBundledRepo<Row extends BundledIndexRow, Device>(deps: BundledRepoDeps<Row, Device>): BundledRepo<Row, Device> {
  let index: Fetched<readonly Row[]> | null = null;
  const devices = new Map<string, Fetched<Device>>();

  const fresh = <T>(f: Fetched<T> | null | undefined): f is Fetched<T> =>
    f !== null && f !== undefined && deps.now() - f.at <= deps.maxAge_ms;

  async function loadIndex(): Promise<readonly Row[]> {
    if (fresh(index)) return index.value;
    const at = deps.now();
    const read = deps.readIndex(await fetchJson(deps.fetch, deps.indexUrl));
    if ('problems' in read) {
      throw new Error(
        `bundled catalogue: ${deps.indexUrl} is not a usable index — rebuild it with scripts/bundle-drivers.mjs:\n` +
        read.problems.map(m => `  - ${m}`).join('\n'),
      );
    }
    index = { value: read.rows, at };
    return read.rows;
  }

  async function loadDevice(uuid: string): Promise<Device> {
    const cached = devices.get(uuid);
    if (fresh(cached)) return cached.value;
    const rows = await loadIndex();
    const row = rows.find(r => r.uuid === uuid);
    if (row === undefined) throw new Error(`bundled catalogue: ${uuid} is not in the index ${deps.indexUrl}`);
    const url = deps.recordUrl(row.path);
    const at = deps.now();
    const device = deps.construct(await fetchJson(deps.fetch, url));
    if (Array.isArray(device)) {
      throw new Error(`bundled catalogue: ${url} is not a usable record:\n` + device.map(m => `  - ${m}`).join('\n'));
    }
    devices.set(uuid, { value: device, at });
    return device;
  }

  return { index: loadIndex, load: loadDevice };
}
