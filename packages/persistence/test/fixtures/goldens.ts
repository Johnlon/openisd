/** The golden store dumps under `test/goldens`: one directory per case, one file per layout. */
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const GOLDENS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'goldens');

/** A full store dump as an app of one layout writes it: every data key, as text. */
export type Dump = Readonly<Record<string, string>>;

export interface StoreCase {
  readonly name: string;
  /** Layout -> the dump a layout-N app writes, for every layout the case holds a dump for. */
  readonly dumps: ReadonlyMap<number, Dump>;
}

const DUMP_FILE = /^dump-layout-(\d+)\.json$/;

function readDump(path: string): Dump {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${path}: a dump is a JSON object`);
  const dump: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error(`${path}: ${key} is not text`);
    dump[key] = value;
  }
  return dump;
}

/** Every case that holds store dumps, by name. */
export function storeCases(): StoreCase[] {
  return readdirSync(GOLDENS_DIR, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .flatMap((entry): StoreCase[] => {
      const dumps = new Map<number, Dump>();
      for (const file of readdirSync(join(GOLDENS_DIR, entry.name))) {
        const m = DUMP_FILE.exec(file);
        if (m !== null) dumps.set(Number(m[1]), readDump(join(GOLDENS_DIR, entry.name, file)));
      }
      return dumps.size === 0 ? [] : [{name: entry.name, dumps}];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function goldenText(caseName: string, file: string): string {
  return readFileSync(join(GOLDENS_DIR, caseName, file), 'utf8');
}
