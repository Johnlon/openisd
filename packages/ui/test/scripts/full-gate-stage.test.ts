/**
 * The full gate. `scripts/test.sh` with no arguments runs the unit suite, then the browser suite;
 * `scripts/test-browser.sh` runs the browser suite once with no retry of its own (a flaky spec is
 * a red). Both run here from a temp copy beside fake collaborators, so no browser starts.
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
  it('runs the unit suite, then the browser suite, and is red when either is red', () => {
    const dir = tempDir();
    const events = join(dir, 'events');
    mkdirSync(join(dir, 'scripts'), {recursive: true});
    copyFileSync(join(ROOT, 'scripts', 'test.sh'), join(dir, 'scripts', 'test.sh'));
    copyFileSync(join(ROOT, 'scripts', 'paths.sh'), join(dir, 'scripts', 'paths.sh'));
    writeFileSync(join(dir, 'scripts', 'quiet-test.sh'), `#!/usr/bin/env bash\necho "quiet $*" >> '${events}'\n`);
    writeFileSync(join(dir, 'scripts', 'test-browser.sh'), `#!/usr/bin/env bash\necho "browser" >> '${events}'\nexit 3\n`);
    const done = spawnSync('bash', [join(dir, 'scripts', 'test.sh')], {
      cwd: dir, env: {...process.env, OPENISD_FULL_GATE: '1'}, encoding: 'utf8',
    });
    assert.equal(done.status, 1, done.stderr);
    assert.deepEqual(lines(events), ['quiet npx vitest run', 'browser']);
  });
});

describe('scripts/test-browser.sh', () => {
  it('runs a failing playwright suite once and returns its exit code', () => {
    const dir = tempDir();
    const events = join(dir, 'events');
    const bin = join(dir, 'bin');
    mkdirSync(join(dir, 'scripts'), {recursive: true});
    mkdirSync(bin);
    for (const name of ['test-browser.sh', 'test-concurrency.sh', 'kill-http.sh', 'paths.sh']) {
      copyFileSync(join(ROOT, 'scripts', name), join(dir, 'scripts', name));
    }
    writeFileSync(join(bin, 'npx'), [
      '#!/usr/bin/env bash',
      'case "$*" in',
      '  *--list*) echo "Total: 1 test in 1 file" ;;',
      `  *) echo "$*" >> '${events}'; exit 3 ;;`,
      'esac',
      '',
    ].join('\n'));
    chmodSync(join(bin, 'npx'), 0o755);
    const done = spawnSync('bash', [join(dir, 'scripts', 'test-browser.sh')], {
      cwd: dir,
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`, OPENISD_RESERVATION_DIR: join(dir, 'reservations')},
      encoding: 'utf8',
    });
    const runs = lines(events);
    assert.equal(done.status, 3);
    assert.equal(runs.length, 1);
    assert.match(runs[0], /^playwright test/);
  });
});
