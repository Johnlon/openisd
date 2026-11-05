/**
 * openisd.json is the slim model (QO395, John 3 Nov 2026): values with state and precision, names
 * and texts, the three manufacturer links, driver type and curves. A record saved before
 * `schemaVersion` 3 carries readings, origin, corroboration, quality marks, sku grounds and more;
 * the load upgrade works the stated precision out of them and drops them before the strict schema
 * reads the record. The not-available entry keeps its readings while QO420 is open.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {openISDDeviceJsonSchema} from '../../domain/openisdSchema.js';
import {upgradeToCurrent} from '../../domain/schemaVersion.js';
import {withSlimModel} from '../../domain/slimModel.js';

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function recordOf(v: unknown): Record<string, unknown> {
    if (!isRecord(v)) throw new Error('not a record');
    return v;
}

/** A record as the scraper's bridge wrote it before the slim model: every field with its provenance. */
function oldRecord(): Record<string, unknown> {
    return {
        uuid: {value: 'u-1'},
        quality: {invalid: [], parse_errors: [], missing: ['Xmax_m'], cross_source_only: [], issue: 'x'},
        manufacturer: {value: 'Acme', origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: 'Acme'}, dq_scraper: []},
        brand: {value: 'Acme', origin: 'manufacturer_datasheet'},
        model: {value: 'W1', origin: 'manufacturer_datasheet'},
        sku: {value: 'W1', grounds: [{origin: 'manufacturer_datasheet', reading: 'W1'}]},
        driver_type: {value: ['woofer'], origin: 'manufacturer_product_page'},
        categories: {value: [{label: 'Woofers', url: 'https://x.example/w'}]},
        series: {value: 'S', origin: 'manufacturer_datasheet', note: 'n'},
        nominal_size_cm: {value: 20},
        data_sources: {value: {
            manufacturer_datasheet: 'https://x.example/d.pdf',
            manufacturer_product_page: 'https://x.example/p',
            manufacturer_listing_page: 'https://x.example/l',
            distributor_datasheet: 'https://y.example/d.pdf',
            scraper_notes: 'https://z.example/n',
        }},
        authoritative: {value: 'manufacturer_datasheet'},
        product_image: {value: 'https://x.example/i.png', origin: 'manufacturer_product_page'},
        specs: {woofer: {
            Fs_hz: {
                state: 'E', value: 30, origin: 'manufacturer_datasheet', corroboration: 'MATCH',
                readings: {
                    manufacturer_datasheet: {actual_reading: '30', read_value: 30, read_precision: 0.5},
                    distributor_datasheet: {actual_reading: '30.2', read_value: 30.2, read_precision: 0.05},
                },
                dq_scraper: [{kind: 'k', severity: 's', rule: 'r', detail: 'd', params: {}}],
                dq_calculated: [],
            },
            Qts: {state: 'E', value: 0.4, precision: 0.005, origin: 'manufacturer_datasheet', readings: {manufacturer_datasheet: {actual_reading: '0.4', read_value: 0.4}}},
            Vas_m3: {state: 'C', value: 0.05, precision: 0.001, dq_calculated: []},
            Re_ohm: {state: 'N', readings: {manufacturer_datasheet: {actual_reading: '2x4', rejected: 'unknown-voice-coil'}}, dq_scraper: []},
        }},
        curves: {spl: {value: {type: 'spl', local_path: 'a.csv'}, origin: 'manufacturer_datasheet'}},
    };
}

function woofer(slim: unknown): Record<string, unknown> {
    return recordOf(recordOf(recordOf(slim).specs).woofer);
}

describe('withSlimModel', () => {
    it('an entered value keeps its value and the precision its winning reading states', () => {
        assert.deepEqual(woofer(withSlimModel(oldRecord())).Fs_hz, {state: 'E', value: 30, precision: 0.5});
    });

    it('an entered value whose reading states none keeps its own precision, and a calculated one keeps its precision', () => {
        const woof = woofer(withSlimModel(oldRecord()));
        assert.deepEqual(woof.Qts, {state: 'E', value: 0.4, precision: 0.005});
        assert.deepEqual(woof.Vas_m3, {state: 'C', value: 0.05, precision: 0.001});
    });

    it('a rejected winning reading states no precision', () => {
        const record = oldRecord();
        recordOf(woofer(record).Qts).readings = {manufacturer_datasheet: {actual_reading: 'x', rejected: 'no-numeric-value', read_precision: 9}};
        delete recordOf(woofer(record).Qts).precision;
        assert.deepEqual(woofer(withSlimModel(record)).Qts, {state: 'E', value: 0.4});
    });

    it('a not-available entry keeps its readings and loses its marks', () => {
        assert.deepEqual(woofer(withSlimModel(oldRecord())).Re_ohm, {
            state: 'N', readings: {manufacturer_datasheet: {actual_reading: '2x4', rejected: 'unknown-voice-coil'}},
        });
    });

    it('texts are their value alone; quality, grounds, authoritative, categories, nominal size and any source that is not a link go', () => {
        const slim = recordOf(withSlimModel(oldRecord()));
        assert.deepEqual(slim.manufacturer, {value: 'Acme'});
        assert.deepEqual(slim.series, {value: 'S'});
        assert.deepEqual(slim.driver_type, {value: ['woofer']});
        assert.deepEqual(slim.sku, {value: 'W1'});
        assert.deepEqual(slim.product_image, {value: 'https://x.example/i.png'});
        assert.deepEqual(slim.data_sources, {value: {
            manufacturer_datasheet: 'https://x.example/d.pdf',
            manufacturer_product_page: 'https://x.example/p',
            manufacturer_listing_page: 'https://x.example/l',
            distributor_datasheet: 'https://y.example/d.pdf',
        }});
        for (const gone of ['quality', 'authoritative', 'categories', 'nominal_size_cm']) assert.equal(gone in slim, false, gone);
    });

    it('curves are kept as they are', () => {
        assert.deepEqual(recordOf(withSlimModel(oldRecord())).curves, oldRecord().curves);
    });

    it('the result parses under the strict schema', () => {
        const parsed = openISDDeviceJsonSchema.safeParse(withSlimModel(oldRecord()));
        assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
    });

    it('slimming a slim record changes nothing', () => {
        const once = withSlimModel(oldRecord());
        assert.deepEqual(withSlimModel(once), once);
    });

    it('the input is not changed', () => {
        const record = oldRecord();
        withSlimModel(record);
        assert.deepEqual(record, oldRecord());
    });

    it('a short code that an import copied from the model, grounded only on manual, becomes the import placeholder; a datasheet one stays; the placeholder is left for the repair', () => {
        const imported = {...oldRecord(), sku: {value: 'W1', grounds: [{origin: 'manual', reading: 'W1'}]}};
        assert.deepEqual(recordOf(withSlimModel(imported)).sku, {value: 'WPR-IMPORT'}, 'handed on to the repair, which clears it and reports it');
        assert.deepEqual(recordOf(withSlimModel(oldRecord())).sku, {value: 'W1'});
        const placeholder = {...oldRecord(), sku: {value: 'WPR-IMPORT', grounds: [{origin: 'manual', reading: ''}]}};
        assert.deepEqual(recordOf(withSlimModel(placeholder)).sku, {value: 'WPR-IMPORT'});
    });

    it('reaches a device inside a project, and an environment entry', () => {
        const project = {saved: {driverEmbedding: {device: oldRecord()}, environment: {temperature_K: {state: 'E', value: 293, dq_calculated: []}}}};
        const slim = recordOf(withSlimModel(project));
        const saved = recordOf(slim.saved);
        assert.deepEqual(recordOf(recordOf(saved.environment).temperature_K), {state: 'E', value: 293});
        assert.equal('quality' in recordOf(recordOf(saved.driverEmbedding).device), false);
    });
});

describe('the 2 to 3 upgrade', () => {
    it('upgrades an unversioned record to the slim model, stamped 3', () => {
        const result = upgradeToCurrent(oldRecord());
        assert.ok('value' in result);
        const upgraded = recordOf(result.value);
        assert.equal(upgraded.schemaVersion, 3);
        assert.deepEqual(woofer(upgraded).Fs_hz, {state: 'E', value: 30, precision: 0.5});
        assert.equal('quality' in upgraded, false);
    });

    it('a record already stamped 3 by the build before the slim model loads too', () => {
        const result = upgradeToCurrent({...oldRecord(), schemaVersion: 3});
        assert.ok('value' in result);
        assert.equal('quality' in recordOf(result.value), false);
        assert.deepEqual(woofer(result.value).Fs_hz, {state: 'E', value: 30, precision: 0.5});
    });
});
