/**
 * bugs/archive/BUG_20260822_share_links_and_file_imports_bypass_the_schema_upgrade.md — every reader
 * of a persisted payload upgrades it. The V1→V2 step converts the driver slot from a record
 * OBJECT to the managed layer's serialised TEXT; a V1 share link must arrive upgraded.
 */
import {afterAll, describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createProjectRepo} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {createEngine} from '@openisd/design/engine';

/** A picker that is never reached — these tests exercise the link and text doors only. */
const noFilePicker: FileStorage = {
  save: async () => ({ name: null, cancelled: true, written: false }),
  saveAs: async () => ({ name: null, cancelled: true, written: false }),
  openFileName: () => null,
  forget: () => {},
};
const repo = createProjectRepo(createEngine(), noFilePicker, createMemoryStorage(), 'http://localhost');

/** A conforming driver RECORD — the form a driver takes inside a serialised payload. Every key
 *  the schema requires is present; the values are deliberately synthetic, since these tests are
 *  about what survives the wire, not about any driver's physics. */
function sampleDriverRecord(): unknown {
  return {
    brand: {value: 'test'}, model: {value: 'test'}, manufacturer: {value: 'test'},
    uuid: {value: '00000000-0000-4000-8000-000000000000'}, driver_type: {value: 'woofer'},
    sku: {value: 'test', grounds: [{origin: 'manual', reading: 'test'}]},
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    data_sources: {value: {}},
    specs: { woofer: {
      Fs_hz:  { state: 'E', value: 30, origin: 'entered', readings: { entered: { read_value: 30 } } },
      Vas_m3: { state: 'E', value: 0.05, origin: 'entered', readings: { entered: { read_value: 0.05 } } },
      Sd_m2:  { state: 'E', value: 0.02, origin: 'entered', readings: { entered: { read_value: 0.02 } } },
    } }
  };
}

describe('projectSchemaUpgrade — persisted-payload readers upgrade the schema (V1 driver-object → V2 driver-text)', () => {
  afterAll(() => vi.unstubAllGlobals());

  it('a V1 payload loaded via the HASH path comes back at the current schema, driver as text', async () => {
    const v1 = {
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-fixture', creator: '', created: '', modified: '', description: '' },
      driver: sampleDriverRecord(),
    };
    // Encoded with Node's zlib, independent of the app's own CompressionStream path — this
    // checks what a real browser-produced link would decode to, not the app agreeing with itself.
    const encoded = gzipSync(Buffer.from(JSON.stringify(v1), 'utf8'))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    vi.stubGlobal('location', { hash: '#s=' + encoded, origin: 'https://openisd.test', pathname: '/' });

    const loaded = await repo.loadFromHash();
    if (Array.isArray(loaded)) throw new Error(`the V1 payload was refused: ${loaded.join('; ')}`);
    assert.ok(loaded, 'a V1 payload must load, upgraded — not be refused');
    assert.ok(loaded.project.driver, 'the V1→V2 step serialises the driver slot, and the repo adopts it');
    const d = loaded.project.driver;
    assert.equal(d.specs.Fs_hz.entered, true,
      'the upgraded driver is the same record — provenance intact');
  });

  it('readProjectText is the same seam File → Open uses — V1 object slot loads a driver', () => {
    const upgraded = repo.readProjectText(JSON.stringify({
      schema: 1, v: 2, box: 'sealed', P: {}, graphs: [],
      project: { name: 'v1-file', creator: '', created: '', modified: '', description: '' },
      driver: sampleDriverRecord(),
    }));
    if (Array.isArray(upgraded)) throw new Error(`the V1 payload was refused: ${upgraded.join('; ')}`);
    assert.ok(upgraded);
    assert.ok(upgraded!.driver);
  });
});
