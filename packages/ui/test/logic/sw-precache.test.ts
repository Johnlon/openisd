import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// QO380 decision A: the installed app works offline, so the service worker precaches the whole
// bundled catalogue with the app shell. Reads the precache manifest of a real production build.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CATALOGUE_DIR = path.join(ROOT, 'packages', 'ui', 'public');

let out = '';
let precached: Set<string>;

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)).map(f => `${e.name}/${f}`) : [e.name]);
}

beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-precache-'));
  execFileSync('node_modules/.bin/vite', ['build', '--mode', 'production', '--outDir', out, '--emptyOutDir'], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'],
    env: {...process.env, OPENISD_RELATIVE_BASE: '1', OPENISD_BUILD_VERSION: 'v-sw-precache-test'},
  });
  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  precached = new Set([...sw.matchAll(/"?url"?:\s*"([^"]+)"/g)].map(m => m[1] ?? ''));
}, 180_000);

afterAll(() => { fs.rmSync(out, {recursive: true, force: true}); });

describe('service worker precache manifest', () => {
  it('holds both catalogue indexes', () => {
    expect(precached.has('drivers-index.json')).toBe(true);
    expect(precached.has('passive-radiators-index.json')).toBe(true);
  });

  it('holds the E150HE-PR record and a driver record', () => {
    expect(precached.has('drivers/dayton-audio/e150he-pr.json')).toBe(true);
    const driver = filesUnder(path.join(CATALOGUE_DIR, 'drivers')).find(f => f.endsWith('.json') && !f.includes('-pr.json'));
    expect(driver).toBeDefined();
    expect(precached.has(`drivers/${driver}`)).toBe(true);
  });

  it('holds every catalogue record', () => {
    const missing = filesUnder(path.join(CATALOGUE_DIR, 'drivers')).filter(f => f.endsWith('.json') && !precached.has(`drivers/${f}`));
    expect(missing).toEqual([]);
  });

  it('still holds every shell file (js, css, html, svg, ico) the build emitted', () => {
    const shell = filesUnder(out).filter(f => /\.(js|css|html|svg|ico)$/.test(f)
      && !f.startsWith('drivers/') && f !== 'sw.js' && !/^workbox-[^/]+\.js$/.test(f));
    expect(shell.length).toBeGreaterThan(5);
    expect(shell.filter(f => !precached.has(f))).toEqual([]);
  });
});
