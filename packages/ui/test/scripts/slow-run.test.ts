/**
 * Slow runs (scripts/slow-run/; John, 2026-10-07):
 *   - queue.sh: one machine-wide FIFO queue — a second slow run waits, naming what it waits behind;
 *   - clean-copy.sh: a slow run tests the staged index or a commit in a copy outside the repo;
 *   - rerun.mjs: a few failing spec files are rerun once; pass on rerun = FLAKY, too many = fail.
 * Each queue/copy test works in its own temp directory, never the shared queue in /tmp.
 */
import {describe, it, onTestFinished} from 'vitest';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {failingPlaywrightFiles, failingVitestFiles, firstRunVerdict, flakyLines, parsePlaywrightReport, parseVitestReport, rerunVerdict} from '../../../../scripts/slow-run/rerun.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const QUEUE = join(ROOT, 'scripts', 'slow-run', 'queue.sh');
const CLEAN_COPY = join(ROOT, 'scripts', 'slow-run', 'clean-copy.sh');
const RERUN = join(ROOT, 'scripts', 'slow-run', 'rerun.mjs');

/** A temp directory removed when the current test finishes. */
function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'slow-run-test-')));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

interface Finished { readonly stdout: string; readonly stderr: string; readonly code: number | null }

function runSh(script: string, env: Record<string, string>): Promise<Finished> {
  return new Promise(done => {
    const child = spawn('sh', ['-c', script], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => { stdout += b.toString(); });
    child.stderr.on('data', (b: Buffer) => { stderr += b.toString(); });
    child.on('close', code => done({ stdout, stderr, code }));
  });
}

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/** A fake slow command: queue, append "<label> start" / "<label> end" to `events`, hold the queue `holdS` seconds. */
const fakeSlow = (label: string, holdS: number, events: string): string =>
  `. '${QUEUE}'; slow_queue_enter '${label}'; echo '${label} start' >> '${events}'; sleep ${holdS}; echo '${label} end' >> '${events}'; slow_queue_leave`;

describe('queue.sh — slow runs never overlap', () => {
  it('a second slow run waits until the first ends, and says what it waits behind', async () => {
    const dir = tempDir();
    const env = { SLOW_RUN_DIR: dir, SLOW_RUN_POLL_S: '0.1' };
    const events = join(dir, 'events');
    const first = runSh(fakeSlow('pre-push abc', 1, events), { ...env, SLOW_RUN_OWNER: 'session-one' });
    await sleep(300);
    const second = runSh(fakeSlow('health-check def', 0, events), { ...env, SLOW_RUN_OWNER: 'session-two' });
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.code, 0);
    assert.equal(b.code, 0);
    assert.deepEqual(readFileSync(events, 'utf8').trim().split('\n'),
      ['pre-push abc start', 'pre-push abc end', 'health-check def start', 'health-check def end']);
    assert.match(b.stderr, /waiting behind session-one: pre-push abc, running since \d{4}-\d\d-\d\d \d\d:\d\d:\d\d \(1 ahead\)/);
    assert.equal(b.stderr.trim().split('\n').length, 1, 'one waiting line, not one per poll');
    assert.equal(a.stderr, '', 'the first run did not wait');
  });

  it('a ticket whose process is gone is reaped, not waited for', async () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'q'));
    writeFileSync(join(dir, 'q', '000000000001'), 'pid=999999999\npstart=1\nowner=dead\ncmd=crashed run\n');
    const r = await runSh(fakeSlow('next', 0, join(dir, 'events')), { SLOW_RUN_DIR: dir, SLOW_RUN_POLL_S: '0.1' });
    assert.equal(r.code, 0);
    assert.equal(r.stderr, '');
    assert.equal(existsSync(join(dir, 'q', '000000000001')), false);
  });

  it('a slow run started under one that holds the queue passes straight through', async () => {
    const dir = tempDir();
    const inner = `sh -c ". '${QUEUE}'; slow_queue_enter inner; echo inner-ran; slow_queue_leave"`;
    const r = await runSh(`. '${QUEUE}'; slow_queue_enter outer; ${inner}; ls "$SLOW_RUN_DIR/q" | wc -l; slow_queue_leave`,
      { SLOW_RUN_DIR: dir, SLOW_RUN_POLL_S: '0.1' });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /inner-ran\n1\n/);
    assert.equal(r.stderr, '');
  });
});

/** The test's environment without GIT_* variables: under the pre-commit hook they point at the real repo. */
const NO_GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: NO_GIT_ENV });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

interface FixtureRepo { readonly base: string; readonly repo: string; readonly sha: string }

/** A repo with one commit, then a staged edit, an unstaged edit on top, and an untracked file. */
function fixtureRepo(): FixtureRepo {
  const base = tempDir();
  const repo = join(base, 'openisd');
  mkdirSync(join(repo, 'node_modules', 'dep'), { recursive: true });
  mkdirSync(join(repo, 'node_modules', '.vite'));
  mkdirSync(join(repo, 'node_modules', '@openisd'));
  mkdirSync(join(repo, 'packages', 'design'), { recursive: true });
  mkdirSync(join(base, 'winisd_drivers'));
  writeFileSync(join(repo, 'node_modules', 'dep', 'index.js'), 'dep\n');
  writeFileSync(join(repo, 'node_modules', '.vite', 'cache.json'), '{}\n');
  symlinkSync('../../packages/design', join(repo, 'node_modules', '@openisd', 'design'));
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  writeFileSync(join(repo, 'packages', 'design', 'a.ts'), 'committed\n');
  spawnSync('git', ['init', '-q', repo], { env: NO_GIT_ENV });
  // The fixture's bytes must round-trip exactly, whatever the user's global core.autocrlf says.
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
  const sha = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(repo, 'packages', 'design', 'a.ts'), 'staged\n');
  git(repo, 'add', 'packages/design/a.ts');
  writeFileSync(join(repo, 'packages', 'design', 'a.ts'), 'unstaged edit by another session\n');
  writeFileSync(join(repo, 'packages', 'design', 'untracked.ts'), 'x\n');
  return { base, repo, sha };
}

function cleanCopy(call: string): string {
  const r = spawnSync('bash', ['-c', `. '${CLEAN_COPY}'; set -e; ${call}`], { encoding: 'utf8', env: NO_GIT_ENV });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

describe('clean-copy.sh — a slow run tests a clean copy, not the live tree', () => {
  it('pre-commit: the copy holds the staged index — no unstaged edit, no untracked file', () => {
    const {base, repo} = fixtureRepo();
    const dest = cleanCopy(`d=$(clean_copy_new_dest '${repo}'); clean_copy_from_index '${repo}' "$d"; echo "$d"`);
    assert.ok(dest.startsWith(join(base, '.slowrun') + '/'), dest);
    assert.equal(readFileSync(join(dest, 'packages', 'design', 'a.ts'), 'utf8'), 'staged\n');
    assert.equal(existsSync(join(dest, 'packages', 'design', 'untracked.ts')), false);
    // node_modules: hardlinked, caches left out, workspace links resolve inside the copy.
    assert.equal(statSync(join(dest, 'node_modules', 'dep', 'index.js')).ino, statSync(join(repo, 'node_modules', 'dep', 'index.js')).ino);
    assert.equal(existsSync(join(dest, 'node_modules', '.vite')), false);
    assert.equal(realpathSync(join(dest, 'node_modules', '@openisd', 'design')), join(dest, 'packages', 'design'));
    // Sibling checkout reachable as <root>/../winisd_drivers; logs land in the main checkout.
    assert.equal(realpathSync(join(dest, '..', 'winisd_drivers')), join(base, 'winisd_drivers'));
    assert.equal(readlinkSync(join(dest, 'build', 'test-logs')), join(repo, 'build', 'test-logs'));

    cleanCopy(`clean_copy_remove '${repo}' '${dest}'`);
    assert.equal(existsSync(dest), false);
    assert.equal(readFileSync(join(repo, 'node_modules', 'dep', 'index.js'), 'utf8'), 'dep\n');
    assert.equal(existsSync(join(repo, 'build', 'test-logs')), true);
  });

  it('pre-push / health-check: the copy is the commit as a worktree, removed afterwards', () => {
    const {repo, sha} = fixtureRepo();
    const dest = cleanCopy(`d=$(clean_copy_new_dest '${repo}'); clean_copy_from_commit '${repo}' '${sha}' "$d"; echo "$d"`);
    assert.equal(readFileSync(join(dest, 'packages', 'design', 'a.ts'), 'utf8'), 'committed\n');
    assert.equal(git(dest, 'rev-parse', 'HEAD'), sha);
    cleanCopy(`clean_copy_remove '${repo}' '${dest}'`);
    assert.equal(existsSync(dest), false);
    assert.doesNotMatch(git(repo, 'worktree', 'list'), /\.slowrun/);
    assert.equal(readFileSync(join(repo, 'packages', 'design', 'a.ts'), 'utf8'), 'unstaged edit by another session\n');
  });
});

describe('rerun.mjs — rerun a few failing spec files once', () => {
  const files = (n: number): string[] => Array.from({ length: n }, (_, i) => `packages/x/t${i}.test.ts`);

  it('a green run passes without a rerun', () => {
    assert.deepEqual(firstRunVerdict(0, []), { kind: 'passed' });
  });

  it('up to 10 failing files are rerun', () => {
    assert.deepEqual(firstRunVerdict(1, files(2)), { kind: 'rerun', files: files(2) });
    assert.deepEqual(firstRunVerdict(1, files(10)), { kind: 'rerun', files: files(10) });
  });

  it('more than 10 failing files fail at once, as a broad failure', () => {
    assert.deepEqual(firstRunVerdict(1, files(11)), { kind: 'failed', reason: 'broad', files: files(11) });
  });

  it('a failed run that names no spec file fails, unattributed', () => {
    assert.deepEqual(firstRunVerdict(1, []), { kind: 'failed', reason: 'unattributed', files: [] });
  });

  it('all pass on the rerun: flaky; still failing: failed, naming them', () => {
    assert.deepEqual(rerunVerdict(files(2), 0, []), { kind: 'flaky', files: files(2) });
    assert.deepEqual(rerunVerdict(files(2), 1, files(1)), { kind: 'failed', files: files(1) });
    assert.deepEqual(rerunVerdict(files(2), 1, []), { kind: 'failed', files: files(2) });
  });

  it('flaky.log gets one line per spec file', () => {
    assert.deepEqual(flakyLines('vitest', files(2), 'T', 'pre-push abc'), [
      'T FLAKY vitest packages/x/t0.test.ts (pre-push abc)',
      'T FLAKY vitest packages/x/t1.test.ts (pre-push abc)',
    ]);
  });

  it('a missing or malformed report reads as no report', () => {
    assert.equal(parseVitestReport(null), null);
    assert.equal(parseVitestReport({ numTotalTests: 3 }), null);
    assert.equal(parsePlaywrightReport('truncated'), null);
  });

  it('reads the failing files from a vitest JSON report', () => {
    const report = parseVitestReport({ testResults: [
      { name: '/copy/packages/a.test.ts', status: 'passed' },
      { name: '/copy/packages/b.test.ts', status: 'failed' },
    ] });
    assert.ok(report);
    assert.deepEqual(failingVitestFiles(report, '/copy'), ['packages/b.test.ts']);
  });

  it('reads the failing files from a playwright JSON report, nested suites included', () => {
    const report = parsePlaywrightReport({ suites: [
      { file: 'ui/a.browser.spec.ts', specs: [{ ok: true }] },
      { file: 'ui/b.browser.spec.ts', specs: [{ ok: true }], suites: [{ file: 'ui/b.browser.spec.ts', specs: [{ ok: false }] }] },
    ] });
    assert.ok(report);
    assert.deepEqual(failingPlaywrightFiles(report), ['packages/ui/test/ui/b.browser.spec.ts']);
  });
});

/**
 * A fake copy whose scripts/quiet-test.sh stands in for vitest: it logs its arguments, writes a
 * JSON report failing `b.test.ts` on the first call and passing it on the second (or always, when
 * `alwaysFail`), and exits to match.
 */
function fakeVitestCopy(alwaysFail: boolean): string {
  const dir = tempDir();
  mkdirSync(join(dir, 'scripts'));
  writeFileSync(join(dir, 'scripts', 'quiet-test.sh'), `
n=$(( $(cat calls 2>/dev/null || echo 0) + 1 )); echo $n > calls
echo "$*" >> args.log
out=$(printf '%s\n' "$@" | sed -n 's/^--outputFile.json=//p')
if [ $n = 1 ] || [ ${alwaysFail ? 1 : 0} = 1 ]; then
  echo '{"testResults":[{"name":"'$PWD'/a.test.ts","status":"passed"},{"name":"'$PWD'/b.test.ts","status":"failed"}]}' > "$out"; exit 1
fi
echo '{"testResults":[{"name":"'$PWD'/b.test.ts","status":"passed"}]}' > "$out"; exit 0
`);
  return dir;
}

describe('rerun.mjs CLI — the one rerun, end to end on a fake runner', () => {
  it('a file that fails then passes on the rerun passes the run and is logged FLAKY', () => {
    const dir = fakeVitestCopy(false);
    const r = spawnSync('node', [RERUN, 'vitest', 'packages'], { cwd: dir, encoding: 'utf8', env: { ...process.env, HEAVY: '', SLOW_RUN_LABEL: 'pre-push abc' } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const calls = readFileSync(join(dir, 'args.log'), 'utf8').trim().split('\n');
    assert.equal(calls.length, 2);
    assert.match(calls[1] ?? '', /^npx vitest run b\.test\.ts /, 'the rerun names only the failing file');
    assert.match(r.stdout, /FLAKY vitest b\.test\.ts \(pre-push abc\)/);
    assert.match(readFileSync(join(dir, 'build', 'test-logs', 'flaky.log'), 'utf8'), /FLAKY vitest b\.test\.ts/);
  });

  it('a file still failing on the rerun fails the run, naming it, with no FLAKY line', () => {
    const dir = fakeVitestCopy(true);
    const r = spawnSync('node', [RERUN, 'vitest'], { cwd: dir, encoding: 'utf8', env: { ...process.env, HEAVY: '' } });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /still failing after one rerun:\n {2}b\.test\.ts/);
    assert.equal(existsSync(join(dir, 'build', 'test-logs', 'flaky.log')), false);
  });
});
