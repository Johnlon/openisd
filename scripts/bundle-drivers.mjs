#!/usr/bin/env node
/**
 * bundle-drivers.mjs — writes the bundled driver catalogue the app serves and fetches.
 *
 *   npx tsx scripts/bundle-drivers.mjs --corpus <datasheets-dir> [--force]
 *   npx tsx scripts/bundle-drivers.mjs --corpus <datasheets-dir> --only-record <brand/sku> [--only-record ...]
 *
 * Design: docs/design/BUNDLED_CATALOGUE_API.md. The corpus is `--corpus <dir>` (required;
 * only scripts/sync-driver-snapshot.sh passes it, from committed winisd_drivers/snapshot/datasheets); each `<brand>/<sku>/openisd.json` is the canonical
 * driver record (ARCHITECTURE.md AD-8), written by winisd_tools. Nothing else is read.
 *
 * Outputs, all under packages/ui/public/ and all tracked in git (CI has no corpus checkout):
 *
 *   drivers-index.json               BundledDriverIndexRow[]          — what the driver picker lists
 *   passive-radiators-index.json     BundledPassiveRadiatorIndexRow[] — what the PR browser lists
 *   drivers/<brand>/<sku>.json       the canonical record, verbatim   — fetched when a device is picked
 *
 * Each record is opened through the domain's own seam (`OpenISDDriver.fromConformingRecord` /
 * `OpenISDPassiveRadiatorStandalone.fromConformingRecord`, inside the round-trip gate) and its
 * index row is written from that domain object by the app's own row functions
 * (packages/ui/src/logic/bundledIndexRows.ts). A record the seam refuses fails the build.
 *
 * Bundling gate: structural readability only (`isBundlable`, John's QO79/QO81 ruling — no record
 * is excluded for missing spec params). A driver goes to drivers-index.json, a passive radiator
 * to passive-radiators-index.json. A record with no `specs` container is skipped and listed.
 *
 * Skips the walk when nothing has changed: the fingerprint of every corpus record plus every
 * source file that shapes a row or record is kept in build/drivers-bundle.stamp and compared
 * first (scripts/bundleStamp.mjs). `--force` rebuilds regardless. predev/prebuild call
 * scripts/bundle-drivers-if-changed.mjs, which only checks the committed outputs exist.
 *
 * Runs under tsx (predev/prebuild) because the packages export TypeScript source.
 */

import {readFileSync, statSync} from 'fs';
import {dirname, join, relative, resolve} from 'path';
import {fileURLToPath} from 'url';
import {isBundlable, project} from './bundleProjection.mjs';
import {applyBundleOutputs, filesForSelectedPaths, onlyRecordPathsFromArgs} from './bundleOutputs.mjs';
import {checkOpenisdRoundTrip} from './roundTripGate.mjs';
import {
    bundleFingerprintOnDisk,
    bundleOutputsPresent,
    readStamp,
    STAMP,
    walkFiles
} from './bundleStamp.mjs';
import {bundledDriverIndexRowOf, bundledPassiveRadiatorIndexRowOf} from '../packages/ui/src/logic/bundledIndexRows.ts';
import {OpenISDPassiveRadiatorStandalone} from '@openisd/design';

const RECORD_FILE = 'openisd.json';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const CORPUS = corpusArg(process.argv);
const SELECTED_PATHS = onlyRecordPathsFromArgs(process.argv);
const PUBLIC = join(ROOT, 'packages', 'ui', 'public');
const DRIVER_INDEX = join(PUBLIC, 'drivers-index.json');
const RADIATOR_INDEX = join(PUBLIC, 'passive-radiators-index.json');
const STAMP_FILE = join(ROOT, STAMP);

function corpusArg(argv) {
  const i = argv.indexOf('--corpus');
  const dir = i >= 0 ? argv[i + 1] : undefined;
  if (!dir) {
    console.error('bundle-drivers: --corpus <dir> is required (the snapshot datasheets directory). Run scripts/sync-driver-snapshot.sh to refresh the committed bundle from winisd_drivers/snapshot.');
    process.exit(2);
  }
  return resolve(dir);
}

function walkRecords(dir) {
  return walkFiles(dir, name => name.toLowerCase() === RECORD_FILE);
}

/** The record's identity and locator: `<brand>/<sku>` — the directory holding its openisd.json. */
function recordPathOf(corpusRoot, file) {
  return relative(corpusRoot, dirname(file)).replace(/\\/g, '/');
}

function main() {
  const force = process.argv.includes('--force');

  console.log(`\nOpenISD\n  reading ${CORPUS}`);
  if (SELECTED_PATHS.size > 0) {
    console.log(`  selected record path(s): ${[...SELECTED_PATHS].join(', ')}`);
  }
  let rawFiles;
  try { rawFiles = walkRecords(CORPUS); }
  catch { throw new Error(`driver source path is not checked out: ${CORPUS}`); }
  console.log(`  found ${rawFiles.length} ${RECORD_FILE} files`);

  const fingerprint = bundleFingerprintOnDisk(ROOT, CORPUS);
  if (SELECTED_PATHS.size === 0 && !force && bundleOutputsPresent(ROOT) && readStamp(ROOT) === fingerprint) {
    console.log(`  unchanged since the last run (build/drivers-bundle.stamp) — nothing rewritten; --force to rebuild`);
    return;
  }
  const filesToRead = filesForSelectedPaths(rawFiles, SELECTED_PATHS, file => recordPathOf(CORPUS, file));
  if (SELECTED_PATHS.size > 0) console.log(`  validating ${filesToRead.length} selected record(s)`);

  const driverRows = [];
  const radiatorRows = [];
  const records = [];
  const skipped = [];
  const perGroup = new Map();
  const roundTripFailures = [];

  for (const [index, file] of filesToRead.entries()) {
    const path = recordPathOf(CORPUS, file);
    const group = path.split('/')[0];
    const record = JSON.parse(readFileSync(file, 'utf8'));
    if (record == null) throw new Error(`${path}: empty or unparseable record`);

    const projected = project(record);

    if (!isBundlable(projected)) {
      skipped.push(path);
    } else {
      const gate = checkOpenisdRoundTrip(record, path);
      if (!gate.ok) {
        roundTripFailures.push(gate.message);
      } else {
        const device = gate.device;
        if (device instanceof OpenISDPassiveRadiatorStandalone) {
          radiatorRows.push(bundledPassiveRadiatorIndexRowOf(device, path));
        } else {
          driverRows.push(bundledDriverIndexRowOf(device, path));
        }
        records.push({ path, record });
        perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
      }
    }

    if (records.length % 250 === 0 || index === filesToRead.length - 1) {
      console.log(`  ${String(index + 1).padStart(5)}/${filesToRead.length} opened — ${records.length} usable, ${skipped.length} unusable`);
    }
  }

  if (roundTripFailures.length > 0) {
    throw new Error(
      `${roundTripFailures.length} openisd.json round-trip failure(s) — ` +
      `the app's own loader/export path does not reproduce these records:\n` +
      roundTripFailures.map(m => `  - ${m}`).join('\n'),
    );
  }
  console.log(`  round-trip gate: ${records.length}/${filesToRead.length} ${SELECTED_PATHS.size > 0 ? 'selected record(s)' : 'records'} clean`);

  for (const [group, n] of [...perGroup].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${group.padEnd(24)} ${String(n).padStart(4)}`);
  }
  if (skipped.length) {
    console.log(`  ${skipped.length} records are NOT bundled (structurally unreadable — no specs container), first 5:`);
    for (const p of skipped.slice(0, 5)) console.log(`    - ${p}`);
  }

  const written = applyBundleOutputs({
    publicRoot: PUBLIC,
    stampFile: STAMP_FILE,
    records,
    driverRows,
    radiatorRows,
    selectedPaths: SELECTED_PATHS,
    fingerprint,
  });

  const kb = n => Math.round(n / 1024);
  const driverIndexCount = JSON.parse(readFileSync(DRIVER_INDEX, 'utf8')).length;
  const radiatorIndexCount = JSON.parse(readFileSync(RADIATOR_INDEX, 'utf8')).length;
  console.log(
    `\n  → ${driverIndexCount} drivers (drivers-index.json ${kb(statSync(DRIVER_INDEX).size)} KB), ` +
    `${radiatorIndexCount} passive radiators (passive-radiators-index.json ${kb(statSync(RADIATOR_INDEX).size)} KB), ` +
    `${written} record file(s) written under packages/ui/public/drivers/` +
    (SELECTED_PATHS.size > 0 ? ' (selected refresh; unselected records/index rows preserved; full-bundle stamp cleared)' : ''),
  );
  if (records.length === 0) console.warn('WARNING: the catalogue is EMPTY — the app will list no bundled drivers.');
}

main();
