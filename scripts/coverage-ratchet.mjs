#!/usr/bin/env node
// The coverage ratchet for packages/ui (T620). Compares a vitest json-summary report with the committed baseline.
//
//   node scripts/coverage-ratchet.mjs <summary.json> <baseline.json> [--init]
//
// Baseline: { "<repo-relative src file>": {lines, branches, functions, statements} } as integers, rounded DOWN.
// Rules (exit 1 and every failure printed when any breaks):
//   1. a file in the report but not in the baseline must be 100 on all four measures;
//   2. a file in the baseline may not drop below its recorded numbers;
//   3. a baseline entry whose file is not in the report is red ("baseline entry without a file");
//   4. the committed baseline may not be lower than origin/main's, for any file and measure
//      (skipped when origin/main has no baseline yet);
//   5. green and any file above its baseline: the baseline is rewritten upward and the run says so.
// --init writes the baseline from the report and exits; it is run by hand once, never by scripts/coverage-ui.sh.
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';

const MEASURES = ['lines', 'branches', 'functions', 'statements'];
const args = process.argv.slice(2);
const init = args.includes('--init');
const [summaryPath, baselinePath] = args.filter((a) => !a.startsWith('--'));
if (!summaryPath || !baselinePath) {
  console.error('usage: coverage-ratchet.mjs <summary.json> <baseline.json> [--init]');
  process.exit(2);
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const baselineAbs = resolve(baselinePath);
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: dirname(baselineAbs), encoding: 'utf8'}).trim();

/** Floor of a percentage, as an integer (a 100 % file with no measurable items reports 100). */
const floorPct = (m) => Math.floor(typeof m.pct === 'number' ? m.pct : 100);

const measured = {};
for (const [file, entry] of Object.entries(summary)) {
  if (file === 'total') continue;
  const key = relative(repoRoot, resolve(file)).split('\\').join('/');
  measured[key] = Object.fromEntries(MEASURES.map((m) => [m, floorPct(entry[m])]));
}

const write = (obj) => {
  const sorted = Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
  writeFileSync(baselineAbs, JSON.stringify(sorted, null, 2) + '\n');
};

if (init) {
  write(measured);
  console.log(`coverage-ratchet: baseline written for ${Object.keys(measured).length} files`);
  process.exit(0);
}

const baseline = existsSync(baselineAbs) ? JSON.parse(readFileSync(baselineAbs, 'utf8')) : {};
const failures = [];
const baselineKey = relative(repoRoot, baselineAbs).split('\\').join('/');

for (const [file, now] of Object.entries(measured)) {
  const base = baseline[file];
  if (!base) {
    for (const m of MEASURES) if (now[m] < 100) failures.push(`${file}: new file, ${m} ${now[m]} < 100`);
    continue;
  }
  for (const m of MEASURES) if (now[m] < base[m]) failures.push(`${file}: ${m} ${now[m]} < baseline ${base[m]}`);
}
for (const file of Object.keys(baseline)) {
  if (!(file in measured)) failures.push(`${file}: baseline entry without a file`);
}

/** Whether a git command succeeds, its output dropped. */
const gitOk = (...a) => {
  try { execFileSync('git', a, {cwd: repoRoot, stdio: 'ignore'}); return true; } catch { return false; }
};
// Rule 4 needs origin/main: a missing ref is red, never a silent skip (a shallow CI checkout has no origin/main
// unless the job fetches it). Only a main that has no baseline file yet skips the rule.
let mainBaseline = null;
if (!gitOk('rev-parse', '--verify', '--quiet', 'origin/main^{commit}')) {
  failures.push('origin/main is not available, so the baseline cannot be checked against it: fetch origin main first');
} else if (gitOk('cat-file', '-e', `origin/main:${baselineKey}`)) {
  mainBaseline = JSON.parse(execFileSync('git', ['show', `origin/main:${baselineKey}`], {cwd: repoRoot, encoding: 'utf8'}));
}
if (mainBaseline) {
  for (const [file, main] of Object.entries(mainBaseline)) {
    const mine = baseline[file];
    if (!mine) continue;
    for (const m of MEASURES) if (mine[m] < main[m]) failures.push(`${file}: committed baseline ${m} ${mine[m]} < origin/main ${main[m]}`);
  }
}

if (failures.length > 0) {
  console.error(`coverage-ratchet: RED, ${failures.length} problems`);
  for (const f of failures) console.error(`ERROR ${f}`);
  process.exit(1);
}

let moved = 0;
const next = {};
for (const [file, now] of Object.entries(measured)) {
  const base = baseline[file];
  if (!base || MEASURES.some((m) => now[m] > base[m])) moved++;
  next[file] = now;
}
if (moved > 0) {
  write(next);
  console.log(`coverage-ratchet: baseline moved up for ${moved} files`);
} else {
  console.log('coverage-ratchet: green, baseline unchanged');
}
