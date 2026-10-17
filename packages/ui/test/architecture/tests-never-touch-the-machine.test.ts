/**
 * A test never reaches the machine's real ports, processes or runtime dir through a repo script.
 * 17 Oct 2026: full-gate-stage.test.ts ran test-browser.sh from a scratch copy, but with the real kill-http.sh
 * and the real runtime dir. It took port 4100 and killed a live suite's test server. T254's runtime-dir bug was
 * the same kind.
 *
 * Machine scripts are found from their text, so a new one is covered without a list: any scripts/**.sh
 * (outside test dirs) that kills, looks up ports, runs systemd or uses the runtime dir. Port killers are the
 * ones that find processes by port themselves (lsof, fuser).
 *
 * A test under packages/test that names a machine script:
 *   1. gives it a scratch runtime dir: sets OPENISD_RUNTIME_DIR, with a temp dir (mkdtempSync);
 *   2. never copies or runs a real port killer: a port killer's name appears only where the test writes a
 *      fake of it (writeFileSync);
 *   3. never runs a script from the repo itself: no spawn/exec line names ROOT, only its scratch copy.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

function tracked(...globs: string[]): string[] {
  return execFileSync('git', ['ls-files', ...globs.map(g => `:(glob)${g}`)], {cwd: ROOT, encoding: 'utf8'})
    .split('\n').filter(f => f !== '');
}

const MACHINE = /\bkill\b|\blsof\b|\bfuser\b|systemd-run|systemctl|OPENISD_RUNTIME_DIR|paths\.sh/;
const BY_PORT = /\blsof\b|\bfuser\b/;

const scripts = tracked('scripts/**/*.sh').filter(f => !f.includes('/test/'));
const machineScripts = new Set(scripts.filter(f => MACHINE.test(readFileSync(join(ROOT, f), 'utf8'))).map(f => basename(f)));
const portKillers = new Set(scripts.filter(f => BY_PORT.test(readFileSync(join(ROOT, f), 'utf8'))).map(f => basename(f)));

/** A test that does exactly what the rules forbid, on purpose, and why that is safe. */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  ['packages/ui/test/scripts/kill-http-live-run.test.ts',
   'tests the real kill-http.sh, only on ports it takes from the OS for itself'],
]);

const tests = tracked('packages/*/test/**/*.test.ts').filter(f => !f.includes('/architecture/'));

function named(text: string, names: ReadonlySet<string>): string[] {
  return [...names].filter(n => new RegExp(`['"\`/]${n.replace('.', '\\.')}['"\`]`).test(text));
}

describe('tests never touch the machine through a repo script', () => {
  it('finds the machine scripts and port killers from their text', () => {
    for (const s of ['kill-http.sh', 'test-browser.sh', 'test-concurrency.sh', 'paths.sh', 'housekeeping.sh']) {
      assert.ok(machineScripts.has(s), `${s} should count as a machine script`);
    }
    assert.ok(portKillers.has('kill-http.sh'));
  });

  it('a test that names a machine script gives it a scratch runtime dir', () => {
    const bad = tests.filter(f => {
      const text = readFileSync(join(ROOT, f), 'utf8');
      return named(text, machineScripts).length > 0 && !(text.includes('OPENISD_RUNTIME_DIR') && text.includes('mkdtempSync'));
    });
    assert.deepEqual(bad, [], 'set OPENISD_RUNTIME_DIR to a temp dir in every spawned env');
  });

  it('a real port killer is never copied or run; only a fake of it is written', () => {
    const bad = tests.filter(f => !EXEMPT.has(f)).flatMap(f => {
      const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
      return lines.flatMap((line, i) => named(line, portKillers).length > 0 && !line.includes('writeFileSync') ? [`${f}:${i + 1}`] : []);
    });
    assert.deepEqual(bad, [], 'write a fake of the port killer into the scratch copy instead');
  });

  it('no test runs a script from the repo itself', () => {
    const bad = tests.filter(f => !EXEMPT.has(f)).flatMap(f => {
      const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
      return lines.flatMap((line, i) => /\b(spawn|spawnSync|execFile|execFileSync|execSync|exec)\(/.test(line) && /\bROOT\b/.test(line)
        && named(line, machineScripts).length > 0 ? [`${f}:${i + 1}`] : []);
    });
    assert.deepEqual(bad, [], 'run the scratch copy, never the repo\'s own machine script');
  });
});
