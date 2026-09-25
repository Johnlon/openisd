/**
 * The fetch-and-cache mechanism both bundled repos are built on — docs/design/BUNDLED_CATALOGUE_API.md "Mechanism".
 *
 * `createBundledRepo` fetches an index, resolves a uuid to its record path, fetches the record,
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

/** The row type under test — the base and nothing more; the mechanism reads only uuid and path. */
interface Row extends BundledIndexRow { readonly Fs_hz: number | null }

class Device {
  constructor(readonly uuid: string, readonly Fs_hz: number) {}
}

const row = (uuid: string, path: string): Row => ({
  uuid, path, name: path, dq: false, datasheet: null, productPage: null, listingPage: null, Fs_hz: 40,
});

const INDEX_URL = '/drivers-index.json';
const recordUrl = (path: string) => `/drivers/${path}.json`;

/** A stub server: url → JSON body, counting every fetch. */
function server(files: Record<string, unknown>) {
  const hits: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    hits.push(url);
    if (!(url in files)) return new Response('not here', { status: 404 });
    return new Response(JSON.stringify(files[url]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { hits, fetchImpl };
}

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

const A = row('aaaa', 'brand/a/openisd.yml');
const B = row('bbbb', 'brand/b/openisd.yml');

function repoOver(files: Record<string, unknown>, clock = { now: 0 }, maxAge_ms = 60_000) {
  const s = server(files);
  const repo = createBundledRepo<Row, Device>({
    fetch: s.fetchImpl, indexUrl: INDEX_URL, recordUrl, readIndex, construct, maxAge_ms, now: () => clock.now,
  });
  return { repo, hits: s.hits };
}

const CATALOGUE = {
  [INDEX_URL]: [A, B],
  [recordUrl(A.path)]: { uuid: 'aaaa', Fs_hz: 40 },
  [recordUrl(B.path)]: { uuid: 'bbbb', Fs_hz: 55 },
};

describe('createBundledRepo — index()', () => {
  it('fetches the index once and answers the same rows on every later call', async () => {
    const { repo, hits } = repoOver(CATALOGUE);
    const first = await repo.index();
    const second = await repo.index();
    assert.deepEqual(first.map(r => r.uuid), ['aaaa', 'bbbb']);
    assert.equal(first, second);
    assert.deepEqual(hits, [INDEX_URL]);
  });

  it('re-fetches the index once it is older than maxAge_ms', async () => {
    const clock = { now: 0 };
    const { repo, hits } = repoOver(CATALOGUE, clock, 1000);
    await repo.index();
    clock.now = 999;
    await repo.index();
    assert.equal(hits.filter(h => h === INDEX_URL).length, 1, 'refetched before the age was reached');
    clock.now = 1001;
    await repo.index();
    assert.equal(hits.filter(h => h === INDEX_URL).length, 2, 'did not refetch after the age was reached');
  });

  it('throws naming the URL and status when the index is not served', async () => {
    const { repo } = repoOver({});
    await assert.rejects(repo.index(), (e: Error) => e.message.includes(INDEX_URL) && e.message.includes('404'));
  });

  it('throws naming the URL and every problem when the index is malformed', async () => {
    const { repo } = repoOver({ [INDEX_URL]: { not: 'an array' } });
    await assert.rejects(repo.index(), (e: Error) => e.message.includes(INDEX_URL) && e.message.includes('stub: not an array'));
  });

  it('a failed fetch is not cached — the next call tries again', async () => {
    const files: Record<string, unknown> = {};
    const { repo, hits } = repoOver(files);
    await assert.rejects(repo.index());
    files[INDEX_URL] = [A];
    const rows = await repo.index();
    assert.equal(rows.length, 1);
    assert.equal(hits.length, 2);
  });
});

describe('createBundledRepo — load(uuid)', () => {
  it('fetches the record on a miss, constructs it through the seam, and returns the same instance on a hit', async () => {
    const { repo, hits } = repoOver(CATALOGUE);
    const first = await repo.load('bbbb');
    const second = await repo.load('bbbb');
    assert.ok(first instanceof Device);
    assert.equal(first.Fs_hz, 55);
    assert.equal(first, second, 'a hit must return the cached instance, not a new one');
    assert.deepEqual(hits, [INDEX_URL, recordUrl(B.path)]);
  });

  it('loads the index itself if nothing has asked for it yet', async () => {
    const { repo, hits } = repoOver(CATALOGUE);
    await repo.load('aaaa');
    assert.equal(hits[0], INDEX_URL);
  });

  it('a device expires after maxAge_ms and is fetched again', async () => {
    const clock = { now: 0 };
    const { repo, hits } = repoOver(CATALOGUE, clock, 1000);
    const first = await repo.load('aaaa');
    clock.now = 1001;
    const second = await repo.load('aaaa');
    assert.notEqual(first, second);
    assert.equal(hits.filter(h => h === recordUrl(A.path)).length, 2);
  });

  it('throws naming the uuid when it is not in the index', async () => {
    const { repo } = repoOver(CATALOGUE);
    await assert.rejects(repo.load('zzzz'), (e: Error) => e.message.includes('zzzz') && /not in the index/.test(e.message));
  });

  it('throws naming the record URL and status when the record is not served', async () => {
    const { repo } = repoOver({ [INDEX_URL]: [A] });
    await assert.rejects(repo.load('aaaa'), (e: Error) => e.message.includes(recordUrl(A.path)) && e.message.includes('404'));
  });

  it('throws naming the record URL and the seam\'s problems when the record is not a device', async () => {
    const { repo } = repoOver({ [INDEX_URL]: [A], [recordUrl(A.path)]: { junk: true } });
    await assert.rejects(repo.load('aaaa'),
      (e: Error) => e.message.includes(recordUrl(A.path)) && e.message.includes('stub seam: not a device'));
  });

  it('a failed load is not cached — the next call tries again', async () => {
    const files: Record<string, unknown> = { [INDEX_URL]: [A] };
    const { repo } = repoOver(files);
    await assert.rejects(repo.load('aaaa'));
    files[recordUrl(A.path)] = { uuid: 'aaaa', Fs_hz: 40 };
    const d = await repo.load('aaaa');
    assert.equal(d.Fs_hz, 40);
  });
});
