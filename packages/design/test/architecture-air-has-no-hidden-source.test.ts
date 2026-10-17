// THIS GATE EXISTS TO CATCH THE AI. A red result is the finding: name the defect in a sentence and
// repair it, or STOP and report. Never rename, exempt or loosen to make it pass.
// See AGENTS.md "Every architecture test exists to catch the AI".

/**
 * Air has no hidden source (bugs/BUG_20261017_air-has-hidden-sources.md; John, 17 Oct 2026: "there
 * is no default air"). Air comes from its owner as an argument. A calculation that asks the air
 * model about an empty environment gets factory air nobody chose.
 *
 * This gate: no non-test source in `packages/design` or `packages/ui/src` solves an empty
 * environment. The later air tasks add: no optional environment fields, and no read of the app's
 * environment setting outside the composition root.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOTS = [join(PACKAGES, 'design'), join(PACKAGES, 'ui', 'src')];
const SKIPPED_DIRS = new Set(['node_modules', 'test', 'dist', 'build']);
const EMPTY_ENVIRONMENT = /(?:solveEnvironment|environment\.solve|airFor)\(\s*\{\s*\}\s*\)/;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sourcesUnder(join(dir, entry.name));
    return /\.(ts|vue)$/.test(entry.name) ? [join(dir, entry.name)] : [];
  });
}

/** The code with comments removed: prose that names the pattern is not the pattern. */
function executableText(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

describe('air has no hidden source', () => {
  it('no source solves an empty environment', () => {
    const offenders = ROOTS.flatMap(sourcesUnder)
      .filter(file => EMPTY_ENVIRONMENT.test(executableText(readFileSync(file, 'utf8'))))
      .map(file => file.slice(PACKAGES.length + 1));
    assert.deepEqual(offenders, [], 'these solve air for an empty environment, which is factory air: pass the owner\'s air');
  });
});
