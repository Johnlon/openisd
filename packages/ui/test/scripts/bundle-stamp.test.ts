/**
 * `scripts/bundleStamp.mjs` — the fingerprint `bundle-drivers.mjs` uses to skip a rebuild when
 * nothing it depends on has changed. What it pins: the same inputs give the same stamp whatever
 * their order, and any change to a path, a modification time or a size gives a different one —
 * so a stale skip cannot happen for an edit the stat list can see.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {bundleFingerprint, BundleInput} from '../../../../scripts/bundleStamp.mjs';

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
