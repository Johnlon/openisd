/**
 * `OpenISDDriver` — the stateful driver model the app holds (ARCHITECTURE.md AD-8,
 * docs/plans/PLAN_OPENISD_DRIVER_MODEL.md Phase 1).
 *
 * Seam under test: the public API — `fromRecord`, `enter`, `clear`, `cell`, `errors`,
 * `consistencyIssues`, `toRecord`, `subscribe`. Nothing reaches inside; every assertion
 * goes through one of those or through the record `toRecord()` hands back, which is the
 * `.owdr` bytes and therefore a genuine public surface.
 *
 * Fixture: `fixtures/openisd/8fr-8.openisd.yml` — a REAL pipeline-emitted record (GRS 8FR-8,
 * Parts Express product page), not a hand-written approximation. Its `driver_type` is
 * `full-range`, so it also exercises the section mapping (everything that is not a tweeter
 * or a passive radiator reads `specs.woofer`).
 *
 * Expected values come from independent sources: the closed-form Q combination
 * (Qts = Qes·Qms/(Qes+Qms)), the Rms relation (Rms = 2π·Fs·Mms/Qms), and the two human
 * rulings recorded in ledger QO36 — never from the code under test.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { OpenISDDriver } from '../src/openisdDriver.js';
import { fromYaml } from '../src/openisdYaml.js';
import type { OpenISDRecord } from '../src/openisdRecord.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'openisd');

/** A fresh copy of the real GRS 8FR-8 record for every test. */
function grs8fr8(): OpenISDRecord {
  return fromYaml(readFileSync(join(FIXTURES, '8fr-8.openisd.yml'), 'utf8'));
}

describe('OpenISDDriver — enter() writes a manual-origin reading (QO36 ruling B3)', () => {
  it('enter() on a field the record does not carry marks it E with the entered value', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    assert.equal(d.cell('Rms').state, 'C', 'Rms is not in the record — it is solved, so C');

    d.enter('Rms', 2.75);

    const c = d.cell('Rms');
    assert.equal(c.value, 2.75);
    assert.equal(c.state, 'E');
  });

  it('the entry it writes carries origin: manual, and the value under readings.manual', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enter('Rms', 2.75);

    const entry = d.toRecord().specs.woofer?.Rms;
    assert.ok(entry, 'Rms must now be present in specs.woofer');
    assert.equal(entry.origin, 'manual');
    assert.equal(entry.readings.manual?.read_value, 2.75);
  });

  it('OMITS read_precision and actual_reading — there was no printed literal to echo and no ' +
     'stated precision, so synthesising either would fabricate provenance (QO36 B3)', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enter('Rms', 2.75);

    const reading = d.toRecord().specs.woofer?.Rms?.readings.manual;
    assert.ok(reading);
    assert.ok(!('read_precision' in reading),
      'read_precision must be ABSENT, not 0 and not null — nothing stated a precision');
    assert.ok(!('actual_reading' in reading),
      'actual_reading must be ABSENT, not "" — no source text exists for a typed value');
  });

  it('overwriting a datasheet-sourced field replaces its origin with manual, keeping ONE ' +
     'reading shape — no second envelope for hand entry', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    assert.equal(d.toRecord().specs.woofer?.Fs?.origin, 'manufacturer_product_page');

    d.enter('Fs', 41.5);

    const entry = d.toRecord().specs.woofer?.Fs;
    assert.ok(entry);
    assert.equal(entry.origin, 'manual');
    assert.equal(entry.readings.manual?.read_value, 41.5);
    assert.equal(d.cell('Fs').value, 41.5);
  });
});
