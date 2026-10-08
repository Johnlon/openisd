/**
 * scripts/vite-watchdog.sh stops a browser run only when the dev server is gone: its port has no
 * listener for 3 polls in a row, or it listens but has answered nothing for the silent-poll limit.
 * A server that is slow under load but still listening and answering now and then never trips it
 * (hc3, 2026-10-07: "Vite server on port 4104 is unreachable" aborted a healthy run at test 508).
 * Here the real script runs against a fake `curl` and `ss` and a stand-in test process.
 */
import {afterEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const SCRIPT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..', 'scripts', 'vite-watchdog.sh');

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

interface Outcome {
  readonly output: string;
  readonly stopped: boolean;
}

const LOOKS = 200;

/** The process state letter from /proc, or 'gone'; looks up to LOOKS times, 10 ms apart, until it is gone or a zombie. */
function stateAfterStop(pid: number | undefined): string {
  let state = 'gone';
  for (let look = 0; look < LOOKS; look++) {
    try {
      state = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]!.charAt(0);
    } catch {
      return 'gone';
    }
    if (state === 'Z') return state;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
  return state;
}

/** Runs the watchdog against a stand-in test process; `answers` is what each curl call returns in turn (the last repeats). */
function watch(answers: ReadonlyArray<'ok' | 'fail'>, listening: boolean, silentPolls: number): Outcome {
  const dir = mkdtempSync(join(tmpdir(), 'vite-watchdog-test-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(dir, 'answers'), answers.join('\n') + '\n');
  writeFileSync(join(bin, 'curl'), [
    '#!/usr/bin/env bash',
    `f='${join(dir, 'answers')}'`,
    'line=$(head -1 "$f"); n=$(wc -l < "$f")',
    '[ "$n" -gt 1 ] && sed -i 1d "$f"',
    '[ "$line" = ok ]',
    '',
  ].join('\n'));
  writeFileSync(join(bin, 'ss'), `#!/usr/bin/env bash\n${listening ? 'echo "LISTEN 0 511 *:4100 *:*"' : 'true'}\n`);
  chmodSync(join(bin, 'curl'), 0o755);
  chmodSync(join(bin, 'ss'), 0o755);
  const testProcess = spawn('sleep', ['60'], {stdio: 'ignore'});
  let ended = false;
  testProcess.on('exit', () => { ended = true; });
  cleanups.push(() => {
    testProcess.kill('SIGKILL');
    rmSync(dir, {recursive: true, force: true});
  });
  const done = spawnSync('bash', [SCRIPT, '4100', String(testProcess.pid)], {
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`,
      WATCHDOG_POLL_S: '0.05', WATCHDOG_START_WAIT_S: '0', WATCHDOG_SILENT_POLLS: String(silentPolls),
      WATCHDOG_MAX_POLLS: '40',
    },
    encoding: 'utf8',
  });
  // spawnSync blocks the event loop, so the exit event is not seen yet and a killed child is still
  // a zombie: read its state from the OS. The watchdog sends SIGTERM and returns; under load the
  // child can still be running when we look. Look again a bounded number of times (a count of
  // looks, not a deadline) before concluding it was not stopped.
  const state = stateAfterStop(testProcess.pid);
  return {output: done.stdout + done.stderr, stopped: state === 'gone' || state === 'Z' || ended};
}

describe('vite-watchdog.sh', () => {
  it('lets a run go on while the server answers', () => {
    const {stopped, output} = watch(['ok'], true, 4);
    assert.equal(stopped, false, output);
  });

  it('a server that is slow but listening and answers again is never stopped', () => {
    const {stopped, output} = watch(['fail', 'fail', 'fail', 'ok'], true, 4);
    assert.equal(stopped, false, output);
  });

  it('stops the run when nothing listens on the port for 3 polls', () => {
    const {stopped, output} = watch(['fail'], false, 4);
    assert.equal(stopped, true, output);
    assert.match(output, /WATCHDOG: nothing listens on port 4100/);
  });

  it('stops the run when the server listens but stays silent for the silent-poll limit', () => {
    const {stopped, output} = watch(['fail'], true, 4);
    assert.equal(stopped, true, output);
    assert.match(output, /WATCHDOG: port 4100 listens but answered nothing for 4 polls/);
  });
});
