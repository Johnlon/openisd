/**
 * bundleStamp.mjs — the fingerprint that lets `bundle-drivers.mjs` skip a rebuild.
 *
 * `npm run dev` and `npm run build` run the bundler every time. The corpus rarely changes, so the
 * bundler records a fingerprint of everything its output depends on — every corpus record and
 * every source file that decides what a row or record looks like — and skips the walk when the
 * fingerprint matches the last run's. `--force` ignores the stamp.
 *
 * Pure: takes the stat list, returns the fingerprint. The CLI gathers the stats.
 */
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

/** Where the catalogue's inputs and outputs live, relative to the repo root. */
export const CORPUS_RELATIVE = ['..', 'winisd_drivers', 'db', 'datasheets'];
export const OUTPUTS = ['packages/ui/public/drivers-index.json', 'packages/ui/public/passive-radiators-index.json', 'packages/ui/public/drivers'];
export const STAMP = 'build/drivers-bundle.stamp';
/** Source files whose change alters a row or a record's shape — part of the fingerprint. */
export const SOURCE_INPUTS = [
  'scripts/bundle-drivers.mjs', 'scripts/bundleProjection.mjs', 'scripts/roundTripGate.mjs', 'scripts/bundleStamp.mjs',
  'packages/ui/src/logic/bundledIndexRows.ts', 'packages/ui/src/logic/driverDisplay.ts',
  'packages/persistence/src/repos/bundledIndex.ts',
];
export const SOURCE_DIRS = ['packages/design/domain', 'packages/design/filter'];

/** One input the bundle depends on, as the filesystem reports it. */
export class BundleInput {
  /**
   * @param {string} path  repo- or corpus-relative, forward-slashed
   * @param {number} mtimeMs
   * @param {number} size
   */
  constructor(path, mtimeMs, size) {
    this.path = path;
    this.mtimeMs = mtimeMs;
    this.size = size;
  }
}

/**
 * The fingerprint of a set of inputs. Order-independent; any path, time or size change changes it.
 * @param {readonly BundleInput[]} inputs
 * @returns {string}
 */
export function bundleFingerprint(inputs) {
  const lines = inputs.map(i => `${i.path}\t${i.mtimeMs}\t${i.size}`).sort();
  return createHash('sha1').update(lines.join('\n')).digest('hex');
}

/** Every file under `dir` (recursively, `_`-prefixed dirs skipped) whose name `keep` accepts. */
export function walkFiles(dir, keep) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;   // _ dirs are cache/scratch — never bundled
      files.push(...walkFiles(join(dir, entry.name), keep));
    } else if (keep(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/** The fingerprint of the catalogue's inputs as they are on disk now. Throws if the corpus is
 *  not checked out. */
export function bundleFingerprintOnDisk(root) {
  const corpus = join(root, ...CORPUS_RELATIVE);
  const inputs = walkFiles(corpus, name => name.toLowerCase() === 'openisd.json').map(f => {
    const st = statSync(f);
    return new BundleInput(relative(corpus, f).replace(/\\/g, '/'), st.mtimeMs, st.size);
  });
  const sources = [
    ...SOURCE_INPUTS.map(p => join(root, p)),
    ...SOURCE_DIRS.flatMap(d => walkFiles(join(root, d), name => name.endsWith('.ts'))),
  ];
  for (const f of sources) {
    const st = statSync(f);
    inputs.push(new BundleInput(relative(root, f).replace(/\\/g, '/'), st.mtimeMs, st.size));
  }
  return bundleFingerprint(inputs);
}

export function bundleOutputsPresent(root) {
  return OUTPUTS.every(p => existsSync(join(root, p)));
}

/** Whether the driver corpus is checked out beside this repo. It is a SEPARATE repository
 *  (`winisd_drivers`), so a CI checkout of this one alone does not have it — and does not need
 *  it, because `OUTPUTS` are committed. */
export function corpusPresent(root) {
  return existsSync(join(root, ...CORPUS_RELATIVE));
}

/** The stamp of the last run, or null when there was none. */
export function readStamp(root) {
  const p = join(root, STAMP);
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : null;
}
