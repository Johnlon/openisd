/**
 * John, 2026-11-16: "we can't take away drivers for no good reasons". A record whose sibling
 * driver.json says `"discontinued": true` IS in the bundled catalogue, its index row carries
 * `discontinued: true` ("disc flag is important"), and a flag change changes the bundle fingerprint.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDiscontinued} from '../../../../scripts/discontinuedFlag.mjs';
import {bundleFingerprintOnDisk} from '../../../../scripts/bundleStamp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SNAPSHOT = join(ROOT, 'packages/design/test/fixtures/driver-snapshot');

function corpusWith(flags: Record<string, string | undefined>): string {
  const corpus = mkdtempSync(join(tmpdir(), 'discontinued-corpus-'));
  for (const [path, driverJson] of Object.entries(flags)) {
    mkdirSync(join(corpus, path), {recursive: true});
    if (driverJson !== undefined) writeFileSync(join(corpus, path, 'driver.json'), driverJson);
  }
  return corpus;
}

describe('isDiscontinued', () => {
  it('is true only for a top-level boolean true in driver.json', () => {
    const c = corpusWith({
      'a/gone': '{"discontinued": true}',
      'a/live': '{"discontinued": false}',
      'a/absent': '{"model": "x"}',
      'a/nested': '{"specs": {"discontinued": true}}',
      'a/string': '{"discontinued": "true"}',
      'a/broken': '{not json',
      'a/nofile': undefined,
    });
    try {
      assert.equal(isDiscontinued(join(c, 'a/gone')), true);
      for (const k of ['live', 'absent', 'nested', 'string', 'broken', 'nofile']) {
        assert.equal(isDiscontinued(join(c, 'a', k)), false, k);
      }
    } finally { rmSync(c, {recursive: true, force: true}); }
  });
});

describe('bundle fingerprint covers the discontinued flag', () => {
  it('changes when a record becomes discontinued', () => {
    const c = corpusWith({'a/x': '{"discontinued": false}'});
    try {
      writeFileSync(join(c, 'a/x/openisd.json'), '{}');
      const before = bundleFingerprintOnDisk(ROOT, c);
      writeFileSync(join(c, 'a/x/driver.json'), '{"discontinued": true}');
      assert.notEqual(bundleFingerprintOnDisk(ROOT, c), before);
    } finally { rmSync(c, {recursive: true, force: true}); }
  });
});

describe('bundle-drivers.mjs bundles discontinued records and keeps the flag', () => {
  it('lists the live and the discontinued record, each with its record file and its flag', {timeout: 120_000}, () => {
    const corpus = mkdtempSync(join(tmpdir(), 'discontinued-bundle-'));
    const work = mkdtempSync(join(tmpdir(), 'discontinued-root-'));
    try {
      for (const [dest, flag] of [['live/one', false], ['gone/two', true]] as const) {
        mkdirSync(join(corpus, dest), {recursive: true});
        cpSync(join(SNAPSHOT, 'dayton-audio/da215-8/openisd.json'), join(corpus, dest, 'openisd.json'));
        writeFileSync(join(corpus, dest, 'driver.json'), JSON.stringify({discontinued: flag}));
      }
      const r = spawnSync('npx', ['tsx', join(ROOT, 'scripts/bundle-drivers.mjs'), '--corpus', corpus, '--force', '--public', join(work, 'public')], {encoding: 'utf8'});
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.match(r.stdout, /1 discontinued/);
      const parsed: unknown = JSON.parse(readFileSync(join(work, 'public/drivers-index.json'), 'utf8'));
      assert.ok(Array.isArray(parsed));
      const flags: Record<string, unknown> = {};
      for (const row of parsed.map((r2: unknown) => r2)) {
        assert.ok(typeof row === 'object' && row !== null && 'path' in row && typeof row.path === 'string' && 'discontinued' in row);
        flags[row.path] = row.discontinued;
      }
      assert.deepEqual(flags, {'live/one': false, 'gone/two': true});
      assert.equal(existsSync(join(work, 'public/drivers/live/one.json')), true);
      assert.equal(existsSync(join(work, 'public/drivers/gone/two.json')), true);
    } finally {
      rmSync(corpus, {recursive: true, force: true});
      rmSync(work, {recursive: true, force: true});
    }
  });
});

describe('the tracked catalogue keeps every discontinued record, flagged', () => {
  const PUBLIC = join(ROOT, 'packages/ui/public');
  const readRows = (file: string): {path: string; discontinued: unknown}[] => {
    const parsed: unknown = JSON.parse(readFileSync(join(PUBLIC, file), 'utf8'));
    assert.ok(Array.isArray(parsed));
    return parsed.map((row: unknown) => {
      assert.ok(typeof row === 'object' && row !== null && 'path' in row && typeof row.path === 'string' && 'discontinued' in row, `row without path/discontinued in ${file}`);
      return {path: row.path, discontinued: row.discontinued};
    });
  };

  it('every row states discontinued as a boolean', () => {
    for (const row of [...readRows('drivers-index.json'), ...readRows('passive-radiators-index.json')]) {
      assert.equal(typeof row.discontinued, 'boolean', row.path);
    }
  });

  it('the 101 drivers T717 removed (70 Visaton, 31 Faital Pro) are listed, each flagged discontinued', () => {
    const flagged = readRows('drivers-index.json').filter(r => r.discontinued === true);
    assert.equal(flagged.length, 101);
    assert.equal(flagged.filter(r => r.path.startsWith('visaton/')).length, 70);
    assert.equal(flagged.filter(r => r.path.startsWith('faitalpro/')).length, 31);
    for (const r of flagged) assert.equal(existsSync(join(PUBLIC, 'drivers', `${r.path}.json`)), true, r.path);
  });

  it('the Visaton PR 250 is listed as a passive radiator and flagged discontinued', () => {
    const flagged = readRows('passive-radiators-index.json').filter(r => r.discontinued === true);
    assert.deepEqual(flagged.map(r => r.path), ['visaton/pr-250']);
  });
});
