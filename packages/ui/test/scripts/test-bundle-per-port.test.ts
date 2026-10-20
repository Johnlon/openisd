/**
 * T489 (load audit rows 8, 9): every concurrent browser run builds and serves its own test bundle, named by its
 * port like its dist dir, so a second run never empties the catalogue a first run is serving. The deterministic
 * `vite build` is not inside Playwright's webServer, whose timeout cannot be unbounded (0 means Playwright's 60 s):
 * the webServer only serves, with a finite timeout.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

interface ConfigView { bundleDir: string; build: string; command: string; timeout: number; }

function configFor(port: string): ConfigView {
  const script = `import('./playwright.config.js').then(m => process.stdout.write(JSON.stringify({
    bundleDir: m.TEST_BUNDLE_DIR, build: m.BUILD_TEST_APP, command: m.default.webServer.command, timeout: m.default.webServer.timeout })))`;
  const out = execFileSync('node', ['--input-type=module', '-e', script], {
    cwd: ROOT, env: {...process.env, OPENISD_TEST_PORT: port}, encoding: 'utf8',
  });
  return parseConfigView(JSON.parse(out));
}

function parseConfigView(raw: unknown): ConfigView {
  assert.ok(typeof raw === 'object' && raw !== null, 'config view is an object');
  const field = (key: string): unknown => Reflect.get(raw, key);
  const text = (key: string): string => {
    const v = field(key);
    assert.ok(typeof v === 'string', `${key} is a string`);
    return v;
  };
  const timeout = field('timeout');
  assert.ok(typeof timeout === 'number', 'timeout is a number');
  return {bundleDir: text('bundleDir'), build: text('build'), command: text('command'), timeout};
}

describe('the browser run builds one test bundle per port', () => {
  it('two ports give two bundle dirs, each used by its own builder and server', () => {
    const a = configFor('4111');
    const b = configFor('4112');
    assert.equal(a.bundleDir, 'build/test-bundle-4111');
    assert.equal(b.bundleDir, 'build/test-bundle-4112');
    assert.notEqual(a.bundleDir, b.bundleDir);
    assert.ok(a.build.includes('scripts/test-bundle.mjs build/test-bundle-4111 '));
    assert.ok(a.command.includes('OPENISD_DRIVERS_BUNDLE_DIR=build/test-bundle-4111 '));
    assert.ok(!/build\/test-bundle(?!-)/.test(a.command), 'no shared build/test-bundle left');
  });

  it('the build is not inside the webServer, whose start timeout is finite', () => {
    const c = configFor('4113');
    assert.ok(!c.command.includes('vite build'), 'webServer command must not build');
    assert.ok(!c.command.includes('test-bundle.mjs'), 'webServer command must not cut the bundle');
    assert.ok(c.command.includes('vite preview'));
    assert.ok(c.build.includes('vite build'));
    assert.ok(c.timeout > 0);
  });
});
