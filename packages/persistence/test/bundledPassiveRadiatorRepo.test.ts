/**
 * The bundled passive-radiator repo — docs/design/BUNDLED_CATALOGUE_API.md "Passive radiators".
 *
 * `createBundledRepo` with the radiator data: `passive-radiators-index.json` under the app base,
 * read through the radiator shape reader, loading an OpenISDPassiveRadiatorStandalone. The
 * mechanism is proven in bundledRepo.test.ts. The index is a build artifact, so its shape is
 * checked on the way in, naming the row and the field of every problem.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import type {CatalogueBundle} from '../src/repos/catalogueBundle.js';
import {createBundledPassiveRadiatorRepo, readBundledPassiveRadiatorIndex} from '../src/repos/bundledPassiveRadiatorRepo.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

const driverRecord = OpenISDDriver.empty(engine).toOpenIsdDeviceJson();
const radiatorRecord = OpenISDPassiveRadiatorStandalone.empty().clonePassiveRadiator();

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

/** A bundle source holding the given radiator rows and records. */
function bundleOf(passiveRadiatorRows: unknown, passiveRadiators: Record<string, unknown>): () => Promise<CatalogueBundle> {
  return async () => ({ url: '/catalogue.json', build: 'b-test', driverRows: [], passiveRadiatorRows, drivers: {}, passiveRadiators });
}

describe('createBundledPassiveRadiatorRepo', () => {
  it('reads the radiator rows of the catalogue file and loads a record as an OpenISDPassiveRadiatorStandalone', async () => {
    const uuid = radiatorRecord.uuid.value;
    const repo = createBundledPassiveRadiatorRepo({
      bundle: bundleOf([{ ...radiatorRow, uuid, path: 'brand/pr' }], { [uuid]: radiatorRecord }), maxAge_ms: 60_000, now: () => 0,
    });
    const rows = await repo.index();
    assert.equal(rows[0].uuid, uuid);
    const pr = await repo.load(uuid);
    assert.ok(pr instanceof OpenISDPassiveRadiatorStandalone);
    assert.equal(pr.uuid(), uuid);
  });

  it('refuses a driver record through the radiator seam, naming the problem', async () => {
    const uuid = radiatorRecord.uuid.value;
    const repo = createBundledPassiveRadiatorRepo({
      bundle: bundleOf([{ ...radiatorRow, uuid, path: 'brand/pr' }], { [uuid]: driverRecord }), maxAge_ms: 60_000, now: () => 0,
    });
    await assert.rejects(repo.load(uuid), (e: Error) => /passive-radiator section/.test(e.message));
  });
});

describe('readBundledPassiveRadiatorIndex', () => {
  it('returns the rows of a well-formed index', () => {
    const out = readBundledPassiveRadiatorIndex([radiatorRow]);
    assert.ok('rows' in out);
    assert.deepEqual(out.rows, [radiatorRow]);
  });

  it('refuses a radiator row missing a radiator-only column, naming it', () => {
    const out = readBundledPassiveRadiatorIndex([driverRow]);
    assert.ok('problems' in out);
    assert.ok(out.problems.some(p => p.includes('[0].Mms_kg')), out.problems.join('\n'));
  });

  it('refuses a non-boolean dq', () => {
    const out = readBundledPassiveRadiatorIndex([{ ...radiatorRow, dq: 'no' }]);
    assert.ok('problems' in out);
    assert.ok(out.problems.some(p => p.includes('[0].dq')));
  });
});
