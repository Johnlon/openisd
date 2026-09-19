/**
 * The two bundled repos — docs/design/BUNDLED_CATALOGUE_API.md "Drivers" / "Passive radiators".
 *
 * Each is `createBundledRepo` with its own data: which index file, which shape reader, which
 * domain seam. The mechanism is proven in bundledRepo.test.ts; what these pin is the data — the
 * URLs are built on the app base the composition root hands in, the index goes through the
 * kind's own reader, and `load()` yields the kind's own domain object from a real record.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBundledDriverRepo} from '../src/repos/bundledDriverRepo.js';
import {createBundledPassiveRadiatorRepo} from '../src/repos/bundledPassiveRadiatorRepo.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {Engine} from '@openisd/design/engine';

const engine = new Engine();
const BASE = '/openisd/';

const driverRecord = OpenISDDriver.empty(engine).toOpenIsdDeviceJson();
const radiatorRecord = OpenISDPassiveRadiatorStandalone.empty(engine).clonePassiveRadiator();

const base = (uuid: string, path: string) =>
  ({ uuid, path, name: path, dq: true, datasheet: null, productPage: null, listingPage: null });
const driverRow = { ...base(driverRecord.uuid.value, 'brand/drv/openisd.yml'),
  chips: [], canonical: '', Fs_hz: null, Sd_m2: null, Xmax_m: null, Vd_m3: null, Znom_ohm: null };
const radiatorRow = { ...base(radiatorRecord.uuid.value, 'brand/pr/openisd.yml'),
  Fs_hz: null, Sd_m2: null, Xmax_m: null, Vd_m3: null, Mms_kg: null, Cms_m_per_N: null, Vas_m3: null, Qms: null };

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
      [`${BASE}drivers-index.json`]: [driverRow],
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

describe('createBundledPassiveRadiatorRepo', () => {
  it('reads passive-radiators-index.json under the app base and loads a radiator record as an OpenISDPassiveRadiatorStandalone', async () => {
    const s = server({
      [`${BASE}passive-radiators-index.json`]: [radiatorRow],
      [`${BASE}drivers/brand/pr/openisd.yml.json`]: radiatorRecord,
    });
    const repo = createBundledPassiveRadiatorRepo({ fetch: s.fetchImpl, baseUrl: BASE, engine, maxAge_ms: 60_000, now: () => 0 });
    const rows = await repo.index();
    assert.equal(rows[0].uuid, radiatorRecord.uuid.value);
    const pr = await repo.load(radiatorRecord.uuid.value);
    assert.ok(pr instanceof OpenISDPassiveRadiatorStandalone);
    assert.equal(pr.uuid(), radiatorRecord.uuid.value);
  });

  it('refuses a driver record through the radiator seam, naming the problem', async () => {
    const s = server({
      [`${BASE}passive-radiators-index.json`]: [radiatorRow],
      [`${BASE}drivers/brand/pr/openisd.yml.json`]: driverRecord,
    });
    const repo = createBundledPassiveRadiatorRepo({ fetch: s.fetchImpl, baseUrl: BASE, engine, maxAge_ms: 60_000, now: () => 0 });
    await assert.rejects(repo.load(radiatorRecord.uuid.value), (e: Error) => /passive-radiator section/.test(e.message));
  });
});
