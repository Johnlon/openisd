/**
 * Build-config sanity checks.
 *
 * Transient files live in build/ (AGENTS.md §"Scratch files"). These tests guard
 * against regressions where that scratch space gets watched by Vite — causing
 * continuous dev-server reloads — or committed to the repo.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

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

describe('composition root', () => {
  const MAIN_PATH = join(ROOT, 'packages', 'ui', 'src', 'main.ts');
  const mainSource = readFileSync(MAIN_PATH, 'utf8');

  it('does not import the deleted source registry', () => {
    assert.equal(mainSource.includes('sources.json'), false);
  });

  // The catalogue is fetched from public/ (docs/design/BUNDLED_CATALOGUE_API.md), never imported
  // as a module: a module import of a 10 MB JSON was served by vite as a 49 MB script (data +
  // inline source map) on every page load, typed in full by vue-tsc, and pulled into every
  // ts-morph program the architecture tests build.
  it('imports no JSON module and builds the two bundled repos', () => {
    assert.equal(/^import\b[^;]*\.json['"]/m.test(mainSource), false,
      'main.ts must not import a JSON module — the catalogue is fetched through the bundled repos');
    assert.ok(mainSource.includes('createBundledDriverRepo('), 'main.ts must build the bundled driver repo');
    assert.ok(mainSource.includes('createBundledPassiveRadiatorRepo('), 'main.ts must build the bundled passive-radiator repo');
  });
});

describe('the bundled catalogue artifacts', () => {
  it('are written under packages/ui/public/ so vite serves them as static files, and nothing under src/', () => {
    const bundler = readFileSync(join(ROOT, 'scripts', 'bundle-drivers.mjs'), 'utf8');
    assert.ok(bundler.includes("join(PUBLIC, 'drivers-index.json')"), 'bundle-drivers.mjs must write packages/ui/public/drivers-index.json');
    assert.ok(bundler.includes("join(PUBLIC, 'passive-radiators-index.json')"), 'bundle-drivers.mjs must write packages/ui/public/passive-radiators-index.json');
    assert.ok(bundler.includes("join(PUBLIC, 'drivers')"), 'bundle-drivers.mjs must write records under packages/ui/public/drivers/');
    assert.equal(existsSync(join(ROOT, 'packages', 'ui', 'src', 'drivers-bundle.json')), false,
      'packages/ui/src/drivers-bundle.json must not exist — the catalogue lives in public/');
    assert.equal(existsSync(join(ROOT, 'packages', 'ui', 'public', 'drivers-bundle.json')), false,
      'packages/ui/public/drivers-bundle.json must not exist — the catalogue is an index plus one file per record');
  });
});
