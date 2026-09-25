#!/usr/bin/env node
/**
 * bundle-drivers-if-changed.mjs — run the bundler only when something it depends on has changed.
 *
 *   node scripts/bundle-drivers-if-changed.mjs
 *
 * Plain node, no vite-node: computes the same fingerprint scripts/bundle-drivers.mjs writes to
 * build/drivers-bundle.stamp and spawns the bundler (under tsx) only on a mismatch or a
 * missing output. predev/prebuild call this, so an unchanged corpus costs a stat walk (~0.3 s)
 * rather than loading the domain package (~1 s) to discover there is nothing to do.
 */
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleFingerprintOnDisk, bundleOutputsPresent, corpusPresent, readStamp} from './bundleStamp.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

if (!corpusPresent(ROOT)) {
  // The corpus is a separate repository and CI checks out only this one. The committed
  // catalogue is what the build ships, so an absent corpus is a normal build, not a failure —
  // but an absent corpus AND no catalogue leaves nothing to ship, so that still stops the run.
  if (!bundleOutputsPresent(ROOT)) {
    console.error('drivers catalogue: neither the corpus nor a committed catalogue is present — nothing to build from');
    process.exit(1);
  }
  console.log('drivers catalogue: no corpus checked out — building against the committed catalogue');
} else if (bundleOutputsPresent(ROOT) && readStamp(ROOT) === bundleFingerprintOnDisk(ROOT)) {
  console.log('drivers catalogue: unchanged since the last run (build/drivers-bundle.stamp) — nothing to do');
} else {
  const r = spawnSync('npx', ['tsx', 'scripts/bundle-drivers.mjs'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}
