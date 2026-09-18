// Extract the exact set of failing/flaky tests from the telemetry event log,
// so we can re-run just those instead of the whole suite.
// Usage: node scripts/extract-failing-tests.mjs [path-to-events.jsonl]
//
// events.jsonl appends across runs, so for each (file, title) the LAST event wins —
// that reflects the most recent outcome for each test, not the union of all history.
//
// Outputs:
//   build/failing-tests.txt   human-readable listing
//   build/failing-tests.json  [{ file, tests: [{ leaf, full, status }] }] for the rerun runner
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const path = process.argv[2] ?? 'build/ui-telemetry/events.jsonl';
const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim());

// status per (file, title): last event wins
const results = new Map(); // key -> { file, title, status }

const keyOf = (file, title) => `${file}::${title}`;

for (const line of lines) {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    continue;
  }
  const file = ev.file ?? ev.specFile ?? ev.spec ?? ev.testFile;
  const title = ev.title ?? ev.testTitle ?? ev.test;
  const status = ev.status ?? ev.result ?? ev.outcome;
  if (!file || !title || !status) continue;
  const s = String(status).toLowerCase();
  if (!['passed', 'failed', 'flaky', 'timedout', 'timeout', 'interrupted', 'skipped'].includes(s)) continue;
  results.set(keyOf(String(file), String(title)), { file: String(file), title: String(title), status: s });
}

const bad = [...results.values()].filter((r) => r.status !== 'passed' && r.status !== 'skipped');

// Group by file; tests sorted by their order of appearance in the log.
const byFile = new Map();
for (const r of bad) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

let out = '';
const groups = [];
for (const [file, tests] of [...byFile.entries()].sort()) {
  out += `# ${file} (${tests.length})\n`;
  const leaves = [];
  for (const t of tests) {
    // title is the describe chain joined with ' > '; the leaf is what --grep should match on.
    const leaf = t.title.split(' > ').pop();
    leaves.push({ leaf, full: t.title, status: t.status });
    out += `  [${t.status}] ${t.title}\n`;
  }
  groups.push({ file, tests: leaves });
  out += '\n';
}

mkdirSync('build', { recursive: true });
writeFileSync('build/failing-tests.txt', out);
writeFileSync('build/failing-tests.json', JSON.stringify(groups, null, 2) + '\n');
console.log(`Total test events: ${results.size}, failing/flaky: ${bad.length}, files: ${byFile.size}`);
console.log('Wrote build/failing-tests.txt and build/failing-tests.json');
