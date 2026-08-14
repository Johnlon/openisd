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

describe('OpenISDDriver — toDriver() (the resolved engine-ready bag, PLAN_OPENISD_TARGET_MIGRATION Step 7)', () => {
  it('resolves every stated field under its ENGINE name, with numVC defaulted to 1', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    const drv = d.toDriver();
    assert.ok(drv, 'Fs/Re/Sd/Vas + two Qs are all stated on the fixture — must resolve');
    assert.equal(drv!.Fs, 45.0);
    assert.equal(drv!.Re, 7.3);
    assert.equal(drv!.Bl, 8.5, 'the record spells it BL; the engine spells it Bl');
    assert.equal(drv!.numVC, 1, "WinISD's convention: one voice coil unless stated otherwise");
  });

  it('returns null when the required fields cannot all be resolved — the blocking-error ' +
     'contract (deriveDriver requires Fs/Re/Sd/Vas + two of the three Qs)', () => {
    const record = grs8fr8();
    // Strip every T/S field but Fs — nothing left to cross-derive Re/Sd/Vas/a second Q from.
    record.specs.woofer = { Fs: record.specs.woofer!.Fs };
    const d = OpenISDDriver.fromRecord(record);
    assert.equal(d.toDriver(), null);
  });
});

describe('OpenISDDriver — consistencyIssues()', () => {
  it('is empty for a fixture whose Q trio and Fs/Vas/Sd/Mms/Cms all agree', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    assert.deepEqual(d.consistencyIssues(), []);
  });

  it('flags a group whose entered members contradict each other beyond precision', () => {
    const record = grs8fr8();
    // Qts is already entered (0.56); entering a Qes that combines with the stated Qms to a
    // wildly different Qts than the one on file is exactly what checkConsistency exists to catch.
    const d = OpenISDDriver.fromRecord(record);
    d.enter('Qes', 20.0);
    const issues = d.consistencyIssues();
    assert.ok(issues.length > 0, 'Qts=0.56 on file vs. Qes=20/Qms=4.83 implying a very different Qts must be flagged');
  });
});

describe('OpenISDDriver — autoCalculate', () => {
  it('defaults to true — a derivable field reads C', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    assert.equal(d.autoCalculate, true);
    assert.equal(d.cell('Mms').state, 'E', 'Mms is stated on the fixture — E regardless');
    assert.equal(d.cell('Cms').state, 'E', 'Cms is also stated on the fixture — E regardless');
  });

  it('off: a field that is only derivable (never stated) reads N instead of C', () => {
    const record = grs8fr8();
    delete record.specs.woofer!.Rms;   // Rms is never stated on the fixture — only ever C
    const d = OpenISDDriver.fromRecord(record);
    assert.equal(d.cell('Rms').state, 'C', 'auto-calculate on (default): Rms solves from Fs/Mms/Qms');

    d.autoCalculate = false;
    assert.equal(d.cell('Rms').state, 'N', 'auto-calculate off: nothing solves, so an un-stated field is N');
  });

  it('toggling back on re-derives — the cache does not stick to the old mode', () => {
    const record = grs8fr8();
    delete record.specs.woofer!.Rms;
    const d = OpenISDDriver.fromRecord(record);
    d.autoCalculate = false;
    assert.equal(d.cell('Rms').state, 'N');
    d.autoCalculate = true;
    assert.equal(d.cell('Rms').state, 'C');
  });
});

describe('OpenISDDriver — metaCell()/enterMeta()/clearMeta() (brand/model/manufacturer, ' +
  'the ScrapedField envelope — QO36 B3/B4 apply the same way as a SpecEntry)', () => {
  it('metaCell() reads a stated ScrapedField as E, with its origin', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    const c = d.metaCell('brand');
    assert.equal(c.value, 'GRS');
    assert.equal(c.state, 'E');
    assert.equal(c.origin, 'manufacturer_product_page');
  });

  it('enterMeta() overwrites the value, sets origin: manual, and cell() reflects it', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enterMeta('model', '8FR-8X');
    const c = d.metaCell('model');
    assert.equal(c.value, '8FR-8X');
    assert.equal(c.state, 'E');
    assert.equal(c.origin, 'manual');
    assert.equal(d.toRecord().model.value, '8FR-8X');
  });

  it('enterMeta() with an empty string on a field never manually overridden is a no-op — ' +
     'you cannot blank away a stated fact, same as clear() on a non-manual SpecEntry', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enterMeta('model', '');
    const c = d.metaCell('model');
    assert.equal(c.value, '8FR-8');
    assert.equal(c.state, 'E');
    assert.equal(c.origin, 'manufacturer_product_page');
  });

  it('enterMeta() with an empty string, after a manual override, routes through clearMeta() ' +
     'and restores the pre-override value', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enterMeta('model', '8FR-8X');
    d.enterMeta('model', '');
    const c = d.metaCell('model');
    assert.equal(c.value, '8FR-8');
    assert.equal(c.origin, 'manufacturer_product_page');
  });

  it('clearMeta() restores the value and origin the field carried before the manual override', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.enterMeta('model', '8FR-8X');
    d.clearMeta('model');
    const c = d.metaCell('model');
    assert.equal(c.value, '8FR-8', 'reverts to the datasheet value, not blank');
    assert.equal(c.origin, 'manufacturer_product_page');
  });

  it('clearMeta() on a field never entered by hand does nothing', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    d.clearMeta('brand');
    const c = d.metaCell('brand');
    assert.equal(c.value, 'GRS');
    assert.equal(c.origin, 'manufacturer_product_page');
  });

  it('subscribe() fires on enterMeta()/clearMeta() the same as a numeric enter/clear', () => {
    const d = OpenISDDriver.fromRecord(grs8fr8());
    let calls = 0;
    d.subscribe(() => { calls++; });
    d.enterMeta('brand', 'GRS Audio');
    d.clearMeta('brand');
    assert.equal(calls, 2);
  });
});
