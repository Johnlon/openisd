/**
 * The bundled catalogue's INDEXES — docs/design/BUNDLED_CATALOGUE_API.md.
 *
 * `drivers-index.json` and `passive-radiators-index.json` are build artifacts: not knowable when
 * this code compiles, so their shape is checked on the way in, the way the old bundle's was.
 * The readers answer either the rows or every problem, each naming the row and the field, so a
 * bundler that drifts from the declared row is caught at the app's door — never as a picker that
 * lists `undefined` or a favourite that matches nothing.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readBundledDriverIndex } from '../src/repos/bundledDriverRepo.js';
import { readBundledPassiveRadiatorIndex } from '../src/repos/bundledPassiveRadiatorRepo.js';

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
