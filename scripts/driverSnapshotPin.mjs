#!/usr/bin/env node
/**
 * driverSnapshotPin.mjs — write scripts/driver-snapshot.pin.
 *
 *   node scripts/driverSnapshotPin.mjs <repo-root> <winisd_drivers-commit>
 *
 * Hashes the vendored fixtures and the committed bundle. Called only by sync-driver-snapshot.sh.
 * bundle_sha256 = sha256 of the lines "<path under packages/ui/public>\t<file sha256>\n",
 * sorted by path, over drivers-index.json, passive-radiators-index.json and every file in drivers/.
 */
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function filesUnder(dir, prefix = '') {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? filesUnder(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]);
}

const [root, commit] = process.argv.slice(2);
if (!root || !commit) { console.error('usage: driverSnapshotPin.mjs <repo-root> <commit>'); process.exit(2); }

const fixtureDir = join(root, 'packages/design/test/fixtures/driver-snapshot');
const fixtures = Object.fromEntries(filesUnder(fixtureDir).sort().map(f => [f, sha256(join(fixtureDir, f))]));

const publicDir = join(root, 'packages/ui/public');
const bundleFiles = ['drivers-index.json', 'passive-radiators-index.json', ...filesUnder(join(publicDir, 'drivers'), 'drivers/')].sort();
const bundleText = bundleFiles.map(f => `${f}\t${sha256(join(publicDir, f))}\n`).join('');

const pin = {winisd_drivers_commit: commit, fixtures, bundle_sha256: createHash('sha256').update(bundleText).digest('hex')};
writeFileSync(join(root, 'scripts/driver-snapshot.pin'), `${JSON.stringify(pin, null, 2)}\n`);
console.log(`  pin written: ${Object.keys(fixtures).length} fixtures, ${bundleFiles.length} bundle files`);
