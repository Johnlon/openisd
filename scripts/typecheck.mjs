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

const results = await Promise.all(CHECKS.map(run));
let failed = 0;
for (const r of results) {
  const verdict = r.status === 0 ? 'ok' : 'FAILED';
  console.log(`── typecheck ${r.check.label}: ${verdict} (${r.seconds.toFixed(1)}s) ──`);
  if (r.output.trim()) console.log(r.output.trimEnd());
  if (r.status !== 0) failed++;
}
process.exit(failed === 0 ? 0 : 1);
