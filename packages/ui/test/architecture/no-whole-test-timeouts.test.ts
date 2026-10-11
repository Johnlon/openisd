// THIS GATE EXISTS TO CATCH THE AI. THAT IS ITS WHOLE PURPOSE.
//
// A red result IS the finding. Permitted responses: name the defect and repair it, or STOP and
// report. Loosening this gate, adding an exemption or deleting it is not a repair.

/**
 * A browser spec has no time limit of its own (John: the only timeouts are progress timeouts).
 * `playwright.config.js` sets `timeout: 0`; a stuck run is caught by the idle watchdog in
 * `scripts/quiet-test.sh`. A per-spec limit cuts off a test that is still making progress, and
 * flickers red whenever other sessions load the machine.
 *
 * Banned in `*.browser.spec.ts`, matched in code, never in comments:
 *   test.setTimeout(...)                      a whole-test limit
 *   test.slow()                               triples the limit instead of removing it
 *   test.describe.configure({timeout: ...})   a whole-describe limit
 *   {timeout: N} with N under 20 s            a step shortened below the config's 20 s hang guard
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const UI_TEST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const STEP_FLOOR_MS = 20_000;

/** Source with comments blanked, so prose naming a banned call never trips the gate. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function offencesIn(src: string): string[] {
  const code = codeOnly(src);
  const found: string[] = [];
  if (/\btest\.setTimeout\s*\(/.test(code)) found.push('test.setTimeout(...)');
  if (/\btest\.slow\s*\(/.test(code)) found.push('test.slow()');
  if (/\bdescribe\.configure\s*\(\s*\{[^}]*\btimeout\b/.test(code)) found.push('describe.configure({timeout})');
  for (const m of code.matchAll(/\btimeout:\s*([0-9_]+)/g)) {
    const ms = Number(m[1]!.replaceAll('_', ''));
    if (ms < STEP_FLOOR_MS) found.push(`timeout: ${m[1]} (under ${STEP_FLOOR_MS} ms)`);
  }
  return found;
}

describe('browser specs carry no time limit of their own', () => {
  it('offencesIn sees each banned shape (the gate is known to fire)', () => {
    assert.deepEqual(offencesIn('test.setTimeout(30000);'), ['test.setTimeout(...)']);
    assert.deepEqual(offencesIn('test.slow();'), ['test.slow()']);
    assert.deepEqual(offencesIn('test.describe.configure({ timeout: 90_000 });'), ['describe.configure({timeout})']);
    assert.deepEqual(offencesIn('await expect(x).toBeVisible({ timeout: 1000 });'), ['timeout: 1000 (under 20000 ms)']);
    assert.deepEqual(offencesIn('await page.goto("/", { timeout: 60000 });'), []);
    assert.deepEqual(offencesIn('// test.setTimeout(30000) was removed\n/* test.slow() */'), []);
  });

  it('no browser spec sets one', () => {
    const specs = readdirSync(UI_TEST_DIR).filter(f => f.endsWith('.browser.spec.ts'));
    assert.ok(specs.length > 0, 'no browser specs found');
    const offences = specs.flatMap(f => offencesIn(readFileSync(join(UI_TEST_DIR, f), 'utf8')).map(o => `${f}: ${o}`));
    assert.deepEqual(offences, []);
  });
});
