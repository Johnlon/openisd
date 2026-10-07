/**
 * The commit and push hooks are slow runs (John, 2026-10-07: concurrent slow runs kill the machine).
 * Each goes through scripts/slow-run/slow-run.sh, which takes a ticket in the machine-wide queue
 * before it runs anything, so two never overlap. Here the real hooks, slow-run.sh, queue.sh and
 * clean-copy.sh run in a temp git repo beside a fake `npm` and `node`, and each fake records how many
 * tickets the queue holds at that moment.
 */
import {describe, it, onTestFinished} from 'vitest';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const COPIED = [
  'scripts/hooks-local/pre-commit',
  'scripts/hooks-local/pre-push',
  'scripts/hooks-local/heavy-gate-concurrency.sh',
  'scripts/hooks-local/no-ai-attribution.sh',
  'scripts/slow-run/slow-run.sh',
  'scripts/slow-run/queue.sh',
  'scripts/slow-run/clean-copy.sh',
  'scripts/slow-run/rerun.mjs',
];

interface Fixture {
  readonly repo: string;
  readonly queue: string;
  readonly events: string;
  readonly env: Record<string, string>;
}

function git(repo: string, env: Record<string, string>, ...args: string[]): string {
  const done = spawnSync('git', args, {cwd: repo, env: {...process.env, ...env}, encoding: 'utf8'});
  assert.equal(done.status, 0, done.stderr);
  return done.stdout.trim();
}

/** A temp repo holding the real hooks and slow-run scripts, a staged non-markdown change, and fake npm/node. */
function fixture(): Fixture {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'hooks-ticket-test-')));
  onTestFinished(() => rmSync(base, {recursive: true, force: true}));
  const repo = join(base, 'repo');
  const bin = join(base, 'bin');
  const queue = join(base, 'queue');
  const events = join(base, 'events');
  mkdirSync(repo);
  mkdirSync(bin);
  for (const file of COPIED) {
    mkdirSync(join(repo, file, '..'), {recursive: true});
    copyFileSync(join(ROOT, file), join(repo, file));
  }
  const tickets = `$(ls '${queue}/q' 2>/dev/null | wc -l)`;
  for (const name of ['npm', 'node']) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash\necho "${name} $* tickets=${tickets}" >> '${events}'\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: base,
    SLOW_RUN_DIR: queue,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  };
  git(repo, env, 'init', '-q');
  writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
  git(repo, env, 'add', '-A');
  git(repo, env, 'commit', '-q', '--no-verify', '-m', 'start');
  writeFileSync(join(repo, 'a.ts'), 'export const a = 2;\n');
  git(repo, env, 'add', 'a.ts');
  return {repo, queue, events, env};
}

function seen(events: string): string[] {
  return readFileSync(events, 'utf8').split('\n').filter(l => l !== '');
}

describe('the hooks take a queue ticket', () => {
  it('pre-commit: lint, typecheck and the unit rerun each run while the run holds a ticket, and the ticket is released after', () => {
    const {repo, queue, events, env} = fixture();
    const done = spawnSync('sh', ['scripts/hooks-local/pre-commit'], {cwd: repo, env: {...process.env, ...env}, encoding: 'utf8'});
    assert.equal(done.status, 0, done.stdout + done.stderr);
    const lines = seen(events);
    assert.deepEqual(lines.map(l => l.replace(/^(\w+ \S+ \S+).*( tickets=\d+)$/, '$1$2')).slice(0, 2),
      ['npm run lint tickets=1', 'npm run typecheck tickets=1']);
    assert.ok(lines.some(l => l.startsWith('node ') && l.includes('rerun.mjs vitest') && l.endsWith(' tickets=1')), lines.join('\n'));
    assert.deepEqual(readdirSync(join(queue, 'q')), []);
  });

  it('pre-push: lint, typecheck and both reruns run while the run holds a ticket, and the ticket is released after', () => {
    const {repo, queue, events, env} = fixture();
    const sha = git(repo, env, 'rev-parse', 'HEAD');
    const zero = '0'.repeat(40);
    const done = spawnSync('sh', ['scripts/hooks-local/pre-push'], {
      cwd: repo, env: {...process.env, ...env}, encoding: 'utf8', input: `refs/heads/main ${sha} refs/heads/main ${zero}\n`,
    });
    assert.equal(done.status, 0, done.stdout + done.stderr);
    const lines = seen(events);
    assert.ok(lines.some(l => l === 'npm run lint tickets=1'), lines.join('\n'));
    assert.ok(lines.some(l => l === 'npm run typecheck tickets=1'), lines.join('\n'));
    assert.ok(lines.some(l => l.includes('rerun.mjs vitest') && l.endsWith(' tickets=1')), lines.join('\n'));
    assert.ok(lines.some(l => l.includes('rerun.mjs playwright') && l.endsWith(' tickets=1')), lines.join('\n'));
    assert.deepEqual(readdirSync(join(queue, 'q')), []);
  });
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function until(done: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (done()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}

describe('cancelling a slow run', () => {
  const STEPS = [
    {name: 'a step that dies on TERM', prelude: ''},
    {name: 'a step that ignores TERM (killed 5 s later)', prelude: "trap '' TERM\n"},
  ];
  it.each(STEPS)('stops everything the run started, releases the ticket and removes the clean copy: $name', async ({prelude}) => {
    const {repo, queue, env} = fixture();
    const grandchildPid = join(repo, '..', 'grandchild.pid');
    // The first step npm runs spawns a long-lived grandchild, then waits itself.
    writeFileSync(join(repo, '..', 'bin', 'npm'),
      `#!/usr/bin/env bash\n${prelude}sleep 300 &\necho $! > '${grandchildPid}'\nwait\n`);
    const child = spawn('bash', ['scripts/slow-run/slow-run.sh', 'health-check'], {
      cwd: repo, env: {...process.env, ...env}, stdio: 'ignore',
    });
    const exited = new Promise<void>(resolve => child.on('exit', () => resolve()));
    await until(() => existsSync(grandchildPid) && readFileSync(grandchildPid, 'utf8').trim() !== '', 'the grandchild to start');
    const grandchild = Number(readFileSync(grandchildPid, 'utf8'));
    assert.ok(alive(grandchild));
    child.kill('SIGTERM');
    await exited;
    await until(() => !alive(grandchild), 'the grandchild to stop');
    assert.deepEqual(readdirSync(join(queue, 'q')), []);
    assert.deepEqual(readdirSync(join(repo, '..', '.slowrun')), []);
  }, 30_000);
});
