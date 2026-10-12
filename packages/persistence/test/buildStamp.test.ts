import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {BuildStamp, createBuildStamp} from '../src/repos/buildStamp.js';

describe('build stamp', () => {
  it('cuts a baked build version to the minute', () => {
    assert.equal(createBuildStamp('v20260301T040506Z').text, 'v20260301T0405Z');
    assert.equal(createBuildStamp('v20260301T0405Z').text, 'v20260301T0405Z');
  });

  it('a build with no baked version (dev server, tests) is dev', () => {
    assert.equal(createBuildStamp(''), BuildStamp.DEV);
    assert.equal(createBuildStamp('not a version'), BuildStamp.DEV);
  });

  it('a store records none, or garbage, as an unknown build', () => {
    assert.equal(BuildStamp.ofStored(null), BuildStamp.UNKNOWN);
    assert.equal(BuildStamp.ofStored('garbage'), BuildStamp.UNKNOWN);
    assert.equal(BuildStamp.ofStored('vdev'), BuildStamp.DEV);
    assert.equal(BuildStamp.ofStored('v20260101T0101Z').text, 'v20260101T0101Z');
  });
});
