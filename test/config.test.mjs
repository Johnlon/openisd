/**
 * Build-config sanity checks.
 *
 * These tests guard against regressions where scraper cache directories
 * (_html/, datasheets/) get picked up by Vite's file watcher and cause
 * continuous dev-server reloads that make the app unusable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// ── Vite config ──────────────────────────────────────────────────────────────

describe('vite.config.js', () => {
  const VITE_CONFIG_PATH = join(ROOT, 'vite.config.js');
  // Read as text so we don't need to execute the module (avoids import-time
  // side effects and keeps the test framework-agnostic).
  const viteConfig = readFileSync(VITE_CONFIG_PATH, 'utf8');

  it('excludes _html/ scraper cache from file watcher so active scraper runs do not reload the dev server', () => {
    assert.ok(
      viteConfig.includes('_html'),
      'vite.config.js server.watch.ignored must exclude _html/ directories. ' +
      'Without this, scraper runs write HTML files that Vite watches and ' +
      'triggers continuous full-page reloads, making the dev server unusable.'
    );
  });

  it('excludes datasheets/ scraper cache from file watcher for the same reason', () => {
    assert.ok(
      viteConfig.includes('datasheets'),
      'vite.config.js server.watch.ignored must exclude datasheets/ directories. ' +
      'Without this, scraper PDF downloads trigger continuous full-page reloads.'
    );
  });
});

// ── .gitignore ───────────────────────────────────────────────────────────────

describe('.gitignore', () => {
  const GITIGNORE_PATH = join(ROOT, '.gitignore');
  const gitignore = readFileSync(GITIGNORE_PATH, 'utf8');

  it('excludes scraper _html/ cache directories so raw HTML never bloats the repo', () => {
    assert.ok(
      gitignore.includes('_html'),
      '.gitignore must exclude drivers/**/_html/ — raw HTML cache is ' +
      'for local scraper re-use only; datasheet URLs are stored in boxbench_datasheet= fields in each .wdr file.'
    );
  });

  it('excludes scraper datasheets/ directories so PDF datasheets never bloat the repo', () => {
    assert.ok(
      gitignore.includes('datasheets'),
      '.gitignore must exclude drivers/**/datasheets/ — PDF files are ' +
      'large; the datasheet URL is stored in boxbench_datasheet= in each .wdr file.'
    );
  });
});
