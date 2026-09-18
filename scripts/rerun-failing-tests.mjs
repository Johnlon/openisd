// Re-run ONLY the tests that failed in the telemetry run, to widdle them down.
//
//   node scripts/rerun-failing-tests.mjs              # all files in build/failing-tests.json
//   node scripts/rerun-failing-tests.mjs <file>...    # subset (paths as in failing-tests.json)
//
// For each spec file: npx playwright test <file> --grep "<leaf1|leaf2>" --workers=1 --retries=0
// Sequential, one honest attempt per test (mirrors run-ui-telemetry.sh's protocol), so results
// are comparable to the telemetry numbers.
//
// NO SHELL in the invocation: failing-test titles contain |, quotes and apostrophes, so any
// shell layer would either split the grep or need quoting we'd get wrong. Spawning
// node @playwright/test/cli.js directly passes argv verbatim.
//
// build/pw-report.json (written by the config's json reporter) is DELETED before each file's
// run and only parsed if the run recreated it — a stale report once made this script attribute
// one spec's results to another. A test that matched no grep (title changed since the
// telemetry run) is reported as "no-match", not silently ignored.
//
// Output: build/rerun-results.json  [{ file, grep, exitCode, report: bool,
//           passed: [leaf], failed: [{leaf,status}], noMatch: [leaf] }]
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const groupsAll = JSON.parse(readFileSync('build/failing-tests.json', 'utf8'));
const wanted = process.argv.slice(2);
const groups = wanted.length ? groupsAll.filter((g) => wanted.includes(g.file)) : groupsAll;
if (wanted.length && groups.length !== wanted.length) {
  console.error('Some requested files are not in build/failing-tests.json:');
  for (const w of wanted) if (!groupsAll.some((g) => g.file === w)) console.error('  ' + w);
  process.exit(1);
}

// Keep clear of concurrent runs the way test-browser.sh does; direct npx invocations fall back
// to playwright.config.js's own uncoordinated defaults, so pick the port explicitly here.
const PORT = process.env.OPENISD_TEST_PORT || '4106';
const CLI = 'node_modules/@playwright/test/cli.js';

function collectSpec(spec, buckets) {
  for (const t of spec.tests ?? []) {
    const status = t.results?.[t.results.length - 1]?.status;
    if (status === 'passed') buckets.passed.push(spec.title);
    else buckets.failed.push({ leaf: spec.title, status: status ?? 'unknown' });
  }
  for (const s of spec.specs ?? []) collectSpec(s, buckets);
}

function parseReport() {
  const report = JSON.parse(readFileSync('build/pw-report.json', 'utf8'));
  const buckets = { passed: [], failed: [] };
  const walk = (suite) => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? []) collectSpec(spec, buckets);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return buckets;
}

function runOne(group) {
  // Titles are matched LITERALLY: leaves contain (), [] and quotes that are regex
  // metacharacters, and an unescaped pattern silently no-matches its own test.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const grep = group.tests.map((t) => esc(t.leaf)).join('|');
  const args = ['playwright', 'test', group.file, '--grep', grep, '--workers=1', '--retries=0'];
  console.log(`\n=== ${group.file} (${group.tests.length} tests) ===`);
  rmSync('build/pw-report.json', { force: true });
  let exitCode = 0;
  try {
    execFileSync(process.execPath, [CLI, ...args.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, OPENISD_TEST_PORT: PORT },
    });
  } catch (e) {
    exitCode = e.status ?? 1;
  }
  const buckets = { passed: [], failed: [] };
  let reportOk = false;
  if (existsSync('build/pw-report.json')) {
    try {
      Object.assign(buckets, parseReport());
      reportOk = true;
    } catch (e) {
      console.error(`  (could not parse pw-report.json: ${e.message})`);
    }
  }
  const seen = new Set([...buckets.passed, ...buckets.failed.map((f) => f.leaf)]);
  const noMatch = group.tests.map((t) => t.leaf).filter((leaf) => !seen.has(leaf));
  return { file: group.file, grep, exitCode, report: reportOk, passed: buckets.passed, failed: buckets.failed, noMatch };
}

const results = [];
for (const group of groups) results.push(runOne(group));

// Cumulative: merge this invocation's per-file results into build/rerun-results.json, new
// replacing old, so chunked runs accumulate instead of clobbering each other.
let merged = results;
try {
  const prior = JSON.parse(readFileSync('build/rerun-results.json', 'utf8'));
  if (Array.isArray(prior)) {
    const byFile = new Map(prior.map((r) => [r.file, r]));
    for (const r of results) byFile.set(r.file, r);
    merged = [...byFile.values()];
  }
} catch { /* no prior file — first run */ }
writeFileSync('build/rerun-results.json', JSON.stringify(merged, null, 2) + '\n');

console.log('\n===== SUMMARY =====');
let passTotal = 0;
let failTotal = 0;
let nmTotal = 0;
for (const r of results) {
  passTotal += r.passed.length;
  failTotal += r.failed.length;
  nmTotal += r.noMatch.length;
  console.log(`${r.file}: ${r.passed.length} passed, ${r.failed.length} still failing` + (r.noMatch.length ? `, ${r.noMatch.length} no-match` : '') + ` (exit ${r.exitCode}${r.report ? '' : ', NO REPORT'})`);
  for (const f of r.failed) console.log(`   [${f.status}] ${f.leaf}`);
  for (const leaf of r.noMatch) console.log(`   [no-match] ${leaf}`);
}
console.log(`\nTOTAL: ${passTotal} now passing, ${failTotal} still failing, ${nmTotal} no-match`);
console.log('Wrote build/rerun-results.json');
