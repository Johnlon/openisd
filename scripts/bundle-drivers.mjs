#!/usr/bin/env node
/**
 * bundle-drivers.mjs — writes the bundled driver catalogue the app serves and fetches.
 *
 *   npx vite-node scripts/bundle-drivers.mjs [--force]
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
 * Bundling gate: structural readability only (`isBundlable`, John's QO79/QO81 ruling — no record
 * is excluded for missing spec params). A record with no `specs` container is skipped and listed.
 *
 * Skips the walk when nothing has changed: the fingerprint of every corpus record plus every
 * source file that shapes a row or record is kept in build/drivers-bundle.stamp and compared
 * first (scripts/bundleStamp.mjs; scripts/bundle-drivers-if-changed.mjs does the same check
 * under plain node, which is what predev/prebuild call). `--force` rebuilds regardless.
 *
 * Runs under vite-node (predev/prebuild) because the packages export TypeScript source.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { project, isBundlable } from './bundleProjection.mjs';
import { checkOpenisdRoundTrip } from './roundTripGate.mjs';
import { CORPUS_RELATIVE, STAMP, walkFiles, bundleFingerprintOnDisk, bundleOutputsPresent, readStamp } from './bundleStamp.mjs';
import { WDR_TO_SCHEMA_KEY } from '../packages/design/domain/openisdSchema.js';
import { bundledDriverIndexRowOf, bundledPassiveRadiatorIndexRowOf } from '../packages/ui/src/logic/bundledIndexRows.js';
import { OpenISDPassiveRadiatorStandalone } from '@openisd/design';

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
 *
 * The corpus's `openisd.yml` files are emitted with the WinISD short names (`Fs`, `Re`, `Sd`, …),
 * while the spec sections are declared with the suffixed names (`Fs_hz`, `Re_ohm`, `Sd_m2`, …)
 * and the strict schema refuses the short ones. The same mapping every other boundary applies —
 * `driverYmlToOpenisdAndWdr.ts` and the `.wdr` import — is applied here so the written record
 * conforms to the schema the app reads it back with.
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
  let recordFiles;
  try { recordFiles = walkRecords(CORPUS); }
  catch { throw new Error(`driver source path is not checked out: ${CORPUS}`); }
  console.log(`  found ${recordFiles.length} ${RECORD_FILE} files`);

  const fingerprint = bundleFingerprintOnDisk(ROOT);
  if (!force && bundleOutputsPresent(ROOT) && readStamp(ROOT) === fingerprint) {
    console.log(`  unchanged since the last run (build/drivers-bundle.stamp) — nothing rewritten; --force to rebuild`);
    return;
  }

  const driverRows = [];
  const radiatorRows = [];
  const records = [];                  // { path, record } to write under drivers/
  const skipped = [];
  const perGroup = new Map();          // top path segment (the brand) → kept count
  const roundTripFailures = [];        // every written record must survive the app's own open/serialise unaltered
  let done = 0;

  for (const file of recordFiles) {
    const path = recordPathOf(CORPUS, file);
    const group = path.split('/')[0];
    const parsed = parseYaml(readFileSync(file, 'utf8'));
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
        if (device instanceof OpenISDPassiveRadiatorStandalone) {
          radiatorRows.push(bundledPassiveRadiatorIndexRowOf(device, path));
        } else {
          driverRows.push(bundledDriverIndexRowOf(device, path));
        }
        records.push({ path, record });
        perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
      }
    }

    if (++done % 250 === 0 || done === recordFiles.length) {
      console.log(`  ${String(done).padStart(5)}/${recordFiles.length} opened — ${records.length} usable, ${skipped.length} unusable`);
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
    console.log(`  ${skipped.length} records are NOT bundled (structurally unreadable — no \`specs\` container), first 5:`);
    for (const p of skipped.slice(0, 5)) console.log(`    - ${p}`);
  }

  // Records: the directory is rebuilt from scratch so a record that left the corpus leaves the app.
  rmSync(RECORDS_DIR, { recursive: true, force: true });
  for (const { path, record } of records) {
    const out = join(RECORDS_DIR, `${path}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(record));
  }
  writeFileSync(DRIVER_INDEX, JSON.stringify(driverRows));
  writeFileSync(RADIATOR_INDEX, JSON.stringify(radiatorRows));
  mkdirSync(dirname(STAMP_FILE), { recursive: true });
  writeFileSync(STAMP_FILE, `${fingerprint}\n`);

  const kb = n => Math.round(n / 1024);
  console.log(
    `\n  → ${driverRows.length} drivers (drivers-index.json ${kb(statSync(DRIVER_INDEX).size)} KB), ` +
    `${radiatorRows.length} passive radiators (passive-radiators-index.json ${kb(statSync(RADIATOR_INDEX).size)} KB), ` +
    `${records.length} records under packages/ui/public/drivers/`,
  );
  if (records.length === 0) console.warn('WARNING: the catalogue is EMPTY — the app will list no bundled drivers.');
}

main();
