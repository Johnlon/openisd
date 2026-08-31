// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// /**
//  * `OpenISDDriver` — the stateful driver model the app holds
//  * (docs/plans/PLAN_OPENISD_DRIVER_MODEL.md Phase 1).
//  *
//  * Seam under test: the public API — `fromRecord`, `enter`, `clear`, `cell`, `errors`,
//  * `consistencyIssues`, `toRecord`. Nothing reaches inside; every assertion
//  * goes through one of those or through the record `toRecord()` hands back, which is the
//  * `.owdr` bytes and therefore a genuine public surface.
//  *
//  * Fixture: `fixtures/openisd/8fr-8.openisd.yml` — a REAL pipeline-emitted record (GRS 8FR-8,
//  * Parts Express product page), not a hand-written approximation. Its `driver_type` is
//  * `full-range`, so it also exercises the section mapping (everything that is not a tweeter
//  * or a passive radiator reads `specs.woofer`).
//  *
//  * Expected values come from independent sources: the closed-form Q combination
//  * (Qts = Qes·Qms/(Qes+Qms)), the Rms relation (Rms = 2π·Fs·Mms/Qms), and the two human
//  * rulings recorded in ledger QO36 — never from the code under test.
//  */
// import { describe, it } from 'vitest';
// import { Provenance } from '@openisd/model';
// import assert from 'node:assert/strict';
// import { readFileSync } from 'node:fs';
// import { fileURLToPath } from 'node:url';
// import { dirname, join } from 'node:path';
//
// import { parse } from 'yaml';
// import { OpenISDDriver } from '../src/openisdDriver.js';
//
// const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'openisd');
//
// /** A fresh copy of the real GRS 8FR-8 record for every test — the plain record, not a
//  *  driver, since several tests mutate it before constructing one. */
// function grs8fr8() {
//   return OpenISDDriver.fromJsonRecord(parse(readFileSync(join(FIXTURES, '8fr-8.openisd.yml'), 'utf8'))).toJsonRecord();
// }
//
// describe('OpenISDDriver — enter() writes a manual-origin reading (QO36 ruling B3)', () => {
//   it('enter() on a field the record does not carry marks it E with the entered value', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     assert.equal(d.RmsCell().state, Provenance.Calculated, 'Rms is not in the record — it is solved, so C');
//
//     d.enterRms(2.75);
//
//     const c = d.RmsCell();
//     assert.equal(c.value, 2.75);
//     assert.equal(c.state, Provenance.Entered);
//   });
//
//   it('the entry it writes carries origin: manual, and the value under readings.manual', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterRms(2.75);
//
//     const entry = d.toJsonRecord().specs.woofer?.Rms;
//     assert.ok(entry, 'Rms must now be present in specs.woofer');
//     assert.equal(entry.origin, 'manual');
//     assert.equal(entry.readings.manual?.read_value, 2.75);
//   });
//
//   it('OMITS read_precision and actual_reading — there was no printed literal to echo and no ' +
//      'stated precision, so synthesising either would fabricate provenance (QO36 B3)', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterRms(2.75);
//
//     const reading = d.toJsonRecord().specs.woofer?.Rms?.readings.manual;
//     assert.ok(reading);
//     assert.ok(!('read_precision' in reading),
//       'read_precision must be ABSENT, not 0 and not null — nothing stated a precision');
//     assert.ok(!('actual_reading' in reading),
//       'actual_reading must be ABSENT, not "" — no source text exists for a typed value');
//   });
//
//   it('overwriting a datasheet-sourced field replaces its origin with manual, keeping ONE ' +
//      'reading shape — no second envelope for hand entry', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     assert.equal(d.toJsonRecord().specs.woofer?.Fs?.origin, 'manufacturer_product_page');
//
//     d.enterFs(41.5);
//
//     const entry = d.toJsonRecord().specs.woofer?.Fs;
//     assert.ok(entry);
//     assert.equal(entry.origin, 'manual');
//     assert.equal(entry.readings.manual?.read_value, 41.5);
//     assert.equal(d.FsCell().value, 41.5);
//   });
// });
//
// describe('OpenISDDriver — toDriver() (the resolved engine-ready bag, PLAN_OPENISD_TARGET_MIGRATION Step 7)', () => {
//   it('resolves every stated field under its ENGINE name, with numVC defaulted to 1', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     const drv = d.toDriver();
//     assert.ok(drv, 'Fs/Re/Sd/Vas + two Qs are all stated on the fixture — must resolve');
//     assert.equal(drv!.Fs, 45.0);
//     assert.equal(drv!.Re, 7.3);
//     assert.equal(drv!.BL, 8.5);
//     assert.equal(drv!.numVC, 1, "WinISD's convention: one voice coil unless stated otherwise");
//   });
//
//   it('returns null when the required fields cannot all be resolved — the blocking-error ' +
//      'contract (deriveEngineDriver requires Fs/Re/Sd/Vas + two of the three Qs)', () => {
//     const record = grs8fr8();
//     // Strip every T/S field but Fs — nothing left to cross-derive Re/Sd/Vas/a second Q from.
//     record.specs.woofer = { Fs: record.specs.woofer!.Fs };
//     const d = OpenISDDriver.fromJsonRecord(record);
//     assert.equal(d.toDriver(), null);
//   });
// });
//
// describe('OpenISDDriver — consistencyIssues()', () => {
//   it('is empty for a fixture whose Q trio and Fs/Vas/Sd/Mms/Cms all agree', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     assert.deepEqual(d.consistencyIssues(), []);
//   });
//
//   it('flags a group whose entered members contradict each other beyond precision', () => {
//     const record = grs8fr8();
//     // Qts is already entered (0.56); entering a Qes that combines with the stated Qms to a
//     // wildly different Qts than the one on file is exactly what checkConsistency exists to catch.
//     const d = OpenISDDriver.fromJsonRecord(record);
//     d.enterQes(20.0);
//     const issues = d.consistencyIssues();
//     assert.ok(issues.length > 0, 'Qts=0.56 on file vs. Qes=20/Qms=4.83 implying a very different Qts must be flagged');
//   });
// });
//
// describe('OpenISDDriver — autoCalculate', () => {
//   it('defaults to true — a derivable field reads C', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     assert.equal(d.autoCalculate, true);
//     assert.equal(d.MmsCell().state, Provenance.Entered, 'Mms is stated on the fixture — E regardless');
//     assert.equal(d.CmsCell().state, Provenance.Entered, 'Cms is also stated on the fixture — E regardless');
//   });
//
//   it('off: a field that is only derivable (never stated) reads N instead of C', () => {
//     const record = grs8fr8();
//     delete record.specs.woofer!.Rms;   // Rms is never stated on the fixture — only ever C
//     const d = OpenISDDriver.fromJsonRecord(record);
//     assert.equal(d.RmsCell().state, Provenance.Calculated, 'auto-calculate on (default): Rms solves from Fs/Mms/Qms');
//
//     d.autoCalculate = false;
//     assert.equal(d.RmsCell().state, Provenance.NotAvailable, 'auto-calculate off: nothing solves, so an un-stated field is N');
//   });
//
//   it('toggling back on re-derives — the cache does not stick to the old mode', () => {
//     const record = grs8fr8();
//     delete record.specs.woofer!.Rms;
//     const d = OpenISDDriver.fromJsonRecord(record);
//     d.autoCalculate = false;
//     assert.equal(d.RmsCell().state, Provenance.NotAvailable);
//     d.autoCalculate = true;
//     assert.equal(d.RmsCell().state, Provenance.Calculated);
//   });
// });
//
// describe('OpenISDDriver — metaCell()/enterMeta()/clearMeta() (brand/model/manufacturer, ' +
//   'the ScrapedField envelope — QO36 B3/B4 apply the same way as a SpecEntry)', () => {
//   it('metaCell() reads a stated ScrapedField as E, with its origin', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     const c = d.brandCell();
//     assert.equal(c.value, 'GRS');
//     assert.equal(c.state, Provenance.Entered);
//     assert.equal(c.origin, 'manufacturer_product_page');
//   });
//
//   it('enterMeta() overwrites the value, sets origin: manual, and cell() reflects it', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterModel('8FR-8X');
//     const c = d.modelCell();
//     assert.equal(c.value, '8FR-8X');
//     assert.equal(c.state, Provenance.Entered);
//     assert.equal(c.origin, 'manual');
//     assert.equal(d.toJsonRecord().model.value, '8FR-8X');
//   });
//
//   it('enterMeta() with an empty string on a field never manually overridden is a no-op — ' +
//      'you cannot blank away a stated fact, same as clear() on a non-manual SpecEntry', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterModel('');
//     const c = d.modelCell();
//     assert.equal(c.value, '8FR-8');
//     assert.equal(c.state, Provenance.Entered);
//     assert.equal(c.origin, 'manufacturer_product_page');
//   });
//
//   it('enterMeta() with an empty string, after a manual override, routes through clearMeta() ' +
//      'and restores the pre-override value', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterModel('8FR-8X');
//     d.enterModel('');
//     const c = d.modelCell();
//     assert.equal(c.value, '8FR-8');
//     assert.equal(c.origin, 'manufacturer_product_page');
//   });
//
//   it('clearMeta() restores the value and origin the field carried before the manual override', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.enterModel('8FR-8X');
//     d.clearModel();
//     const c = d.modelCell();
//     assert.equal(c.value, '8FR-8', 'reverts to the datasheet value, not blank');
//     assert.equal(c.origin, 'manufacturer_product_page');
//   });
//
//   it('clearMeta() on a field never entered by hand does nothing', () => {
//     const d = OpenISDDriver.fromJsonRecord(grs8fr8());
//     d.clearBrand();
//     const c = d.brandCell();
//     assert.equal(c.value, 'GRS');
//     assert.equal(c.origin, 'manufacturer_product_page');
//   });
// });
//
// describe('OpenISDDriver — a driver TYPE and a specs SECTION KEY are two vocabularies, mapped', () => {
//   it('driver_type "passive-radiator" reads the passive-radiator section — the type value is ' +
//      'kebab like every other member, the section key is the emitting model\'s field name and ' +
//      'so cannot carry a hyphen; sectionFor maps between them', () => {
//     const record = grs8fr8();
//     record.driver_type.value = 'passive-radiator';
//     record.specs = { 'passive-radiator': { Fs: record.specs.woofer!.Fs } };
//     const d = OpenISDDriver.fromJsonRecord(record);
//     assert.equal(d.section, 'passive-radiator');
//     assert.equal(d.FsCell().value, 45.0);
//   });
//
//   it('driver_type "amt" reads the tweeter section — the emitter files AMT specs under ' +
//      'specs.tweeter (spec_emit.py: "HF transducers file under specs.tweeter"), and the two ' +
//      'sides share one section convention ' +
//      '(BUG_20260822_sectionfor_sends_amt_records_to_the_empty_woofer_section)', () => {
//     const record = grs8fr8();
//     record.driver_type.value = 'amt';
//     record.specs = { tweeter: { Re: record.specs.woofer!.Re } };
//     const d = OpenISDDriver.fromJsonRecord(record);
//     assert.equal(d.section, 'tweeter');
//     assert.equal(d.ReCell().value, 7.3);
//   });
//
//   it('an undeclared driver_type falls back to the woofer section, so a value stated under ' +
//      'specs.passive-radiator reads not-available ' +
//      '(BUG_20260821_sectionfor_cannot_distinguish_invalid_driver_type_from_woofer: this is a ' +
//      'silent fallback, not a refusal — an undeclared value takes the same branch as every ' +
//      'legitimately-woofer driver type)', () => {
//     const record = grs8fr8();
//     record.driver_type.value = 'qwertyuiop';
//     record.specs = { 'passive-radiator': { Fs: record.specs.woofer!.Fs } };
//     const d = OpenISDDriver.fromJsonRecord(record);
//     assert.equal(d.section, 'woofer');
//     assert.equal(d.FsCell().value, null);
//   });
// });
//
// describe('OpenISDDriver.fromFileText — parses the format it is TOLD, never one it guesses ' +
//          '(QO83/QO67: classification is the caller\'s job, via fileFormat.ts)', () => {
//   it('format "wdr" parses .wdr text, whatever the caller\'s classification came from', () => {
//     const original = OpenISDDriver.fromJsonRecord(grs8fr8());
//     const { value: wdrText, errors: wdrErrors } = original.toWdrText();
//     assert.deepEqual(wdrErrors, []);
//     const { value: driver, errors } = OpenISDDriver.fromFileText(wdrText!, 'wdr');
//     assert.deepEqual(errors, []);
//     assert.equal(driver!.FsCell().value, original.FsCell().value);
//   });
//
//   it('format "owdr" parses .owdr (YAML) text', () => {
//     const original = OpenISDDriver.fromJsonRecord(grs8fr8());
//     const { value: driver, errors } = OpenISDDriver.fromFileText(original.toOwdrYml(), 'owdr');
//     assert.deepEqual(errors, []);
//     assert.equal(driver!.FsCell().value, original.FsCell().value);
//   });
//
//   it('format "owdr" against text that is not valid YAML returns an error, never throws', () => {
//     const { value, errors } = OpenISDDriver.fromFileText(': : : not yaml : :', 'owdr');
//     assert.equal(value, null);
//     assert.ok(errors[0]?.message.length);
//   });
// });
//
// describe('OpenISDDriver.fromOwdrYml()/toOwdrYml() — the openisd.yml-serialised twin of ' +
//          'fromOwdrJson()/toOwdrJson() (QO84: "Text" is ambiguous about format)', () => {
//   const REAL_OPENISD_YML = join(
//     dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..',
//     'winisd_drivers', 'db', 'datasheets', 'accuton', 'bd90-6-727', 'openisd.yml',
//   );
//
//   it('round-trips a real corpus record: fromOwdrYml(text).toOwdrYml() parses back to the same ' +
//      'data the input yaml parsed to', () => {
//     const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');
//     const original = parse(yamlText);
//
//     const reserialised = OpenISDDriver.fromOwdrYml(yamlText).toOwdrYml();
//
//     assert.deepEqual(parse(reserialised), original);
//   });
//
//   it('toOwdrYml() produces genuine YAML, not the internal .owdr JSON text relabelled', () => {
//     const yamlText = readFileSync(REAL_OPENISD_YML, 'utf8');
//     const reserialised = OpenISDDriver.fromOwdrYml(yamlText).toOwdrYml();
//
//     // yaml's stringify() emits block-style YAML (unquoted keys, no braces) for a record this
//     // shape, so the text is not valid JSON — proving toOwdrYml() really is stringify() output,
//     // not toOwdrJson()'s JSON text handed back under a different name.
//     assert.throws(() => JSON.parse(reserialised),
//       'toOwdrYml() output must not be parseable as JSON — it must be genuine YAML');
//   });
//
//   it('rejects malformed YAML syntax cleanly (throws, does not silently drop data)', () => {
//     assert.throws(() => OpenISDDriver.fromOwdrYml(': : : not yaml : :'));
//   });
//
//   it('rejects a shape fromJsonRecord already rejects — a document that does not parse to a ' +
//      'record object', () => {
//     assert.throws(() => OpenISDDriver.fromOwdrYml('null'));
//   });
// });
//