/** Stored-data corpus (SDLC S4): bundled driver records, shard 0 of 4; see storedCorpus.test.ts. */
import {expect, it} from 'vitest';
import {bundledDriverShard, refusedDrivers} from './corpusFiles.js';

it('every bundled driver record of shard 0 of 4 parses', () => {
  const files = bundledDriverShard(0, 4);
  expect(files.length).toBeGreaterThan(0);
  expect(refusedDrivers(files)).toEqual([]);
}, 600_000);
