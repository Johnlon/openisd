/**
 * Mechanical architecture guard — AD-3 "core has no DOM" (see ARCHITECTURE.md AD-3).
 *
 * The engine (`packages/design/engine`) is pure audio physics + file I/O: it must never
 * reach into the browser/UI layer. If this test goes red, some engine file grew a
 * `document`/`window`/canvas reference or a `vue`/`.vue` import — a one-way-dependency
 * break (UI → engine only, never engine → UI). This is the no-LLM guard the
 * arch-reviewer runs first; it catches the boundary drift a human reviewer would miss
 * in a large diff.
 *
 * Modeled on packages/ui/test/drivers-bundle.test.ts (vitest + node:assert/strict,
 * reading source files from disk — no import side effects).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'engine');

// Browser/UI surfaces the pure engine layer must not touch (AD-3).
const FORBIDDEN_GLOBALS = ['document', 'window', 'navigator', 'localStorage', 'canvas', 'HTMLElement'];
const FORBIDDEN_IMPORT = /from\s+['"](vue|@vue\/[^'"]+|[^'"]*\.vue)['"]/;
// Strip comments and string literals before matching. A browser global is a thing the CODE
// REFERENCES; the same letters inside a docstring or a quoted citation reference nothing and
// cannot reach a runtime. Grepping raw text made this gate fail on prose — a comment saying
// "the document WinISD names as its source" tripped 'document' — and the only way to satisfy a
// prose gate is to reword the prose, which changes no behaviour and destroys the explanation.
// AGENTS.md is explicit that a guard must test the SHAPE of the code, never words in prose.
function executableText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')       // block comments, JSDoc included
    .replace(/\/\/[^\n]*/g, ' ')              // line comments
    .replace(/`(?:\\.|[^`\\])*`/g, ' ')        // template literals
    .replace(/'(?:\\.|[^'\\\n])*'/g, ' ')      // single-quoted strings
    .replace(/"(?:\\.|[^"\\\n])*"/g, ' ');     // double-quoted strings
}

// Word-boundary match so identifiers like `windowLength` don't false-positive.
const globalRe = (name: string): RegExp => new RegExp(`\\b${name}\\b`);

function engineSourceFiles(): string[] {
  return readdirSync(SRC_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
}

describe('AD-3: engine core has no DOM / UI dependency', () => {
  it('no engine source imports Vue or a .vue module', () => {
    for (const file of engineSourceFiles()) {
      const text = readFileSync(join(SRC_DIR, file), 'utf8');
      assert.ok(
        !FORBIDDEN_IMPORT.test(text),
        `packages/design/engine/${file} imports a Vue/UI module — engine must stay DOM-free (AD-3)`,
      );
    }
  });

  it('no engine source references a browser global', () => {
    for (const file of engineSourceFiles()) {
      const text = executableText(readFileSync(join(SRC_DIR, file), 'utf8'));
      for (const g of FORBIDDEN_GLOBALS) {
        assert.ok(
          !globalRe(g).test(text),
          `packages/design/engine/${file} references browser global '${g}' — engine must stay DOM-free (AD-3)`,
        );
      }
    }
  });

  it('the comment-stripping does not disable the guard', () => {
    // Non-vacuity for `executableText`: a stripper that is slightly too greedy would blank the
    // file and every assertion above would pass on nothing. Real code must still be seen, and
    // the same word inside a comment or a string must still be ignored.
    const sample = [
      '/** a docstring mentioning document and window */',
      "const cite = 'the document says so';",
      'const el = document.body;',
    ].join('\n');
    const stripped = executableText(sample);
    assert.ok(globalRe('document').test(stripped), 'real code referencing document must survive stripping');
    assert.equal((stripped.match(/document/g) ?? []).length, 1,
      'exactly the CODE occurrence should survive — the comment and the string must not');

    const proseOnly = executableText('// window and document in a comment\nconst x = 1;');
    assert.ok(!globalRe('document').test(proseOnly), 'a comment alone must not trip the guard');
  });

  it('discovers the engine source set (guard is not silently empty)', () => {
    assert.ok(engineSourceFiles().length >= 5, 'expected the engine *.ts set; found too few — check SRC_DIR');
  });
});
