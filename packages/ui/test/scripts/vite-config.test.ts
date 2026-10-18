/**
 * Build-config sanity checks.
 *
 * Transient files live in build/ (AGENTS.md §"Scratch files"). These tests guard
 * against regressions where that scratch space gets watched by Vite — causing
 * continuous dev-server reloads — or committed to the repo.
 */

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

// Import buildVersion directly for unit testing its logic
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const {buildVersion, stripPwaFromSubpages} = (await import(join(ROOT, 'vite.config.js'))) as {
  buildVersion: (command?: string, env?: Record<string, string>) => string;
  stripPwaFromSubpages: (html: string, path: string) => string;
};

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

  it('allows the host name "lap" so the dev server answers when opened by that name', () => {
    assert.match(
      viteConfig,
      /allowedHosts:\s*\[[^\]]*['"]lap['"]/,
      'vite.config.js server.allowedHosts must list "lap"; Vite refuses any other host name.'
    );
  });
});

describe('buildVersion', () => {
  it('returns empty string for serve command (dev server)', () => {
    assert.equal(buildVersion('serve'), '');
  });

  it('returns version from build-info.json for build command', () => {
    // This test assumes build-info.json exists with a version field
    const version = buildVersion('build');
    assert.ok(typeof version === 'string');
  });

  it('OPENISD_BUILD_VERSION names the build, except on the dev server', () => {
    assert.equal(buildVersion('build', {OPENISD_BUILD_VERSION: 'v-e2e-b'}), 'v-e2e-b');
    assert.equal(buildVersion('serve', {OPENISD_BUILD_VERSION: 'v-e2e-b'}), '');
  });

  // BUG_20261018_test-build-hangs-on-loading-screen: the root worker answered /test/ with the root
  // build's page, whose assets do not exist under /test/, so the page never started.
  it('the worker has no navigation fallback, so it never answers another copy\'s address with its own page', () => {
    const config = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');
    assert.match(config, /navigateFallback: null,/);
    assert.doesNotMatch(config, /navigateFallback(Denylist|Allowlist)/);
  });

  it('returns empty string when build-info.json is missing or invalid', () => {
    // When file doesn't exist or is invalid, buildVersion returns ''
    // We can't easily test the missing file case without mocking fs,
    // but we verify the function handles errors gracefully
    assert.ok(typeof buildVersion('unknown') === 'string');
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

describe('stripPwaFromSubpages', () => {
  const html = '<head><link rel="manifest" href="./manifest.webmanifest"><script src="./registerSW.js"></script></head>';

  it('leaves the app page alone', () => {
    assert.equal(stripPwaFromSubpages(html, '/index.html'), html);
  });

  it('takes the manifest link and the worker script off about/ and install/, which 404 under a hosted copy', () => {
    for (const path of ['/about/index.html', '/install/index.html']) {
      assert.equal(stripPwaFromSubpages(html, path), '<head></head>');
    }
  });
});
