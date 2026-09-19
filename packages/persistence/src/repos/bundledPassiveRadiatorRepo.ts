/** REPO: the bundled passive-radiator catalogue — docs/design/BUNDLED_CATALOGUE_API.md
 *  "Passive radiators".
 *
 *  `createBundledRepo` with the radiator's data: `passive-radiators-index.json` under the app
 *  base, read by `readBundledPassiveRadiatorIndex`, and records opened through
 *  `OpenISDPassiveRadiatorStandalone.fromConformingRecord`. Records live in the same `drivers/`
 *  store as the drivers' — a radiator record is a device record. */
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import type {Engine} from '@openisd/design/engine';
import type {BundledPassiveRadiatorIndexRow, IndexRead} from './bundledIndex.js';
import {baseOf, createBundledRepo, type FieldReader, readIndex} from './bundledRepo.js';

function radiatorRowOf(row: Record<string, unknown>, where: string, f: FieldReader): BundledPassiveRadiatorIndexRow | null {
  const base = baseOf(row, where, f);
  const Fs_hz = f.nullableNumber(row.Fs_hz, `${where}.Fs_hz`);
  const Sd_m2 = f.nullableNumber(row.Sd_m2, `${where}.Sd_m2`);
  const Xmax_m = f.nullableNumber(row.Xmax_m, `${where}.Xmax_m`);
  const Vd_m3 = f.nullableNumber(row.Vd_m3, `${where}.Vd_m3`);
  const Mms_kg = f.nullableNumber(row.Mms_kg, `${where}.Mms_kg`);
  const Cms_m_per_N = f.nullableNumber(row.Cms_m_per_N, `${where}.Cms_m_per_N`);
  const Vas_m3 = f.nullableNumber(row.Vas_m3, `${where}.Vas_m3`);
  const Qms = f.nullableNumber(row.Qms, `${where}.Qms`);
  if (base === null || Fs_hz === undefined || Sd_m2 === undefined || Xmax_m === undefined || Vd_m3 === undefined
      || Mms_kg === undefined || Cms_m_per_N === undefined || Vas_m3 === undefined || Qms === undefined) return null;
  return { ...base, Fs_hz, Sd_m2, Xmax_m, Vd_m3, Mms_kg, Cms_m_per_N, Vas_m3, Qms };
}

/** `passive-radiators-index.json` as loaded: the rows, or every problem naming row and field. */
export function readBundledPassiveRadiatorIndex(json: unknown): IndexRead<BundledPassiveRadiatorIndexRow> {
  return readIndex(json, radiatorRowOf);
}

export interface BundledPassiveRadiatorRepoDeps {
  readonly fetch: typeof fetch;
  /** `import.meta.env.BASE_URL` — `/`, the GitHub Pages `/openisd/`, or Electron's `./`. */
  readonly baseUrl: string;
  /** Handed to the domain seam that opens each record — injected, never constructed here. */
  readonly engine: Engine;
  /** How long a fetched index or radiator is trusted before it is fetched again. */
  readonly maxAge_ms: number;
  readonly now: () => number;
}

export interface BundledPassiveRadiatorRepo {
  /** The index, fetched once and held; fetched again once older than `maxAge_ms`. */
  index(): Promise<readonly BundledPassiveRadiatorIndexRow[]>;
  /** The radiator for a uuid: cache hit, else its record is fetched, opened and cached. Throws
   *  naming the uuid, the URL and status, or the seam's problems. Callers copy before editing —
   *  the cached instance is the repo's. */
  load(uuid: string): Promise<OpenISDPassiveRadiatorStandalone>;
}

export function createBundledPassiveRadiatorRepo(deps: BundledPassiveRadiatorRepoDeps): BundledPassiveRadiatorRepo {
  return createBundledRepo<BundledPassiveRadiatorIndexRow, OpenISDPassiveRadiatorStandalone>({
    fetch: deps.fetch,
    indexUrl: `${deps.baseUrl}passive-radiators-index.json`,
    recordUrl: path => `${deps.baseUrl}drivers/${path}.json`,
    readIndex: readBundledPassiveRadiatorIndex,
    construct: record => OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, deps.engine),
    maxAge_ms: deps.maxAge_ms,
    now: deps.now,
  });
}
