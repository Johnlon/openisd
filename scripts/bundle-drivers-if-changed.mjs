#!/usr/bin/env node
/**
 * bundle-drivers-if-changed.mjs — check the committed driver catalogue is there.
 *
 *   node scripts/bundle-drivers-if-changed.mjs
 *
 * predev/prebuild call this. It never touches the driver corpus: the committed catalogue
 * (packages/ui/public) is the pinned build snapshot, refreshed only by
 * scripts/sync-driver-snapshot.sh. Plain node, no vite-node.
 */
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleOutputsPresent} from './bundleStamp.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

if (!bundleOutputsPresent(ROOT)) {
  console.error('drivers catalogue: the committed catalogue (packages/ui/public/drivers-index.json, passive-radiators-index.json, drivers/) is missing — restore it from git, or run bash scripts/sync-driver-snapshot.sh');
  process.exit(1);
}
console.log('drivers catalogue: using the committed catalogue (pinned in scripts/driver-snapshot.pin)');
