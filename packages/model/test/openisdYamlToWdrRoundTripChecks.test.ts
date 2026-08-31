// PACKAGE DECOMMISSIONED — John Lonergan, 2026-08-31: "I don't want to discuss the model package
// any more unless we are borrowing a concept from it - immediately comment out all code in that
// package".
//
// Every line below is commented out. The package exports nothing and compiles to nothing. It is
// kept, rather than deleted, ONLY as a reference to borrow a concept from while
// docs/plans/PLAN_DELETE_PACKAGES_MODEL.md moves the app onto packages/design. Delete the
// directory once that plan is finished.

// /**
//  * `openisdYamlToWdr`'s baked-in self-validation — `packages/model/src/openisdYamlToWdr.ts`'s
//  * `ymlRoundTripErrors` and `wdrRoundTripErrors`, run on every call in addition to the normal
//  * `.wdr` projection: this is the ONE function `winisd_tools` calls per corpus record, and its
//  * `errors` array is the caller's ENTIRE signal — no separate comparison happens outside this
//  * function any more. See that file's own docstring for the full scoping rationale (why
//  * `yml-round-trip` tolerates nothing and `wdr-round-trip` is scoped to `INI_ROWS`-tracked,
//  * originally-`Entered` fields only — `.wdr` was never designed to carry the rest of an
//  * openisd.yml record, so comparing more than that manufactures false positives, not real
//  * defects).
//  *
//  * This suite proves: (a) real, representable data survives both checks with no noise; (b) data
//  * a format cannot carry at all (a non-`INI_ROWS` spec field, for the `.wdr` leg) is silently
//  * outside scope, not a false positive; (c) each detector actually fires on a genuine loss — a
//  * non-finite entered value defeats BOTH legs independently (`JSON.stringify(Infinity)` becomes
//  * `null` for the yml leg; `OpenISDDriver.toWinISDDriver()` drops it to the `.wdr` default for
//  * the wdr leg) — proving these are real, reachable detectors, not checks that can never trip;
//  * (d) the external contract is unchanged — `value` is still the fresh, correct `.wdr`
//  * projection even when both checks report a problem with it; (e) `wdr-round-trip` compares
//  * `Provenance.Calculated` `INI_ROWS` fields too, not only `Entered` ones — see this file's own
//  * docstring for why that is safe (every field that can feed `deriveOpenISDFields` is itself an
//  * `INI_ROWS` member, so the Entered-field agreement already proven is the solver's entire
//  * input set) — confirmed against 1970 real corpus records (`winisd_drivers/db/datasheets`) with
//  * zero `wdr-round-trip` errors from this widened scope.
//  */
// import { describe, it } from 'vitest';
// import assert from 'node:assert/strict';
// import { parse } from 'yaml';
// import { openisdYamlToWdr } from '../src/openisdYamlToWdr.js';
// import { OpenISDDriver, Provenance } from '../src/openisdDriver.js';
//
// describe('openisdYamlToWdr — baked-in yml-round-trip and wdr-round-trip self-validation', () => {
//   it('a real record with both an INI_ROWS-tracked spec field and a non-WDR spec field round-trips ' +
//      'both checks clean: no yml-round-trip or wdr-round-trip errors', () => {
//     const record = `
// uuid: {value: u1, definition: d}
// quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
// manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
// brand: {value: Acme, origin: manual, definition: d, dq: []}
// model: {value: Widget, origin: manual, definition: d, dq: []}
// sku: {value: acme-widget, definition: d, grounds: []}
// driver_type: {value: woofer, origin: manual, definition: d, dq: []}
// data_sources: {value: {}, definition: d}
// authoritative: {value: manual, definition: d}
// specs:
//   woofer:
//     Fs: {origin: manual, readings: {manual: {read_value: 45}}, dq: []}
//     Re: {origin: manual, readings: {manual: {read_value: 3.4}}, dq: []}
//     freq_low_hz: {origin: manual, readings: {manual: {read_value: 25}}, dq: []}
// `;
//     const { value, errors } = openisdYamlToWdr(record);
//     assert.notEqual(value, null);
//     assert.deepEqual(errors.filter(e => e.field === 'yml-round-trip'), []);
//     assert.deepEqual(errors.filter(e => e.field.startsWith('wdr-round-trip')), []);
//   });
//
//   it('a driver_type of passive-radiator still self-checks correctly on the wdr leg — .wdr always ' +
//      'reads its specs back under a woofer section, and the check must not be fooled by that into ' +
//      'a false positive', () => {
//     const record = `
// uuid: {value: u1, definition: d}
// quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
// manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
// brand: {value: Acme, origin: manual, definition: d, dq: []}
// model: {value: Widget PR, origin: manual, definition: d, dq: []}
// sku: {value: acme-widget-pr, definition: d, grounds: []}
// driver_type: {value: passive-radiator, origin: manual, definition: d, dq: []}
// data_sources: {value: {}, definition: d}
// authoritative: {value: manual, definition: d}
// specs:
//   passive-radiator:
//     Fs: {origin: manual, readings: {manual: {read_value: 33}}, dq: []}
//     Vas: {origin: manual, readings: {manual: {read_value: 0.027}}, dq: []}
// `;
//     const { value, errors } = openisdYamlToWdr(record);
//     assert.notEqual(value, null);
//     assert.deepEqual(errors.filter(e => e.field.startsWith('wdr-round-trip')), []);
//   });
//
//   it('a genuinely lossy entered value (non-finite Fs) is caught on BOTH legs independently, in ' +
//      'ADDITION to the projection\'s own non-finite warning — no error is lost, and the external ' +
//      'contract (a fresh, valid .wdr) is unchanged', () => {
//     const record = `
// uuid: {value: u1, definition: d}
// quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
// manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
// brand: {value: Acme, origin: manual, definition: d, dq: []}
// model: {value: Widget, origin: manual, definition: d, dq: []}
// sku: {value: acme-widget, definition: d, grounds: []}
// driver_type: {value: woofer, origin: manual, definition: d, dq: []}
// data_sources: {value: {}, definition: d}
// authoritative: {value: manual, definition: d}
// specs:
//   woofer:
//     Fs: {origin: manual, readings: {manual: {read_value: .inf}}, dq: []}
// `;
//     const { value, errors } = openisdYamlToWdr(record);
//     // External contract unchanged: a fresh, valid .wdr is still returned.
//     assert.notEqual(value, null);
//     assert.equal(value!.startsWith('[Driver]'), true);
//
//     const ymlRoundTrip = errors.filter(e => e.field === 'yml-round-trip');
//     assert.equal(ymlRoundTrip.length, 1);
//     assert.equal(ymlRoundTrip[0].level, 'error');
//     assert.match(ymlRoundTrip[0].message, /Fs.*read_value/);
//
//     const wdrRoundTrip = errors.filter(e => e.field.startsWith('wdr-round-trip'));
//     assert.equal(wdrRoundTrip.length, 1);
//     assert.equal(wdrRoundTrip[0].field, 'wdr-round-trip:Fs');
//     assert.equal(wdrRoundTrip[0].level, 'error');
//
//     // The normal projection's own non-finite warning is still present too.
//     assert.equal(errors.some(e => e.field === 'Fs' && e.level === 'warn'), true);
//   });
//
//   it('a record with no entered INI_ROWS fields at all (only computed/absent) never fires the wdr-round-trip check', () => {
//     const record = `
// uuid: {value: u1, definition: d}
// quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
// manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
// brand: {value: Acme, origin: manual, definition: d, dq: []}
// model: {value: Widget, origin: manual, definition: d, dq: []}
// sku: {value: acme-widget, definition: d, grounds: []}
// driver_type: {value: woofer, origin: manual, definition: d, dq: []}
// data_sources: {value: {}, definition: d}
// authoritative: {value: manual, definition: d}
// specs: {woofer: {}}
// `;
//     const { value, errors } = openisdYamlToWdr(record);
//     assert.notEqual(value, null);
//     assert.deepEqual(errors.filter(e => e.field.startsWith('wdr-round-trip')), []);
//     assert.deepEqual(errors.filter(e => e.field === 'yml-round-trip'), []);
//   });
//
//   it('a Calculated INI_ROWS field (Rme, derived from entered Fs/Mms/Qes) is actually compared, ' +
//      'not skipped, and round-trips clean — proving the widened scope executes on a genuinely ' +
//      'Calculated field rather than being a no-op change', () => {
//     const record = `
// uuid: {value: u1, definition: d}
// quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
// manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
// brand: {value: Acme, origin: manual, definition: d, dq: []}
// model: {value: Widget, origin: manual, definition: d, dq: []}
// sku: {value: acme-widget, definition: d, grounds: []}
// driver_type: {value: woofer, origin: manual, definition: d, dq: []}
// data_sources: {value: {}, definition: d}
// authoritative: {value: manual, definition: d}
// specs:
//   woofer:
//     Fs: {origin: manual, readings: {manual: {read_value: 45}}, dq: []}
//     Mms: {origin: manual, readings: {manual: {read_value: 0.012}}, dq: []}
//     Qes: {origin: manual, readings: {manual: {read_value: 0.4}}, dq: []}
// `;
//     const driver = OpenISDDriver.fromJsonRecord(parse(record) as never);
//     assert.equal(driver.RmeCell().state, Provenance.Calculated, 'Rme must actually be Calculated for this test to prove anything');
//
//     const { errors } = openisdYamlToWdr(record);
//     assert.deepEqual(errors.filter(e => e.field.startsWith('wdr-round-trip')), []);
//   });
// });
//