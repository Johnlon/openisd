/**
 * Mechanical architecture guard — AD-3 "core has no DOM" (see ARCHITECTURE.md AD-3).
 *
 * The engine (`packages/engine/src`) is pure audio physics + file I/O: it must never
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

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// Browser/UI surfaces the pure engine layer must not touch (AD-3).
const FORBIDDEN_GLOBALS = ['document', 'window', 'navigator', 'localStorage', 'canvas', 'HTMLElement'];
const FORBIDDEN_IMPORT = /from\s+['"](vue|@vue\/[^'"]+|[^'"]*\.vue)['"]/;
// Word-boundary match so identifiers like `windowLength` or `documentation` don't false-positive.
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
        `packages/engine/src/${file} imports a Vue/UI module — engine must stay DOM-free (AD-3)`,
      );
    }
  });

  it('no engine source references a browser global', () => {
    for (const file of engineSourceFiles()) {
      const text = readFileSync(join(SRC_DIR, file), 'utf8');
      for (const g of FORBIDDEN_GLOBALS) {
        assert.ok(
          !globalRe(g).test(text),
          `packages/engine/src/${file} references browser global '${g}' — engine must stay DOM-free (AD-3)`,
        );
      }
    }
  });

  it('discovers the engine source set (guard is not silently empty)', () => {
    assert.ok(engineSourceFiles().length >= 5, 'expected the engine src/*.ts set; found too few — check SRC_DIR');
  });
});
