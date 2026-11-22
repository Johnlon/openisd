#!/usr/bin/env node
/**
 * typecheck.mjs — the three package typechecks, run at once.
 *
 *   node scripts/typecheck.mjs
 *
 * design, persistence and ui are separate tsc programs (ui via vue-tsc). Run serially they cost
 * their sum (~40 s); the box has the cores to run them together, so the gate costs the longest
 * one. Output is buffered per package and printed in order, so a failure reads the same as
 * before. Exit status is non-zero if any fails.
 *
 * OPENISD_TYPECHECK_CONCURRENCY caps how many of the three run at once (default: all of them).
 * scripts/hooks-local/heavy-gate-concurrency.sh sets it down from 3 when several sessions are
 * running the gate at the same time, so N sessions' tsc/vue-tsc trees fair-share the box's cores
 * instead of each assuming they own every core.
 */
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const shell = process.platform === 'win32';

/** One package's typecheck: its label and the command that runs it. */
class Typecheck {
  constructor(label, command, args) {
    this.label = label;
    this.command = command;
    this.args = args;
  }
}

const CHECKS = [
  new Typecheck('design', 'npx', ['tsc', '-p', 'packages/design', '--noEmit']),
  new Typecheck('persistence', 'npx', ['tsc', '-p', 'packages/persistence', '--noEmit']),
  new Typecheck('ui', 'npx', ['vue-tsc', '-p', 'packages/ui', '--noEmit']),
];

function run(check) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(check.command, check.args, { cwd: ROOT, shell });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', status => resolve({ check, status: status ?? 1, output, seconds: (Date.now() - started) / 1000 }));
  });
}

/** Runs `checks` with at most `limit` in flight at once, preserving each check's own result. */
async function runWithConcurrency(checks, limit) {
  const results = new Array(checks.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= checks.length) return;
      results[i] = await run(checks[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, checks.length) }, worker));
  return results;
}

const concurrency = Number(process.env.OPENISD_TYPECHECK_CONCURRENCY) || CHECKS.length;
const results = await runWithConcurrency(CHECKS, concurrency);
let failed = 0;
for (const r of results) {
  const verdict = r.status === 0 ? 'ok' : 'FAILED';
  console.log(`── typecheck ${r.check.label}: ${verdict} (${r.seconds.toFixed(1)}s) ──`);
  if (r.output.trim()) console.log(r.output.trimEnd());
  if (r.status !== 0) failed++;
}
process.exit(failed === 0 ? 0 : 1);
