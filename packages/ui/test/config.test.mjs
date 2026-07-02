/**
 * Build-config sanity checks.
 *
 * These tests guard against regressions where scraper cache directories
 * (_html/, datasheets/) get picked up by Vite's file watcher and cause
 * continuous dev-server reloads that make the app unusable.
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

  it('excludes all _-prefixed scraper cache dirs (_html, _datasheets, …) from the file watcher so active scraper runs do not reload the dev server', () => {
    assert.ok(
      viteConfig.includes('_*'),
      'vite.config.js server.watch.ignored must exclude drivers/**/_*/ directories. ' +
      'All scraper cache/scratch dirs are _-prefixed (_html, _datasheets); without this, ' +
      'scraper writes trigger continuous full-page reloads, making the dev server unusable.'
    );
  });
});

// ── .gitignore ───────────────────────────────────────────────────────────────

describe('.gitignore', () => {
  const GITIGNORE_PATH = join(ROOT, '.gitignore');
  const gitignore = readFileSync(GITIGNORE_PATH, 'utf8');

  it('excludes all _-prefixed scraper cache dirs (_html, _datasheets, …) so raw HTML and PDFs never bloat the repo', () => {
    assert.ok(
      gitignore.includes('_*'),
      '.gitignore must exclude drivers/**/_*/ — all scraper cache/scratch dirs are ' +
      '_-prefixed (_html raw HTML, _datasheets PDFs); source URLs live in _meta.yml sidecars.'
    );
  });
});
