/**
 * scripts/vite-watchdog.sh stops a browser run only when the dev server is gone: its port has no
 * listener for 3 polls in a row, or it listens but has answered nothing for the silent-poll limit.
 * A server that is slow under load but still listening and answering now and then never trips it
 * (hc3, 2026-10-07: "Vite server on port 4104 is unreachable" aborted a healthy run at test 508).
 * Here the real script runs against a fake `curl` and `ss` and a stand-in test process.
 */
import {afterEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
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
  /** Settles when the stand-in test process has exited. No deadline: a stop that never comes ends at the test timeout. */
  readonly exited: Promise<true>;
  /** Whether the stand-in test process is still running now. */
  alive(): boolean;
}

/** Runs the watchdog against a stand-in test process; `answers` is what each curl call returns in turn (the last repeats). */
async function watch(answers: ReadonlyArray<'ok' | 'fail'>, listening: boolean, silentPolls: number): Promise<Outcome> {
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
  const exited = new Promise<true>(resolve => testProcess.on('exit', () => resolve(true)));
  cleanups.push(() => {
    testProcess.kill('SIGKILL');
    rmSync(dir, {recursive: true, force: true});
  });
  const watchdog = spawn('bash', [SCRIPT, '4100', String(testProcess.pid)], {
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`,
      WATCHDOG_POLL_S: '0.05', WATCHDOG_START_WAIT_S: '0', WATCHDOG_SILENT_POLLS: String(silentPolls),
      WATCHDOG_MAX_POLLS: '40',
    },
  });
  let output = '';
  watchdog.stdout.on('data', chunk => { output += String(chunk); });
  watchdog.stderr.on('data', chunk => { output += String(chunk); });
  await new Promise<void>(resolve => watchdog.on('close', () => resolve()));
  return {output, exited, alive: () => testProcess.exitCode === null && testProcess.signalCode === null};
}

describe('vite-watchdog.sh', () => {
  it('lets a run go on while the server answers', async () => {
    const {alive, output} = await watch(['ok'], true, 4);
    assert.equal(alive(), true, output);
  });

  it('a server that is slow but listening and answers again is never stopped', async () => {
    const {alive, output} = await watch(['fail', 'fail', 'fail', 'ok'], true, 4);
    assert.equal(alive(), true, output);
  });

  it('stops the run when nothing listens on the port for 3 polls', async () => {
    const {exited, output} = await watch(['fail'], false, 4);
    assert.equal(await exited, true, output);
    assert.match(output, /WATCHDOG: nothing listens on port 4100/);
  });

  it('stops the run when the server listens but stays silent for the silent-poll limit', async () => {
    const {exited, output} = await watch(['fail'], true, 4);
    assert.equal(await exited, true, output);
    assert.match(output, /WATCHDOG: port 4100 listens but answered nothing for 4 polls/);
  });
});
