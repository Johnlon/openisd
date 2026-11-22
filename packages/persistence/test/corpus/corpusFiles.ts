/**
 * Shared by the stored-data corpus specs (SDLC S4): the files to parse and the loop that reports
 * each refused file by name. Nothing here writes anywhere; `winisd_drivers/db` is not touched.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..', '..');
export const engine = createEngine();

/** Every file under `dir` whose name ends with `suffix`, as absolute paths, sorted. */
export function filesUnder(dir: string, suffix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(path, suffix));
    else if (entry.name.endsWith(suffix)) found.push(path);
  }
  return found.sort();
}

function describeThrown(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The files `check` refuses, as `<file>: <why>` lines. `check` returns the problems, or [] when the file parses. */
export function refused(files: readonly string[], check: (text: string) => readonly string[]): string[] {
  const out: string[] = [];
  for (const file of files) {
    try {
      const problems = check(readFileSync(file, 'utf8'));
      if (problems.length > 0) out.push(`${relative(ROOT, file)}: ${problems.slice(0, 3).join('; ')}`);
    } catch (e) {
      out.push(`${relative(ROOT, file)}: threw ${describeThrown(e)}`);
    }
  }
  return out;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A bundled record that is a passive radiator: its `specs` has a passive-radiator section and no woofer. */
function isPassiveRadiatorRecord(record: unknown): boolean {
  const specs = isRecord(record) ? record.specs : undefined;
  return isRecord(specs) && 'passive-radiator' in specs && !('woofer' in specs);
}

/** The bundled driver files, every `count`th one starting at `shard`: a shard is one spec file, so
 *  the shards run on separate workers (opening a record costs ~150 ms; there are ~1700). */
export function bundledDriverShard(shard: number, count: number): string[] {
  return filesUnder(join(ROOT, 'packages', 'ui', 'public', 'drivers'), '.json').filter((_, i) => i % count === shard);
}

/** Refused driver files of a shard: a driver through `OpenISDDriver`, a passive radiator through its own opener. */
export function refusedDrivers(files: readonly string[]): string[] {
  return refused(files, text => {
    const record: unknown = JSON.parse(text);
    const opened = isPassiveRadiatorRecord(record)
      ? OpenISDPassiveRadiatorStandalone.fromConformingRecord(record)
      : OpenISDDriver.fromConformingRecord(record, engine);
    return Array.isArray(opened) ? opened : [];
  });
}
