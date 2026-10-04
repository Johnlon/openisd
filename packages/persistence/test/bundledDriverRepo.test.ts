/**
 * The bundled driver repo — docs/design/BUNDLED_CATALOGUE_API.md "Drivers".
 *
 * `createBundledRepo` with the driver data: which index file, which shape reader, which domain
 * seam. The mechanism is proven in bundledRepo.test.ts; what these pin is the data — the URLs
 * are built on the app base the composition root hands in, the index goes through the driver
 * reader, and `load()` yields an OpenISDDriver from a real record.
 *
 * `drivers-index.json` is a build artifact: its shape is checked on the way in. The reader
 * answers either the rows or every problem, each naming the row and the field, so a bundler
 * that drifts from the declared row is caught at the app's door.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBundledDriverRepo, readBundledDriverIndex} from '../src/repos/bundledDriverRepo.js';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
const BASE = '/openisd/';

const driverRecord = OpenISDDriver.empty(engine).toOpenIsdDeviceJson();

const driverRow = {
  uuid: '04500ae1-56fb-488c-9bef-11482bafeb94',
  path: 'tang-band/w5-1138smf/openisd.yml',
  name: 'Tang Band W5-1138SMF',
  dq: false,
  datasheet: 'https://example.test/w5.pdf',
  productPage: null,
  listingPage: null,
  chips: ['woofer', 'sub'],
  canonical: 'Subwoofer',
  Fs_hz: 45,
  Sd_m2: 0.0075,
  Xmax_m: 0.0093,
  Vd_m3: null,
  Znom_ohm: 4,
};

const radiatorRow = {
  uuid: '1a2b3c4d-0000-4000-8000-000000000001',
  path: 'dayton-audio/nd140-pr/openisd.yml',
  name: 'Dayton Audio ND140-PR',
  dq: false,
  datasheet: null,
  productPage: 'https://example.test/nd140-pr',
  listingPage: null,
  Fs_hz: 44.2,
  Sd_m2: 0.00866,
  Xmax_m: null,
  Vd_m3: null,
  Mms_kg: 0.0164,
  Cms_m_per_N: null,
  Vas_m3: 0.0084,
  Qms: 4.02,
};

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

describe('createBundledDriverRepo', () => {
  it('reads drivers-index.json under the app base and loads a driver record as an OpenISDDriver', async () => {
    const s = server({
      [`${BASE}drivers-index.json`]: [{ ...driverRow, uuid: driverRecord.uuid.value, path: 'brand/drv/openisd.yml' }],
      [`${BASE}drivers/brand/drv/openisd.yml.json`]: driverRecord,
    });
    const repo = createBundledDriverRepo({ fetch: s.fetchImpl, baseUrl: BASE, engine, maxAge_ms: 60_000, now: () => 0 });
    const rows = await repo.index();
    assert.equal(rows[0].uuid, driverRecord.uuid.value);
    const driver = await repo.load(driverRecord.uuid.value);
    assert.ok(driver instanceof OpenISDDriver);
    assert.equal(driver.uuid(), driverRecord.uuid.value);
    assert.deepEqual(s.hits, [`${BASE}drivers-index.json`, `${BASE}drivers/brand/drv/openisd.yml.json`]);
  });

  it('refuses a radiator-shaped index through the driver reader, naming the missing column', async () => {
    const s = server({ [`${BASE}drivers-index.json`]: [radiatorRow] });
    const repo = createBundledDriverRepo({ fetch: s.fetchImpl, baseUrl: BASE, engine, maxAge_ms: 60_000, now: () => 0 });
    await assert.rejects(repo.index(), (e: Error) => e.message.includes('[0].chips'));
  });
});

describe('readBundledDriverIndex', () => {
  it('returns the rows of a well-formed index, every field carried through', () => {
    const out = readBundledDriverIndex([driverRow]);
    assert.ok('rows' in out);
    assert.deepEqual(out.rows, [driverRow]);
  });

  it('refuses a payload that is not an array', () => {
    const out = readBundledDriverIndex({ files: [] });
    assert.ok('problems' in out);
    assert.match(out.problems[0], /expected an array/);
  });

  it('names the row and the field for every problem, and reports them all', () => {
    const out = readBundledDriverIndex([
      { ...driverRow, uuid: 7 },
      { ...driverRow, Fs_hz: 'forty-five', chips: 'woofer' },
    ]);
    assert.ok('problems' in out);
    assert.ok(out.problems.some(p => p.includes('[0].uuid')), out.problems.join('\n'));
    assert.ok(out.problems.some(p => p.includes('[1].Fs_hz')), out.problems.join('\n'));
    assert.ok(out.problems.some(p => p.includes('[1].chips')), out.problems.join('\n'));
  });

  it('refuses a missing nullable field — absent is not null', () => {
    const { Vd_m3: _dropped, ...withoutVd } = driverRow;
    void _dropped;
    const out = readBundledDriverIndex([withoutVd]);
    assert.ok('problems' in out);
    assert.ok(out.problems.some(p => p.includes('[0].Vd_m3')));
  });

  it('refuses a driver row missing a driver-only column', () => {
    const out = readBundledDriverIndex([radiatorRow]);
    assert.ok('problems' in out);
    assert.ok(out.problems.some(p => p.includes('[0].chips')));
  });
});
