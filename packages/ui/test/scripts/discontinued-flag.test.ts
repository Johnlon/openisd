/**
 * QO450 (John: "hide"): a record whose sibling driver.json says `"discontinued": true` is left
 * out of the bundled catalogue, and a flag change changes the bundle fingerprint.
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

describe('bundle-drivers.mjs leaves discontinued records out', () => {
  it('bundles the live record and drops the discontinued one (no index row, no record file)', {timeout: 120_000}, () => {
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
      const paths = parsed.map((row: unknown) => (typeof row === 'object' && row !== null && 'path' in row ? row.path : null));
      assert.deepEqual(paths, ['live/one']);
      assert.equal(existsSync(join(work, 'public/drivers/live/one.json')), true);
      assert.equal(existsSync(join(work, 'public/drivers/gone/two.json')), false);
    } finally {
      rmSync(corpus, {recursive: true, force: true});
      rmSync(work, {recursive: true, force: true});
    }
  });
});
