/** The one catalogue file: opened only by the app of the build that wrote it; fetched once. */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {CatalogueBuildMismatch, createCatalogueSource, parseCatalogueBundle} from '../src/repos/catalogueBundle.js';

const URL = '/catalogue.json';
const file = (build: unknown) => ({ build, driverRows: [], passiveRadiatorRows: [], drivers: { a: { x: 1 } }, passiveRadiators: {} });

describe('parseCatalogueBundle', () => {
  it('opens a catalogue of the app\'s own build', () => {
    const b = parseCatalogueBundle(file('b2'), URL, 'b2');
    assert.deepEqual(b.drivers, { a: { x: 1 } });
    assert.equal(b.build, 'b2');
  });

  it('refuses another build, naming the file and both builds', () => {
    assert.throws(() => parseCatalogueBundle(file('b2'), URL, 'b1'), (e: unknown) =>
      e instanceof CatalogueBuildMismatch && e.message.includes(URL) && e.message.includes('build b2') && e.message.includes('build b1')
      && e.catalogueBuild === 'b2' && e.appBuild === 'b1');
  });

  it('refuses a file with no build stamp (an array, null, text, a non-string stamp)', () => {
    for (const bare of [[], null, 'text', file(7), { drivers: {}, passiveRadiators: {} }]) {
      assert.throws(() => parseCatalogueBundle(bare, URL, 'b1'), (e: unknown) =>
        e instanceof CatalogueBuildMismatch && e.catalogueBuild === null && e.message.includes('no build stamp'));
    }
  });

  it('refuses a stamped file without the two record maps', () => {
    assert.throws(() => parseCatalogueBundle({ build: 'b1' }, URL, 'b1'), /no drivers \/ passiveRadiators map/);
  });
});

describe('createCatalogueSource', () => {
  const served = (body: unknown, hits: string[]): typeof fetch => async (input) => {
    hits.push(String(input));
    return new Response(JSON.stringify(body), { status: 200 });
  };

  it('fetches once for concurrent and later callers, and again once older than maxAge_ms', async () => {
    const hits: string[] = [];
    const clock = { now: 0 };
    const get = createCatalogueSource({ fetch: served(file('b1'), hits), url: URL, build: 'b1', maxAge_ms: 1000, now: () => clock.now });
    const [a, b] = await Promise.all([get(), get()]);
    assert.equal(a, b);
    await get();
    assert.deepEqual(hits, [URL]);
    clock.now = 1001;
    await get();
    assert.equal(hits.length, 2);
  });

  it('refuses another build\'s file and does not hold the refusal', async () => {
    const hits: string[] = [];
    const get = createCatalogueSource({ fetch: served(file('older'), hits), url: URL, build: 'b1', maxAge_ms: 1000, now: () => 0 });
    await assert.rejects(get(), CatalogueBuildMismatch);
    await assert.rejects(get(), CatalogueBuildMismatch);
    assert.equal(hits.length, 2);
  });

  it('throws naming the file and status when it is not served', async () => {
    const get = createCatalogueSource({ fetch: async () => new Response('no', { status: 404 }), url: URL, build: 'b1', maxAge_ms: 1, now: () => 0 });
    await assert.rejects(get(), (e: Error) => e.message.includes(URL) && e.message.includes('404'));
  });

  it('calls fetch detached, as the browser requires (a method call throws "Illegal invocation")', async () => {
    function strictFetch(this: unknown): Promise<Response> {
      if (this !== undefined) return Promise.reject(new TypeError('Illegal invocation'));
      return Promise.resolve(new Response(JSON.stringify(file('b1'))));
    }
    const get = createCatalogueSource({ fetch: strictFetch, url: URL, build: 'b1', maxAge_ms: 1, now: () => 0 });
    assert.equal((await get()).build, 'b1');
  });
});
