/**
 * The fetch-and-cache mechanism both bundled repos are built on — docs/design/BUNDLED_CATALOGUE_API.md "Mechanism".
 *
 * `createBundledRepo` reads an index, resolves a uuid to its record path, fetches the record,
 * constructs the device through the domain seam it was handed, and caches it. Both bundled repos
 * (drivers, passive radiators) are this with different data, so the behaviour is proven here once, over a stub fetch and a stub seam — no network, no domain.
 *
 * What it pins: the index is fetched once and re-fetched after `maxAge_ms`; `load()` returns the
 * SAME instance on a hit and fetches once on a miss; a device also expires after `maxAge_ms`
 * (John, 2026-09-14: "I don't want the ui caching for ever"); and every failure — unknown uuid,
 * a file not served, a seam refusal, a malformed index — throws naming its cause.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBundledRepo} from '../src/repos/bundledRepo.js';
import type {BundledIndexRow, IndexRead} from '../src/repos/bundledIndex.js';
import type {CatalogueBundle} from '../src/repos/catalogueBundle.js';

/** The row type under test — the base and nothing more; the mechanism reads only uuid and path. */
interface Row extends BundledIndexRow { readonly Fs_hz: number | null }

class Device {
  constructor(readonly uuid: string, readonly Fs_hz: number) {}
}

const row = (uuid: string, path: string): Row => ({
  uuid, path, name: path, dq: false, datasheet: null, productPage: null, listingPage: null, Fs_hz: 40,
});

const URL = '/catalogue.json';

/** The reader under test never refuses — the readers' own tests cover refusal. */
const readIndex = (json: unknown): IndexRead<Row> =>
  Array.isArray(json) ? { rows: json } : { problems: ['stub: not an array'] };

const construct = (record: unknown): Device | string[] => {
  if (typeof record === 'object' && record !== null && 'uuid' in record && 'Fs_hz' in record
      && typeof record.uuid === 'string' && typeof record.Fs_hz === 'number') {
    return new Device(record.uuid, record.Fs_hz);
  }
  return ['stub seam: not a device'];
};

const A = row('aaaa', 'brand/a');
const B = row('bbbb', 'brand/b');

interface Content { driverRows: unknown; drivers: Record<string, unknown> }
const CATALOGUE: Content = {
  driverRows: [A, B],
  drivers: { aaaa: { uuid: 'aaaa', Fs_hz: 40 }, bbbb: { uuid: 'bbbb', Fs_hz: 55 } },
};

/** The repo over a stub bundle source, counting how often the source is asked. */
function repoOver(content: Content, clock = { now: 0 }, maxAge_ms = 60_000) {
  const reads = { n: 0 };
  const repo = createBundledRepo<Row, Device>({
    bundle: async (): Promise<CatalogueBundle> => {
      reads.n++;
      return { url: URL, build: 'b', driverRows: content.driverRows, passiveRadiatorRows: [], drivers: content.drivers, passiveRadiators: {} };
    },
    indexOf: b => b.driverRows,
    recordsOf: b => b.drivers,
    readIndex, construct, maxAge_ms, now: () => clock.now,
  });
  return { repo, reads };
}

describe('createBundledRepo — index()', () => {
  it('reads the index once and answers the same rows on every later call', async () => {
    const { repo, reads } = repoOver(CATALOGUE);
    const first = await repo.index();
    const second = await repo.index();
    assert.deepEqual(first.map(r => r.uuid), ['aaaa', 'bbbb']);
    assert.equal(first, second);
    assert.equal(reads.n, 1);
  });

  it('reads the index again once it is older than maxAge_ms', async () => {
    const clock = { now: 0 };
    const { repo, reads } = repoOver(CATALOGUE, clock, 1000);
    await repo.index();
    clock.now = 999;
    await repo.index();
    assert.equal(reads.n, 1, 'read again before the age was reached');
    clock.now = 1001;
    await repo.index();
    assert.equal(reads.n, 2, 'did not read again after the age was reached');
  });

  it('throws naming the file and every problem when the index is malformed', async () => {
    const { repo } = repoOver({ driverRows: { not: 'an array' }, drivers: {} });
    await assert.rejects(repo.index(), (e: Error) => e.message.includes(URL) && e.message.includes('stub: not an array'));
  });
});

describe('createBundledRepo — load(uuid)', () => {
  it('constructs the record through the seam and returns the same instance on a hit', async () => {
    const { repo } = repoOver(CATALOGUE);
    const first = await repo.load('bbbb');
    const second = await repo.load('bbbb');
    assert.ok(first instanceof Device);
    assert.equal(first.Fs_hz, 55);
    assert.equal(first, second, 'a hit must return the cached instance, not a new one');
  });

  it('a device expires after maxAge_ms and is constructed again', async () => {
    const clock = { now: 0 };
    const { repo } = repoOver(CATALOGUE, clock, 1000);
    const first = await repo.load('aaaa');
    clock.now = 1001;
    const second = await repo.load('aaaa');
    assert.notEqual(first, second);
  });

  it('throws naming the uuid when it is not in the index', async () => {
    const { repo } = repoOver(CATALOGUE);
    await assert.rejects(repo.load('zzzz'), (e: Error) => e.message.includes('zzzz') && /not in the index/.test(e.message));
  });

  it('throws naming the row and the uuid when the index lists a record the bundle does not hold', async () => {
    const { repo } = repoOver({ driverRows: [A], drivers: {} });
    await assert.rejects(repo.load('aaaa'), (e: Error) => e.message.includes(A.path) && e.message.includes('aaaa') && e.message.includes('no record'));
  });

  it('throws naming the row and the seam\'s problems when the record is not a device', async () => {
    const { repo } = repoOver({ driverRows: [A], drivers: { aaaa: { junk: true } } });
    await assert.rejects(repo.load('aaaa'), (e: Error) => e.message.includes(A.path) && e.message.includes('stub seam: not a device'));
  });
});
