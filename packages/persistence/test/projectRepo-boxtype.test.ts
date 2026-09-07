/**
 * The stored box type is VALIDATED at the load boundary, never cast.
 *
 * `box.boxType` reaches this package as a raw string off disk, out of localStorage, or out of
 * a share link. `openISDProjectJsonSchema.safeParse()` — the one validator every door goes
 * through (`@openisd/design`'s `projectRepo().load()`) — refuses an unknown value rather than
 * letting an arbitrary string reach a switch whose cases are exhaustive only over the declared
 * `BoxType` members.
 *
 * bugs/BUG_20260828_stored_box_type_is_cast_not_parsed_so_an_unknown_string_reaches_the_simulation.md
 *
 * These drive the PUBLIC door (`readProjectText`) rather than the schema directly, so they
 * prove the refusal actually reaches a caller.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createProjectRepo } from '../src/repos/projectRepo.js';
import type { FileStorage } from '../src/storage/fileStorage.js';
import { newProject, conformingRecordToDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';

const engine = new Engine();

/** No file is ever written by these tests; the repo only needs the collaborator to exist. */
const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

function repo() {
  return createProjectRepo(engine, noFiles);
}

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'scraped', readings: { scraped: { read_value } } });

function driverJson() {
  return {
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs: spec(30), Qts: spec(0.4), Sd: spec(0.02), Cms: spec(0.0005),
        Mms: spec(0.05), Rms: spec(2), Xmax: spec(0.008),
      },
    },
  };
}

/** A valid record, sealed box, then a payload with `box.boxType` swapped for an arbitrary
 *  string — every OTHER field stays valid, so a refusal can only be about the box type. */
function payloadWithBoxType(boxType: string): unknown {
  const driver = conformingRecordToDriver(driverJson(), engine);
  if (Array.isArray(driver)) throw new Error('fixture driver record must conform: ' + driver.join('; '));
  const project = newProject(driver, engine).sealed().volume_m3(0.03).build();
  const record = JSON.parse(JSON.stringify(project.recordToPersist()));
  record.box.boxType = boxType;
  return record;
}

describe('a stored box type this build knows is restored', () => {
  it('restores a project stored as "sealed"', () => {
    const result = repo().readProjectText(JSON.stringify(payloadWithBoxType('sealed')));
    assert.ok(!Array.isArray(result), `sealed is a declared box type and must restore, got: ${result}`);
  });
});

describe('a stored box type this build does NOT know is refused, not cast', () => {
  for (const boxType of ['banana', '', 'PASSIVE-RADIATOR', 'bandpass8', 'passive-radiator', 'pr']) {
    it(`refuses ${JSON.stringify(boxType)} rather than letting it reach the simulation`, () => {
      const result = repo().readProjectText(JSON.stringify(payloadWithBoxType(boxType)));
      assert.ok(Array.isArray(result),
        `${JSON.stringify(boxType)} names no box type this build declares — restoring it would put `
        + 'an unknown string where every switch expects a declared member, and NaN on a chart');
    });
  }
});
