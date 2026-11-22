/**
 * scripts/kill-http.sh never kills another live run's test server (17 Oct 2026: a unit test killed a live
 * suite's server on 4100). A listener tagged OPENISD_BROWSER_OWNER="<pid> <start>" whose owner is alive is
 * refused; one whose owner is dead, or an untagged one, is killed. Each case uses its own free port from the
 * OS, so no real run's port is touched.
 */
import {describe, it, onTestFinished} from 'vitest';
import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') { reject(new Error('no port')); return; }
      probe.close(() => resolve(address.port));
    });
  });
}

function startTime(pid: number): string {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
}

/** A listener on the port, with the given tag in its environment (none when the tag is null). */
async function listener(port: number, tag: string | null): Promise<ChildProcess> {
  const env: typeof process.env = {...process.env};
  delete env.OPENISD_BROWSER_OWNER;
  if (tag !== null) env.OPENISD_BROWSER_OWNER = tag;
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {env, stdio: 'ignore'});
  onTestFinished(() => { child.kill('SIGKILL'); });
  for (let i = 0; i < 50; i++) {
    if (spawnSync('lsof', ['-ti', `:${port}`], {encoding: 'utf8'}).stdout.trim() !== '') return child;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`listener on ${port} did not start`);
}

function killHttp(port: number): {status: number | null; stderr: string} {
  const runtime = mkdtempSync(join(tmpdir(), 'kill-http-runtime-'));
  onTestFinished(() => rmSync(runtime, {recursive: true, force: true}));
  const env: typeof process.env = {...process.env, OPENISD_RUNTIME_DIR: runtime};
  delete env.OPENISD_BROWSER_OWNER;
  const done = spawnSync('bash', [join(ROOT, 'scripts', 'kill-http.sh'), String(port)], {env, encoding: 'utf8', timeout: 30_000});
  return {status: done.status, stderr: done.stderr};
}

function alive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

describe('scripts/kill-http.sh', () => {
  it("refuses to kill another live run's test server", async () => {
    const port = await freePort();
    const server = await listener(port, `${process.pid} ${startTime(process.pid)}`);
    const done = killHttp(port);
    assert.equal(done.status, 1);
    assert.match(done.stderr, /test server of another live run/);
    assert.ok(alive(server));
  });

  it('kills the server of a run whose owner is dead', async () => {
    const port = await freePort();
    const server = await listener(port, '999999 1');
    assert.equal(killHttp(port).status, 0);
    await new Promise(r => setTimeout(r, 200));
    assert.ok(!alive(server));
  });

  it('kills an untagged listener', async () => {
    const port = await freePort();
    const server = await listener(port, null);
    assert.equal(killHttp(port).status, 0);
    await new Promise(r => setTimeout(r, 200));
    assert.ok(!alive(server));
  });
});
