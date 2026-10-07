/**
 * rerun.mjs — run a full suite once; if a few spec files fail, rerun only those files once.
 *
 *   node scripts/slow-run/rerun.mjs vitest [targets...]   unit suite (targets as for vitest run)
 *   node scripts/slow-run/rerun.mjs playwright            browser suite, via scripts/test-browser.sh
 *
 * Run from the root of a slow run's clean copy (scripts/slow-run.sh does this).
 *
 * The rule (John, 2026-10-07):
 *   - all pass first time                  -> pass
 *   - 1..MAX_RERUN_FILES spec files fail   -> rerun just those files, once, in the same copy
 *       - all pass on the rerun            -> pass, and each file is logged as FLAKY
 *       - any still fail                   -> fail, naming them
 *   - more than MAX_RERUN_FILES fail       -> fail at once: a broad failure, not flakiness
 *   - the run fails but names no spec file (a crash, a global setup error, no report) -> fail
 *
 * FLAKY lines go to stdout and are appended to build/test-logs/flaky.log, which the clean copy
 * links to the main checkout's build/test-logs, so repeat offenders accumulate there.
 *
 * The decision functions are pure (report in, verdict out) so a test can feed them a fake report.
 */
import {spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {relative, resolve} from 'node:path';

export const MAX_RERUN_FILES = 10;

/** Playwright's testDir, relative to the repo root (playwright.config.js). */
export const PLAYWRIGHT_TEST_DIR = 'packages/ui/test';

/**
 * Spec files that failed in a vitest JSON report, relative to `root`.
 * @param {{ testResults: { name: string; status: string }[] }} report
 * @param {string} root
 * @returns {string[]}
 */
export function failingVitestFiles(report, root) {
  return report.testResults
    .filter(r => r.status === 'failed')
    .map(r => relative(root, r.name))
    .sort();
}

/**
 * @typedef {{ ok: boolean }} PwSpec
 * @typedef {{ file: string; specs: PwSpec[]; suites: PwSuite[] }} PwSuite
 */

/**
 * Spec files with any failed test in a playwright JSON report, relative to the repo root.
 * A test that failed and then passed on playwright's own retry has ok=true and is not counted.
 * @param {{ suites: PwSuite[] }} report
 * @returns {string[]}
 */
export function failingPlaywrightFiles(report) {
  /** @param {PwSuite} suite @returns {boolean} */
  const failed = suite => suite.specs.some(s => !s.ok) || suite.suites.some(failed);
  const files = new Set(report.suites.filter(failed).map(s => `${PLAYWRIGHT_TEST_DIR}/${s.file}`));
  return [...files].sort();
}

/**
 * @typedef {{ kind: 'passed' }
 *   | { kind: 'rerun'; files: string[] }
 *   | { kind: 'failed'; reason: 'broad' | 'unattributed'; files: string[] }} FirstVerdict
 */

/**
 * What to do after the first full run.
 * @param {number} exitCode
 * @param {string[]} failingFiles
 * @param {number} [maxFiles]
 * @returns {FirstVerdict}
 */
export function firstRunVerdict(exitCode, failingFiles, maxFiles = MAX_RERUN_FILES) {
  if (exitCode === 0) return { kind: 'passed' };
  if (failingFiles.length === 0) return { kind: 'failed', reason: 'unattributed', files: [] };
  if (failingFiles.length > maxFiles) return { kind: 'failed', reason: 'broad', files: failingFiles };
  return { kind: 'rerun', files: failingFiles };
}

/**
 * @typedef {{ kind: 'flaky'; files: string[] } | { kind: 'failed'; files: string[] }} RerunVerdict
 */

/**
 * What the one rerun of `files` decided. A rerun that fails without naming a file keeps every
 * rerun file as failing: nothing shows any of them passed.
 * @param {string[]} files
 * @param {number} exitCode
 * @param {string[]} stillFailing
 * @returns {RerunVerdict}
 */
export function rerunVerdict(files, exitCode, stillFailing) {
  if (exitCode === 0) return { kind: 'flaky', files };
  return { kind: 'failed', files: stillFailing.length > 0 ? stillFailing : files };
}

/**
 * One flaky.log line per file.
 * @param {string} runner
 * @param {string[]} files
 * @param {string} when
 * @param {string} context
 * @returns {string[]}
 */
export function flakyLines(runner, files, when, context) {
  return files.map(f => `${when} FLAKY ${runner} ${f}${context ? ` (${context})` : ''}`);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────

const VITEST_JSON = 'build/slow-run/vitest.json';
const PW_JSON = 'build/pw-report.json';

/** @param {string[]} cmd @param {Record<string, string>} [env] @returns {number} */
function run(cmd, env = {}) {
  console.log(`[slow-run] ${cmd.join(' ')}`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status ?? 1;
}

/** @param {string} path @returns {unknown} */
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * A vitest JSON report, or null when `v` is not one (missing, truncated, another shape).
 * @param {unknown} v
 * @returns {{ testResults: { name: string; status: string }[] } | null}
 */
export function parseVitestReport(v) {
  if (typeof v !== 'object' || v === null || !('testResults' in v) || !Array.isArray(v.testResults)) return null;
  const testResults = v.testResults.flatMap(/** @param {unknown} r */ r =>
    typeof r === 'object' && r !== null && 'name' in r && 'status' in r && typeof r.name === 'string' && typeof r.status === 'string'
      ? [{ name: r.name, status: r.status }] : []);
  return { testResults };
}

/**
 * A playwright JSON report's suites, or null when `v` is not one.
 * @param {unknown} v
 * @returns {{ suites: PwSuite[] } | null}
 */
export function parsePlaywrightReport(v) {
  /** @param {unknown} x @returns {PwSuite | null} */
  const suite = x => {
    if (typeof x !== 'object' || x === null || !('file' in x) || typeof x.file !== 'string') return null;
    const specs = 'specs' in x && Array.isArray(x.specs)
      ? x.specs.flatMap(/** @param {unknown} sp */ sp => typeof sp === 'object' && sp !== null && 'ok' in sp && typeof sp.ok === 'boolean' ? [{ ok: sp.ok }] : [])
      : [];
    const suites = 'suites' in x && Array.isArray(x.suites) ? x.suites.flatMap(/** @param {unknown} c */ c => suite(c) ?? []) : [];
    return { file: x.file, specs, suites };
  };
  if (typeof v !== 'object' || v === null || !('suites' in v) || !Array.isArray(v.suites)) return null;
  return { suites: v.suites.flatMap(/** @param {unknown} x */ x => suite(x) ?? []) };
}

/** @param {string[]} targets @returns {{ exit: number; failing: string[] }} */
function runVitest(targets) {
  mkdirSync('build/slow-run', { recursive: true });
  rmSync(VITEST_JSON, { force: true });
  const workers = process.env.OPENISD_HEAVY_GATE_WORKERS ? [`--maxWorkers=${process.env.OPENISD_HEAVY_GATE_WORKERS}`] : [];
  const heavy = process.env.HEAVY ? [process.env.HEAVY] : [];
  const exit = run([...heavy, 'bash', 'scripts/quiet-test.sh', 'npx', 'vitest', 'run', ...targets, ...workers,
    '--reporter=dot', '--reporter=json', `--outputFile.json=${VITEST_JSON}`], { OPENISD_FULL_GATE: '1' });
  const report = parseVitestReport(readJson(VITEST_JSON));
  return { exit, failing: report ? failingVitestFiles(report, resolve('.')) : [] };
}

/** @param {string[]} targets @returns {{ exit: number; failing: string[] }} */
function runPlaywright(targets) {
  rmSync(PW_JSON, { force: true });
  // OPENISD_NO_INNER_RETRY: test-browser.sh's own --last-failed retries would hide the flakiness
  // this script logs; here the one rerun below is the retry.
  const exit = run(['bash', 'scripts/quiet-test.sh', 'bash', 'scripts/test-browser.sh', ...targets],
    { OPENISD_NO_INNER_RETRY: '1' });
  const report = parsePlaywrightReport(readJson(PW_JSON));
  return { exit, failing: report ? failingPlaywrightFiles(report) : [] };
}

function main() {
  const [runner, ...targets] = process.argv.slice(2);
  if (runner !== 'vitest' && runner !== 'playwright') {
    console.error('usage: rerun.mjs vitest [targets...] | rerun.mjs playwright');
    return 2;
  }
  const once = runner === 'vitest' ? runVitest : runPlaywright;
  const first = once(targets);
  const verdict = firstRunVerdict(first.exit, first.failing);
  switch (verdict.kind) {
    case 'passed':
      return 0;
    case 'failed':
      if (verdict.reason === 'broad') {
        console.log(`[slow-run] FAILED: ${verdict.files.length} ${runner} spec files failed (over ${MAX_RERUN_FILES}: a broad failure, not rerun)`);
      } else {
        console.log(`[slow-run] FAILED: the ${runner} run failed (exit ${first.exit}) without naming a failing spec file`);
      }
      for (const f of verdict.files) console.log(`  ${f}`);
      return first.exit || 1;
    case 'rerun': {
      console.log(`[slow-run] ${verdict.files.length} ${runner} spec file(s) failed; rerunning them once:`);
      for (const f of verdict.files) console.log(`  ${f}`);
      const second = once(verdict.files);
      const settled = rerunVerdict(verdict.files, second.exit, second.failing);
      if (settled.kind === 'flaky') {
        const lines = flakyLines(runner, settled.files, new Date().toISOString(), process.env.SLOW_RUN_LABEL ?? '');
        for (const l of lines) console.log(l);
        mkdirSync('build/test-logs', { recursive: true });
        appendFileSync('build/test-logs/flaky.log', lines.join('\n') + '\n');
        return 0;
      }
      console.log(`[slow-run] FAILED: still failing after one rerun:`);
      for (const f of settled.files) console.log(`  ${f}`);
      return second.exit || 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
