#!/usr/bin/env node
/**
 * shard-specs.mjs: the browser spec files of one shard, for the GitHub Actions suite.
 *
 *   node scripts/ci/shard-specs.mjs <shard> <shards>      prints that shard's files, one per line
 *   node scripts/ci/shard-specs.mjs --durations <dir>...  rewrites spec-durations.json from the shards'
 *                                                         report artifacts (build/pw-report-<n>.json)
 *
 * The files are the ones playwright.config.js runs (packages/ui/test/**\/*.browser.spec.ts, without the
 * external-network specs); the split is shardSpecs.mjs, by the times in scripts/ci/spec-durations.json.
 */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {durationsOf, shardSpecs} from '../shardSpecs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST_DIR = join(ROOT, 'packages', 'ui', 'test');
const DURATIONS = join(ROOT, 'scripts', 'ci', 'spec-durations.json');
const EXTERNAL = new Set(['ui/micka-crosscheck.browser.spec.ts']);

function specFiles() {
  return readdirSync(TEST_DIR, {recursive: true})
    .map(String)
    .filter(f => f.endsWith('.browser.spec.ts'))
    .map(f => relative(TEST_DIR, join(TEST_DIR, f)).split('\\').join('/'))
    .filter(f => !EXTERNAL.has(f))
    .sort();
}

function reportsIn(dirs) {
  return dirs.flatMap(dir => readdirSync(dir, {recursive: true}).map(String)
    .filter(f => /pw-report.*\.json$/.test(f))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

const [first, ...rest] = process.argv.slice(2);
if (first === '--durations') {
  if (rest.length === 0) { console.error('usage: shard-specs.mjs --durations <dir>...'); process.exit(2); }
  writeFileSync(DURATIONS, JSON.stringify(durationsOf(reportsIn(rest)), null, 1) + '\n');
} else {
  const shard = Number(first);
  const shards = Number(rest[0]);
  if (!Number.isInteger(shard) || !Number.isInteger(shards) || shard < 1 || shard > shards) {
    console.error('usage: shard-specs.mjs <shard> <shards>');
    process.exit(2);
  }
  const durations = JSON.parse(readFileSync(DURATIONS, 'utf8'));
  for (const file of shardSpecs(specFiles(), durations, shards)[shard - 1]) console.log(`packages/ui/test/${file}`);
}
