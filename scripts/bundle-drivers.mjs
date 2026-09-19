#!/usr/bin/env node
/**
 * bundle-drivers.mjs — writes the bundled driver catalogue the app serves and fetches.
 *
 *   npx tsx scripts/bundle-drivers.mjs [--force]
 *
 * Design: docs/design/BUNDLED_CATALOGUE_API.md. The corpus is the sibling
 * `winisd_drivers/db/datasheets` checkout; each `<brand>/<sku>/openisd.yml` is the canonical
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
 * Bundling gate: structural readability (`isBundlable`, John's QO79/QO81 ruling — no record
 * is excluded for missing spec params), EXCEPT devices with no woofer spec section —
 * those are sub-box builders, not usable drivers in the main collection.
 * A record with no `specs` container is skipped and listed.
 *
 * Skips the walk when nothing has changed: the fingerprint of every corpus record plus every
 * source file that shapes a row or record is kept in build/drivers-bundle.stamp and compared
 * first (scripts/bundleStamp.mjs; scripts/bundle-drivers-if-changed.mjs does the same check
 * under plain node, which is what predev/prebuild call). `--force` rebuilds regardless.
 *
 * Runs under tsx (predev/prebuild) because the packages export TypeScript source.
 */

import {mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'fs';
import {dirname, join, relative} from 'path';
import {fileURLToPath} from 'url';
import {parse as parseYaml} from 'yaml';
import {isBundlable, project} from './bundleProjection.mjs';
import {checkOpenisdRoundTrip} from './roundTripGate.mjs';
import {
    bundleFingerprintOnDisk,
    bundleOutputsPresent,
    CORPUS_RELATIVE,
    readStamp,
    STAMP,
    walkFiles
} from './bundleStamp.mjs';
import {WDR_TO_SCHEMA_KEY} from '../packages/design/domain/openisdSchema.ts';
import {bundledDriverIndexRowOf} from '../packages/ui/src/logic/bundledIndexRows.ts';

const RECORD_FILE = 'openisd.yml';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const CORPUS = join(ROOT, ...CORPUS_RELATIVE);
const PUBLIC = join(ROOT, 'packages', 'ui', 'public');
const DRIVER_INDEX = join(PUBLIC, 'drivers-index.json');
const RADIATOR_INDEX = join(PUBLIC, 'passive-radiators-index.json');
const RECORDS_DIR = join(PUBLIC, 'drivers');
const STAMP_FILE = join(ROOT, STAMP);

/**
 * Canonicalise a record's spec-section keys to the schema's unit-suffixed names.
 */
function canonicalizeSpecKeys(specs) {
  const sections = {};
  for (const [section, sectionValue] of Object.entries(specs)) {
    if (sectionValue === null || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
      sections[section] = sectionValue;
      continue;
    }
    const fields = {};
    for (const [field, entry] of Object.entries(sectionValue)) {
      fields[WDR_TO_SCHEMA_KEY[field] ?? field] = entry;
    }
    sections[section] = fields;
  }
  return sections;
}

function canonicalizeRecord(record) {
  if (record === null || typeof record !== 'object' || typeof record.specs !== 'object' || record.specs === null) {
    return record;
  }
  return { ...record, specs: canonicalizeSpecKeys(record.specs) };
}

function walkRecords(dir) {
  return walkFiles(dir, name => name.toLowerCase() === RECORD_FILE);
}

/** The record's identity and locator: `<brand>/<sku>` — the directory holding its openisd.yml. */
function recordPathOf(corpusRoot, file) {
  return relative(corpusRoot, dirname(file)).replace(/\\/g, '/');
}

function main() {
  const force = process.argv.includes('--force');

  console.log(`\nOpenISD\n  reading ${CORPUS}`);
  let rawFiles;
  try { rawFiles = walkRecords(CORPUS); }
  catch { throw new Error(`driver source path is not checked out: ${CORPUS}`); }
  console.log(`  found ${rawFiles.length} ${RECORD_FILE} files`);

  const fingerprint = bundleFingerprintOnDisk(ROOT);
  if (!force && bundleOutputsPresent(ROOT) && readStamp(ROOT) === fingerprint) {
    console.log(`  unchanged since the last run (build/drivers-bundle.stamp) — nothing rewritten; --force to rebuild`);
    return;
  }

  const driverRows = [];
  const records = [];
  const skipped = [];
  const perGroup = new Map();
  const roundTripFailures = [];

  for (const file of rawFiles) {
    const path = recordPathOf(CORPUS, file);
    const group = path.split('/')[0];
    const text = readFileSync(file, 'utf8');
    if (!text.includes('woofer')) {
      skipped.push(path);
      continue;
    }
    const parsed = parseYaml(text);
    if (parsed == null) throw new Error(`${path}: empty or unparseable record`);
    const record = canonicalizeRecord(parsed);

    const projected = project(record);

    if (!isBundlable(projected)) {
      skipped.push(path);
    } else {
      const gate = checkOpenisdRoundTrip(record, path);
      if (!gate.ok) {
        roundTripFailures.push(gate.message);
      } else {
        const device = gate.device;
        driverRows.push(bundledDriverIndexRowOf(device, path));
        records.push({ path, record });
        perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
      }
    }

    if (records.length % 250 === 0 || records.length === rawFiles.length - skipped.length) {
      console.log(`  ${String(records.length).padStart(5)}/${rawFiles.length} opened — ${records.length} usable, ${skipped.length} unusable`);
    }
  }

  if (roundTripFailures.length > 0) {
    throw new Error(
      `${roundTripFailures.length} openisd.yml round-trip failure(s) — ` +
      `the app's own loader/export path does not reproduce these records:\n` +
      roundTripFailures.map(m => `  - ${m}`).join('\n'),
    );
  }
  console.log(`  round-trip gate: ${records.length}/${records.length} records clean`);

  for (const [group, n] of [...perGroup].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${group.padEnd(24)} ${String(n).padStart(4)}`);
  }
  if (skipped.length) {
    console.log(`  ${skipped.length} records are NOT bundled (no woofer spec section), first 5:`);
    for (const p of skipped.slice(0, 5)) console.log(`    - ${p}`);
  }

  rmSync(RECORDS_DIR, { recursive: true, force: true });
  for (const { path, record } of records) {
    const out = join(RECORDS_DIR, `${path}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(record));
  }
  writeFileSync(DRIVER_INDEX, JSON.stringify(driverRows));
  writeFileSync(RADIATOR_INDEX, JSON.stringify([]));
  mkdirSync(dirname(STAMP_FILE), { recursive: true });
  writeFileSync(STAMP_FILE, `${fingerprint}\n`);

  const kb = n => Math.round(n / 1024);
  console.log(
    `\n  → ${driverRows.length} drivers (drivers-index.json ${kb(statSync(DRIVER_INDEX).size)} KB), ` +
    `0 passive radiators (passive-radiators-index.json 0 KB), ` +
    `${records.length} records under packages/ui/public/drivers/`,
  );
  if (records.length === 0) console.warn('WARNING: the catalogue is EMPTY — the app will list no bundled drivers.');
}

main();
