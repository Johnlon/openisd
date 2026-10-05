import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {createEngine} from '@openisd/design/engine';
import type {Calculated, Entered, Readable} from '../../domain/cell.js';
import type {CellState} from '../../winisd/cellState.js';

/** The field reads `value` and carries the `.wdr` provenance `state`. */
function assertReads<T>(field: Readable<T | null> & Entered & Calculated, value: T | null, state: CellState, message?: string): void {
    assert.equal(field.value, value, message);
    assert.equal(field.entered, state === 'entered', message);
    assert.equal(field.calculated, state === 'calculated', message);
}

const scraped = <T, >(value: T) => ({value});

describe('every spec field supports get/set/get/clear/get — clear() actually clears, never throws', () => {
    // Regression guard: `clear()` on a driver's spec field used to throw unconditionally
    // ("this section always exists once constructed") even though the field's own getter already
    // treats an absent key as not-available — the throw's justification was contradicted by the
    // three lines of code right above it. Fixed in project.ts; this pins the fix for every
    // numeric spec field plus VCCon, so a future re-add of that throw fails here immediately.
    function freshSection() {
        const record = {
            uuid: {value: '00000000-0000-4000-8000-000000000000'},
            manufacturer: scraped(''), brand: scraped(''), model: scraped(''),
            provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
            sku: {value: '', grounds: [{origin: 'manufacturer_datasheet', reading: ''}]},
            driver_type: scraped('woofer'),
            data_sources: {value: {}},
            quality: {
                confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
                parse_errors: [], cross_source_only: [],
            },
            specs: {woofer: {}},
        };
        const driver = OpenISDDriver.fromConformingRecord(record, createEngine());
        if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
        return driver.specs;
    }

    // `numVC`, `VCCon`, `c_m_per_s` and `roo_kg_per_m3` are excluded here — all four have a
    // documented calculated default when unset (`numVC`/`VCCon`: `docs/spec/SPEC_ENGINE.md:424`,
    // "numVC=1, VCCon=1"; `c_m_per_s`/`roo_kg_per_m3`: the live air model at reference conditions,
    // `engine/air.ts`'s `airFor`), so "not-available when unset" does not hold for them. Each gets
    // its own test below instead.
    const NUMERIC_FIELD_NAMES = [
        'Fs_hz', 'Re_ohm', 'Le_H', 'fLe_hz', 'KLe_H_sqrtHz', 'Znom_ohm', 'Qts', 'Qes', 'Qms',
        'Vas_m3', 'Sd_m2', 'BL_Tm', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'Xmax_m', 'Xlim_m',
        'SPL_dB', 'Pe_W', 'Dd_m', 'EBP_hz', 'Dia_m', 'Vd_m3', 'no', 'SPLmax_dB',
        'SPLmaxLF_dB', 'USPL_dB', 'alfaVC_per_K', 'Rt_K_per_W', 'Ct_J_per_K', 'gamma_m_per_s2_A',
        'Rme_kg_per_s', 'Mpow_N_per_sqrtW', 'Mcost_kg_per_s', 'Gloss',
        'Vcd_m', 'Hg_m', 'Hc_m', 'Thick_m', 'Depth_m', 'MagDepth_m', 'Magnet_m', 'Basket_m',
        'Outer_m', 'DVol_m3',
    ] as const;

    for (const [i, name] of NUMERIC_FIELD_NAMES.entries()) {
        it(`${name}: get=not-available, set=allowed, get=new value, clear=allowed, get=not-available`, () => {
            const section = freshSection();
            const field = section[name];
            const testValue = 100 + i;

            assertReads(field, null, 'not-available',
                `${name} must start not-available on a fresh section`);

            field.set(testValue);
            assertReads(field, testValue, 'entered',
                `${name} must read back exactly what was just set`);

            field.clear();
            assertReads(field, null, 'not-available',
                `${name} must revert to not-available after clear() — clear() must not throw`);
        });
    }

    it('numVC: get=calculated default 1, set=allowed, get=new value, clear=allowed, get=calculated default 1', () => {
        const section = freshSection();

        assertReads(section.numVC, 1, 'calculated',
            "numVC must start at WinISD's own documented default (1) on a fresh section, not absent");

        section.numVC.set(2);
        assertReads(section.numVC, 2, 'entered',
            'numVC must read back exactly what was just set');

        section.numVC.clear();
        assertReads(section.numVC, 1, 'calculated',
            'numVC must revert to the calculated default 1 after clear() — clear() must not throw');
    });

    it('VCCon: get=calculated default parallel, set=allowed, get=new value, clear=allowed, get=calculated default parallel', () => {
        const section = freshSection();

        assertReads(section.VCCon, 'parallel', 'calculated',
            "VCCon must start at WinISD's own documented default (parallel) on a fresh section, not absent");

        section.VCCon.set('series');
        assertReads(section.VCCon, 'series', 'entered',
            'VCCon must read back exactly what was just set');

        section.VCCon.clear();
        assertReads(section.VCCon, 'parallel', 'calculated',
            'VCCon must revert to the calculated default parallel after clear() — clear() must not throw');
    });

    it('c_m_per_s: get=calculated air-model default, set=allowed, get=the air again, clear=allowed, get=calculated default again', () => {
        const section = freshSection();
        const referenceC = createEngine().environment.solve({}).values.c;

        assertReads(section.c_m_per_s, referenceC, 'calculated',
            'c_m_per_s must start at the live reference-air speed of sound on a fresh section, not absent');

        // John, 2026-10-05: a driver record's own c/roo feed no calculation, so the field shows
        // the driver's air (here the app's environment defaults) whatever is set into it.
        section.c_m_per_s.set(340);
        assertReads(section.c_m_per_s, referenceC, 'calculated',
            'c_m_per_s must show the driver\'s air, not the value just set');

        section.c_m_per_s.clear();
        assertReads(section.c_m_per_s, referenceC, 'calculated',
            'c_m_per_s must revert to the calculated reference-air default after clear() — clear() must not throw');
    });

    it('roo_kg_per_m3: get=calculated air-model default, set=allowed, get=the air again, clear=allowed, get=calculated default again', () => {
        const section = freshSection();
        const referenceRho = createEngine().environment.solve({}).values.rho;

        assertReads(section.roo_kg_per_m3, referenceRho, 'calculated',
            'roo_kg_per_m3 must start at the live reference-air density on a fresh section, not absent');

        // John, 2026-10-05: a driver record's own c/roo feed no calculation, so the field shows
        // the driver's air (here the app's environment defaults) whatever is set into it.
        section.roo_kg_per_m3.set(1.25);
        assertReads(section.roo_kg_per_m3, referenceRho, 'calculated',
            'roo_kg_per_m3 must show the driver\'s air, not the value just set');

        section.roo_kg_per_m3.clear();
        assertReads(section.roo_kg_per_m3, referenceRho, 'calculated',
            'roo_kg_per_m3 must revert to the calculated reference-air default after clear() — clear() must not throw');
    });
});
