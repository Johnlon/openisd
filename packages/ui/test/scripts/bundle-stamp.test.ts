/**
 * `scripts/bundleStamp.mjs` — the fingerprint `bundle-drivers.mjs` uses to skip a rebuild when
 * nothing it depends on has changed. What it pins: the same inputs give the same stamp whatever
 * their order, and any change to a path, a modification time or a size gives a different one —
 * so a stale skip cannot happen for an edit the stat list can see.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as stamp from '../../../../scripts/bundleStamp.mjs';
import {bundleFingerprint, BundleInput} from '../../../../scripts/bundleStamp.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'scripts');

const a = new BundleInput('tang-band/w5-1138smf/openisd.yml', 1000, 2048);
const b = new BundleInput('dayton-audio/nd140-pr/openisd.yml', 2000, 4096);

describe('bundleFingerprint', () => {
  it('is the same for the same inputs in any order', () => {
    assert.equal(bundleFingerprint([a, b]), bundleFingerprint([b, a]));
  });

  it('changes when a file is modified, resized, added or renamed', () => {
    const base = bundleFingerprint([a, b]);
    assert.notEqual(bundleFingerprint([new BundleInput(a.path, a.mtimeMs + 1, a.size), b]), base, 'mtime');
    assert.notEqual(bundleFingerprint([new BundleInput(a.path, a.mtimeMs, a.size + 1), b]), base, 'size');
    assert.notEqual(bundleFingerprint([a, b, new BundleInput('x/y/openisd.yml', 1, 1)]), base, 'added');
    assert.notEqual(bundleFingerprint([new BundleInput('renamed/openisd.yml', a.mtimeMs, a.size), b]), base, 'renamed');
  });
});

describe('no implicit corpus path', () => {
  it('bundleStamp.mjs names no corpus location', () => {
    assert.equal('CORPUS_RELATIVE' in stamp, false);
    assert.equal(stamp.corpusPresent.length, 1, 'corpusPresent takes the corpus dir');
    assert.equal(stamp.bundleFingerprintOnDisk.length, 2, 'bundleFingerprintOnDisk takes root and corpus dir');
  });

  it('bundle-drivers.mjs refuses to run without --corpus and points at the sync script', {timeout: 60_000}, () => {
    const r = spawnSync('npx', ['tsx', join(SCRIPTS, 'bundle-drivers.mjs')], {encoding: 'utf8'});
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--corpus/);
    assert.match(r.stderr, /sync-driver-snapshot\.sh/);
  });

  it('bundle-drivers-if-changed.mjs only checks the committed outputs exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'bundle-if-changed-'));
    try {
      mkdirSync(join(root, 'scripts'));
      for (const f of ['bundle-drivers-if-changed.mjs', 'bundleStamp.mjs']) cpSync(join(SCRIPTS, f), join(root, 'scripts', f));
      const run = () => spawnSync('node', [join(root, 'scripts', 'bundle-drivers-if-changed.mjs')], {encoding: 'utf8'});
      const missing = run();
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /committed catalogue/);
      mkdirSync(join(root, 'packages/ui/public/drivers'), {recursive: true});
      writeFileSync(join(root, 'packages/ui/public/drivers-index.json'), '[]');
      writeFileSync(join(root, 'packages/ui/public/passive-radiators-index.json'), '[]');
      assert.equal(run().status, 0);
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
});
