/**
 * The GitHub Actions suite splits the browser specs into shards by measured time
 * (scripts/shardSpecs.mjs). A spec must never be dropped or run twice, and a new spec with no
 * measured time still lands in a shard.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {durationsOf, shardSpecs} from '../../../../scripts/shardSpecs.mjs';

describe('shardSpecs', () => {
  const files = ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts', 'e.spec.ts'];
  const durations = {'a.spec.ts': 100, 'b.spec.ts': 60, 'c.spec.ts': 50, 'd.spec.ts': 40};

  it('puts every file in exactly one shard', () => {
    const shards = shardSpecs(files, durations, 3);
    assert.equal(shards.length, 3);
    assert.deepEqual(shards.flat().sort(), [...files].sort());
  });

  it('evens out the measured time: longest first, each into the shard with the least so far', () => {
    // e has no time, so it counts as the median (60): a 100 + c 50 = 150 against b 60 + e 60 + d 40 = 160.
    assert.deepEqual(shardSpecs(files, durations, 2), [['a.spec.ts', 'c.spec.ts'], ['b.spec.ts', 'e.spec.ts', 'd.spec.ts']]);
  });

  it('counts a file with no measured time as the median', () => {
    const shards = shardSpecs(['new.spec.ts', 'a.spec.ts'], {'a.spec.ts': 100}, 2);
    assert.deepEqual(shards.flat().sort(), ['a.spec.ts', 'new.spec.ts']);
  });

  it('gives the same split whatever order the files come in', () => {
    assert.deepEqual(shardSpecs([...files].reverse(), durations, 3), shardSpecs(files, durations, 3));
  });

  it('refuses a shard count that is not a whole number of at least 1', () => {
    assert.throws(() => shardSpecs(files, durations, 0), /at least 1/);
  });
});

describe('durationsOf', () => {
  it('adds up every result of every test, per file, from nested suites', () => {
    const report = {suites: [{suites: [{specs: [
      {file: 'x.spec.ts', tests: [{results: [{duration: 10}, {duration: 5}]}]},
      {file: 'y.spec.ts', tests: [{results: [{duration: 7}]}]},
    ]}], specs: [{file: 'x.spec.ts', tests: [{results: [{duration: 1}]}]}]}]};
    assert.deepEqual(durationsOf([report, report]), {'x.spec.ts': 32, 'y.spec.ts': 14});
  });
});
