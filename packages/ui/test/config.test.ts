/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/app-shell/spec.md?html
 */
/**
 * Build-config sanity checks.
 *
 * Transient files live in build/ (AGENTS.md §"Scratch files"). These tests guard
 * against regressions where that scratch space gets watched by Vite — causing
 * continuous dev-server reloads — or committed to the repo.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

// ── Vite config ──────────────────────────────────────────────────────────────

describe('vite.config.js', () => {
  const VITE_CONFIG_PATH = join(ROOT, 'vite.config.js');
  // Read as text so we don't need to execute the module (avoids import-time
  // side effects and keeps the test framework-agnostic).
  const viteConfig = readFileSync(VITE_CONFIG_PATH, 'utf8');

  it('excludes build/ from the file watcher so writing scratch files never reloads the dev server', () => {
    assert.ok(
      viteConfig.includes('**/build/**'),
      'vite.config.js server.watch.ignored must exclude build/ — it is the repo scratch ' +
      'space, and a write there would otherwise trigger a full-page reload.'
    );
  });
});

// ── .gitignore ───────────────────────────────────────────────────────────────

describe('.gitignore', () => {
  const GITIGNORE_PATH = join(ROOT, '.gitignore');
  const gitignore = readFileSync(GITIGNORE_PATH, 'utf8');

  it('excludes build/ so scratch files are never committed', () => {
    assert.ok(
      gitignore.split(/\r?\n/).some(l => l.trim() === 'build/'),
      '.gitignore must exclude build/ — every throwaway script, probe output and log ' +
      'goes there, and none of it belongs in git.'
    );
  });
});
