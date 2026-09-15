#!/usr/bin/env node
/**
 * bundle-drivers-if-changed.mjs — run the bundler only when something it depends on has changed.
 *
 *   node scripts/bundle-drivers-if-changed.mjs
 *
 * Plain node, no vite-node: computes the same fingerprint scripts/bundle-drivers.mjs writes to
 * build/drivers-bundle.stamp and spawns the bundler (under vite-node) only on a mismatch or a
 * missing output. predev/prebuild call this, so an unchanged corpus costs a stat walk (~0.3 s)
 * rather than loading the domain package (~5 s) to discover there is nothing to do.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFingerprintOnDisk, bundleOutputsPresent, readStamp } from './bundleStamp.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

if (bundleOutputsPresent(ROOT) && readStamp(ROOT) === bundleFingerprintOnDisk(ROOT)) {
  console.log('drivers catalogue: unchanged since the last run (build/drivers-bundle.stamp) — nothing to do');
} else {
  const r = spawnSync('npx', ['vite-node', 'scripts/bundle-drivers.mjs'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}
