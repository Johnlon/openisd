import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// QO380 decision A: the installed app works offline, so the service worker precaches the whole
// bundled catalogue with the app shell. Reads the precache manifest of a real production build.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CATALOGUE_DIR = path.join(ROOT, 'packages', 'ui', 'public');

let out = '';
let precached: Set<string>;
let swText = '';

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
  swText = sw;
  precached = new Set([...sw.matchAll(/"?url"?:\s*"([^"]+)"/g)].map(m => m[1] ?? ''));
}, 180_000);

afterAll(() => { fs.rmSync(out, {recursive: true, force: true}); });

interface Bundle { build: string; driverRows: unknown[]; passiveRadiatorRows: unknown[]; drivers: Record<string, unknown>; passiveRadiators: Record<string, unknown> }
const parseJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));
function readBundle(): Bundle {
  const b = parseJson(path.join(out, 'catalogue.json'));
  if (typeof b !== 'object' || b === null || !('build' in b) || !('driverRows' in b) || !('passiveRadiatorRows' in b) || !('drivers' in b) || !('passiveRadiators' in b)) {
    throw new Error('catalogue.json is not a catalogue');
  }
  const {build, driverRows, passiveRadiatorRows, drivers, passiveRadiators} = b;
  if (typeof build !== 'string' || !Array.isArray(driverRows) || !Array.isArray(passiveRadiatorRows)
      || typeof drivers !== 'object' || drivers === null || typeof passiveRadiators !== 'object' || passiveRadiators === null) {
    throw new Error('catalogue.json has the wrong shape');
  }
  return {build, driverRows, passiveRadiatorRows, drivers: Object.fromEntries(Object.entries(drivers)), passiveRadiators: Object.fromEntries(Object.entries(passiveRadiators))};
}
function uuidOf(row: unknown): string {
  if (typeof row === 'object' && row !== null && 'uuid' in row && typeof row.uuid === 'string') return row.uuid;
  throw new Error('a catalogue row has no uuid');
}
function specsOf(record: unknown): object {
  return typeof record === 'object' && record !== null && 'specs' in record && typeof record.specs === 'object' && record.specs !== null ? record.specs : {};
}

describe('service worker precache manifest', () => {
  it('holds the catalogue as ONE entry and no per-record or index entries', () => {
    expect(precached.has('catalogue.json')).toBe(true);
    expect([...precached].filter(u => u.startsWith('drivers/') || u.endsWith('-index.json'))).toEqual([]);
  });

  it('precaches the catalogue bytes the build wrote (revision is the file\'s hash)', () => {
    const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(out, 'catalogue.json'))).digest('hex');
    expect(swText).toContain(md5);
  });

  it('still holds every shell file (js, css, html, svg, ico) the build emitted', () => {
    const shell = filesUnder(out).filter(f => /\.(js|css|html|svg|ico)$/.test(f) && f !== 'sw.js' && !/^workbox-[^/]+\.js$/.test(f));
    expect(shell.length).toBeGreaterThan(5);
    expect(shell.filter(f => !precached.has(f))).toEqual([]);
  });

  it('ships no per-record file or index beside the catalogue', () => {
    expect(fs.existsSync(path.join(out, 'drivers'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'drivers-index.json'))).toBe(false);
  });
});

describe('the catalogue file', () => {
  it('carries the build id and holds exactly what its rows list: a record for every row, a row for every record', () => {
    const b = readBundle();
    expect(b.build).toBe('v-sw-precache-test');
    expect(b.driverRows.map(uuidOf).sort()).toEqual(Object.keys(b.drivers).sort());
    expect(b.passiveRadiatorRows.map(uuidOf).sort()).toEqual(Object.keys(b.passiveRadiators).sort());
    expect(b.driverRows.length).toBeGreaterThan(1000);
    expect(b.passiveRadiatorRows.length).toBeGreaterThan(50);
  });

  it('holds the E150HE-PR radiator and a driver, and every public/ record that has a woofer or passive-radiator section', () => {
    const b = readBundle();
    const expected = filesUnder(path.join(CATALOGUE_DIR, 'drivers')).filter(f => f.endsWith('.json')).filter(f => {
      const specs = specsOf(parseJson(path.join(CATALOGUE_DIR, 'drivers', f)));
      return 'woofer' in specs || 'passive-radiator' in specs;
    });
    expect(Object.keys(b.drivers).length + Object.keys(b.passiveRadiators).length).toBe(expected.length);
    expect(b.passiveRadiatorRows.some(r => JSON.stringify(b.passiveRadiators[uuidOf(r)]).includes('E150HE-PR'))).toBe(true);
  });
});
