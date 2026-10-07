/**
 * The pre-push browser stage (John, 2026-10-07: a slow run that fails on a few tests reruns those
 * alone). `scripts/test.sh` with no arguments is the full gate `npm run ci` ends in; its browser
 * stage goes through scripts/slow-run/rerun.mjs, which reruns 1-10 failing spec files once.
 * `scripts/test-browser.sh` runs the suite once; it has no retries of its own. Both scripts run here from
 * a temp copy beside fake collaborators, so no browser starts.
 */
import {describe, it, onTestFinished} from 'vitest';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pre-push-stage-test-')));
  onTestFinished(() => rmSync(dir, {recursive: true, force: true}));
  return dir;
}

function lines(file: string): string[] {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(l => l !== '');
  } catch {
    return [];
  }
}

describe('scripts/test.sh full gate', () => {
  it('runs the unit suite, then the browser suite through rerun.mjs', () => {
    const dir = tempDir();
    const events = join(dir, 'events');
    const queue = join(dir, 'queue');
    mkdirSync(join(dir, 'scripts', 'slow-run'), {recursive: true});
    copyFileSync(join(ROOT, 'scripts', 'test.sh'), join(dir, 'scripts', 'test.sh'));
    copyFileSync(join(ROOT, 'scripts', 'slow-run', 'queue.sh'), join(dir, 'scripts', 'slow-run', 'queue.sh'));
    writeFileSync(join(dir, 'scripts', 'quiet-test.sh'),
      `#!/usr/bin/env bash\necho "quiet $* tickets=$(ls '${queue}/q' | wc -l)" >> '${events}'\n`);
    writeFileSync(join(dir, 'scripts', 'slow-run', 'rerun.mjs'),
      `import {appendFileSync, readdirSync} from 'node:fs';\n` +
      `appendFileSync('${events}', 'rerun ' + process.argv.slice(2).join(' ') + ' tickets=' + readdirSync('${queue}/q').length + '\\n');\n`);
    const done = spawnSync('bash', [join(dir, 'scripts', 'test.sh')], {
      cwd: dir, env: {...process.env, OPENISD_FULL_GATE: '1', SLOW_RUN_DIR: queue}, encoding: 'utf8',
    });
    assert.equal(done.status, 0, done.stderr);
    assert.deepEqual(lines(events), ['quiet npx vitest run tickets=1', 'rerun playwright tickets=1']);
  });
});

describe('scripts/test-browser.sh', () => {
  /** Runs test-browser.sh against a fake `npx` whose playwright run fails with 3; returns what the fake saw. */
  function run(args: string[]): {status: number | null; runs: string[]} {
    const dir = tempDir();
    const events = join(dir, 'events');
    const bin = join(dir, 'bin');
    const queue = join(dir, 'queue');
    mkdirSync(join(dir, 'scripts', 'slow-run'), {recursive: true});
    mkdirSync(bin);
    for (const name of ['test-browser.sh', 'test-concurrency.sh', 'kill-http.sh']) {
      copyFileSync(join(ROOT, 'scripts', name), join(dir, 'scripts', name));
    }
    copyFileSync(join(ROOT, 'scripts', 'slow-run', 'queue.sh'), join(dir, 'scripts', 'slow-run', 'queue.sh'));
    writeFileSync(join(bin, 'npx'), [
      '#!/usr/bin/env bash',
      'case "$*" in',
      '  *--list*) echo "Total: 1 test in 1 file" ;;',
      `  *) echo "$* tickets=$(ls '${queue}/q' 2>/dev/null | wc -l)" >> '${events}'; exit 3 ;;`,
      'esac',
      '',
    ].join('\n'));
    chmodSync(join(bin, 'npx'), 0o755);
    const done = spawnSync('bash', [join(dir, 'scripts', 'test-browser.sh'), ...args], {
      cwd: dir,
      env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, SLOW_RUN_DIR: queue,
        OPENISD_RESERVATION_DIR: join(dir, 'reservations'),
      },
      encoding: 'utf8',
    });
    return {status: done.status, runs: lines(events)};
  }

  it('runs a failing playwright suite once and returns its exit code: retrying is rerun.mjs\'s job', () => {
    const {status, runs} = run([]);
    assert.equal(status, 3);
    assert.equal(runs.length, 1);
    assert.match(runs[0], /^playwright test /);
  });

  it('the full suite (no spec named) is a slow run: it holds a queue ticket while it runs', () => {
    assert.match(run([]).runs[0], / tickets=1$/);
  });

  it('a run that names a spec is targeted and never queues', () => {
    assert.match(run(['packages/ui/test/ui/x.browser.spec.ts']).runs[0], / tickets=0$/);
  });
});
