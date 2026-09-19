#!/usr/bin/env node
/**
 * test-bundle.mjs — write the browser suite's driver catalogue.
 *
 *   node scripts/test-bundle.mjs <out-dir>
 *
 * Reads the tracked production indexes and record files (packages/ui/public/), keeps the records
 * named in packages/ui/test/fixtures/test-bundle-paths.json (scripts/testBundle.mjs), and writes
 * <out-dir>/{drivers-index.json, passive-radiators-index.json, drivers/<path>.json}.
 * playwright.config.js runs this before starting its vite and points that vite at <out-dir> via
 * OPENISD_DRIVERS_BUNDLE_DIR — see vite.config.js `serveCatalogue`.
 */
import {copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectCatalogue} from './testBundle.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PUBLIC = join(ROOT, 'packages', 'ui', 'public');
const PATHS_FILE = join(ROOT, 'packages', 'ui', 'test', 'fixtures', 'test-bundle-paths.json');

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/test-bundle.mjs <out-dir>');
  process.exit(2);
}

const driverRows = JSON.parse(readFileSync(join(PUBLIC, 'drivers-index.json'), 'utf8'));
const radiatorRows = JSON.parse(readFileSync(join(PUBLIC, 'passive-radiators-index.json'), 'utf8'));
const paths = JSON.parse(readFileSync(PATHS_FILE, 'utf8'));
const selected = selectCatalogue(driverRows, radiatorRows, paths);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'drivers-index.json'), JSON.stringify(selected.driverRows));
writeFileSync(join(outDir, 'passive-radiators-index.json'), JSON.stringify(selected.radiatorRows));
for (const row of [...selected.driverRows, ...selected.radiatorRows]) {
  const dest = join(outDir, 'drivers', `${row.path}.json`);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(PUBLIC, 'drivers', `${row.path}.json`), dest);
}
console.log(`test bundle: ${selected.driverRows.length} drivers + ${selected.radiatorRows.length} passive radiators → ${outDir}`);
